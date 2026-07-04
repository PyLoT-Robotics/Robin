<template>
  <div class="relative flex flex-col overflow-hidden w-full h-full bg-black">
    <video
      ref="remoteVideo"
      autoplay
      playsinline
      muted
      preload="none"
      class="grow object-contain min-h-0"
    />
    <div
      v-if="connectionState !== 'playing'"
      class="absolute inset-0 grid place-content-center bg-black/90 p-6 text-center text-zinc-200"
    >
      <div class="max-w-lg space-y-3">
        <p class="text-lg">{{ connectionMessage }}</p>
        <p class="break-all font-mono text-xs text-zinc-400">{{ diagnosticDetail }}</p>
        <button
          v-if="connectionState === 'error'"
          class="rounded border border-zinc-600 px-4 py-2 hover:bg-zinc-800"
          @click="startConnection"
        >
          Retry video connection
        </button>
      </div>
    </div>
    <div
      class="px-3 py-1 text-xs font-mono text-center border-b border-border"
      :class="isFrameStale ? 'text-red-400' : 'text-zinc-100'"
      v-if="lastFrameUpdatedAtText"
    >
      Frame: {{ lastFrameAgeText }} · {{ transportStatsText }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { buildVideoPublisherBaseURL } from '@/api/endpoints'
import { useLocalStorage } from '@/hooks/useLocalStorage'

const remoteVideo = ref<HTMLVideoElement | null>(null)

const incomingStream = ref<MediaStream | null>(null)
const lastFrameUpdatedAt = ref<Date | null>(null)
const nowMs = ref(Date.now())
const peerConnection = ref<RTCPeerConnection | null>(null)
const connectionState = ref<'signaling' | 'ice' | 'waiting' | 'playing' | 'error'>('signaling')
const diagnosticDetail = ref('Preparing WebRTC receiver…')
const transportStatsText = ref('measuring transport')
const videoPriority = useLocalStorage('WebRTCVideoPriority')

const connectionMessage = computed(() => ({
  signaling: 'Contacting the video publisher…',
  ice: 'Discovering the network route…',
  waiting: 'Connected; waiting for camera frames…',
  playing: 'Video is playing',
  error: 'Video connection failed',
})[connectionState.value])

let nowTimer: ReturnType<typeof setInterval> | null = null
let inboundStatsTimer: ReturnType<typeof setInterval> | null = null
let priorityChangeTimer: ReturnType<typeof setTimeout> | null = null
let lastDecodedFrames = -1
let statsPolling = false
let mounted = false
let videoFrameCallbackId: number | null = null

function formatDuration(ms: number) {
  return `${(ms / 1000).toFixed(1)}s ago`
}

const timestampFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const lastFrameUpdatedAtText = computed(() => {
  if (!lastFrameUpdatedAt.value) {
    return ''
  }
  const milliseconds = String(lastFrameUpdatedAt.value.getMilliseconds()).padStart(3, '0')
  return `${timestampFormatter.format(lastFrameUpdatedAt.value)}.${milliseconds}`
})

const lastFrameAgeText = computed(() => {
  return formatDuration(frameAgeMs.value)
})

const frameAgeMs = computed(() => {
  if (!lastFrameUpdatedAt.value) {
    return 0
  }
  return Math.max(0, nowMs.value - lastFrameUpdatedAt.value.getTime())
})

const isFrameStale = computed(() => frameAgeMs.value >= 2000)

watchEffect(() => {
  if (!remoteVideo.value || !incomingStream.value) {
    return
  }

  remoteVideo.value.srcObject = incomingStream.value
})

async function pollInboundFrameStats() {
  const pc = peerConnection.value
  if (!pc || statsPolling) {
    return
  }

  statsPolling = true
  try {
    const receivers = pc.getReceivers().filter((receiver) => receiver.track?.kind === 'video')
    let maxFramesDecoded = lastDecodedFrames
    let averageJitterBufferMs = 0
    let framesPerSecond = 0
    let packetsLost = 0
    let framesDropped = 0

    for (const receiver of receivers) {
      const stats = await receiver.getStats()
      stats.forEach((report) => {
        if (report.type !== 'inbound-rtp' || report.kind !== 'video') {
          return
        }

        const framesDecoded = Number(report.framesDecoded ?? 0)
        if (framesDecoded > maxFramesDecoded) {
          maxFramesDecoded = framesDecoded
        }

        const jitterBufferDelay = Number(report.jitterBufferDelay ?? 0)
        const jitterBufferEmittedCount = Number(report.jitterBufferEmittedCount ?? 0)
        averageJitterBufferMs = jitterBufferEmittedCount > 0
          ? (jitterBufferDelay / jitterBufferEmittedCount) * 1000
          : 0
        framesPerSecond = Number(report.framesPerSecond ?? 0)
        packetsLost = Number(report.packetsLost ?? 0)
        framesDropped = Number(report.framesDropped ?? 0)
      })
    }

    let roundTripTimeMs = 0
    const connectionStats = await pc.getStats()
    connectionStats.forEach((report) => {
      if (
        report.type === 'candidate-pair' &&
        report.state === 'succeeded' &&
        report.nominated
      ) {
        roundTripTimeMs = Number(report.currentRoundTripTime ?? 0) * 1000
      }
    })
    transportStatsText.value = `${framesPerSecond.toFixed(0)} fps · buffer ${averageJitterBufferMs.toFixed(0)} ms · RTT ${roundTripTimeMs.toFixed(0)} ms · lost ${packetsLost} · dropped ${framesDropped}`

    if (maxFramesDecoded > lastDecodedFrames) {
      lastDecodedFrames = maxFramesDecoded
      lastFrameUpdatedAt.value = new Date()
      connectionState.value = 'playing'
      diagnosticDetail.value = `Receiving decoded video frames over ${pc.connectionState}.`
    }
  } finally {
    statsPolling = false
  }
}

function watchRenderedFrames(video: HTMLVideoElement) {
  if (!('requestVideoFrameCallback' in video)) return

  const onFrame = () => {
    lastFrameUpdatedAt.value = new Date()
    connectionState.value = 'playing'
    videoFrameCallbackId = video.requestVideoFrameCallback(onFrame)
  }
  videoFrameCallbackId = video.requestVideoFrameCallback(onFrame)
}

function waitForIceGatheringComplete(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const handleStateChange = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', handleStateChange)
        resolve()
      }
    }
    pc.addEventListener('icegatheringstatechange', handleStateChange)
  })
}

async function startConnection() {
  if (nowTimer) clearInterval(nowTimer)
  if (inboundStatsTimer) clearInterval(inboundStatsTimer)
  peerConnection.value?.close()
  const videoPublisherBaseURL = buildVideoPublisherBaseURL()
  if (!videoPublisherBaseURL) {
    connectionState.value = 'error'
    diagnosticDetail.value = 'Configure the Robin server URL in Settings.'
    return
  }

  const pc = new RTCPeerConnection()
  const videoPublisherOfferURL = `${videoPublisherBaseURL}/offer`
  peerConnection.value = pc
  incomingStream.value = null
  lastFrameUpdatedAt.value = null
  lastDecodedFrames = -1
  transportStatsText.value = 'measuring transport'
  connectionState.value = 'signaling'
  diagnosticDetail.value = `POST ${videoPublisherOfferURL}`

  nowTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 100)

  inboundStatsTimer = setInterval(() => {
    void pollInboundFrameStats()
  }, 200)

  pc.addTransceiver('video', { direction: 'recvonly' })

  pc.ontrack = (event) => {
    const receiver = pc.getReceivers().find((item) => item.track === event.track)
    if (receiver) {
      const lowLatencyReceiver = receiver as RTCRtpReceiver & {
        jitterBufferTarget?: number
        playoutDelayHint?: number
      }
      if ('jitterBufferTarget' in lowLatencyReceiver) lowLatencyReceiver.jitterBufferTarget = 0
      if ('playoutDelayHint' in lowLatencyReceiver) lowLatencyReceiver.playoutDelayHint = 0
    }
    incomingStream.value = event.streams[0] ?? new MediaStream([event.track])
    connectionState.value = 'waiting'
    diagnosticDetail.value = `Received ${event.track.kind} track; waiting for decoded frames.`
  }

  pc.onconnectionstatechange = () => {
    diagnosticDetail.value = `WebRTC connection: ${pc.connectionState}; ICE: ${pc.iceConnectionState}`
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      connectionState.value = 'error'
    }
  }

  try {
    const offer = await pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: false,
    })
    await pc.setLocalDescription(offer)
    connectionState.value = 'ice'
    diagnosticDetail.value = 'Waiting for ICE candidate gathering to complete.'
    await waitForIceGatheringComplete(pc)

    if (!pc.localDescription) throw new Error('Local description is null')

    const response = await fetch(videoPublisherOfferURL, {
      method: 'POST',
      body: JSON.stringify({
        sdp: pc.localDescription.sdp,
        type: pc.localDescription.type,
        videoPriority: Math.min(100, Math.max(0, Number(videoPriority.value || 0))),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(`Signaling returned HTTP ${response.status}: ${responseText.slice(0, 200)}`)
    }

    const answer = await response.json()
    await pc.setRemoteDescription(new RTCSessionDescription(answer))
    connectionState.value = 'waiting'
    diagnosticDetail.value = 'WebRTC answer accepted; waiting for the first camera frame.'
  } catch (error) {
    connectionState.value = 'error'
    diagnosticDetail.value = error instanceof Error ? error.message : String(error)
    console.error('WebRTC negotiation failed', error)
  }
}

onMounted(() => {
  mounted = true
  if (remoteVideo.value) watchRenderedFrames(remoteVideo.value)
  void startConnection()
})

watch(videoPriority, () => {
  if (!mounted) return
  if (priorityChangeTimer) clearTimeout(priorityChangeTimer)
  priorityChangeTimer = setTimeout(() => void startConnection(), 250)
})

onUnmounted(() => {
  mounted = false
  if (videoFrameCallbackId !== null && remoteVideo.value) {
    remoteVideo.value.cancelVideoFrameCallback(videoFrameCallbackId)
    videoFrameCallbackId = null
  }
  if (priorityChangeTimer) {
    clearTimeout(priorityChangeTimer)
    priorityChangeTimer = null
  }
  if (nowTimer) {
    clearInterval(nowTimer)
    nowTimer = null
  }

  if (inboundStatsTimer) {
    clearInterval(inboundStatsTimer)
    inboundStatsTimer = null
  }

  if (peerConnection.value) {
    peerConnection.value.close()
    peerConnection.value = null
  }
})
</script>
