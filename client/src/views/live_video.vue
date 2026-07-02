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
      class="px-3 py-1 text-sm font-mono text-center border-b border-border"
      :class="isFrameStale ? 'text-red-400' : 'text-zinc-100'"
      v-if="lastFrameUpdatedAtText"
    >
      Last frame updated: {{ lastFrameAgeText }}
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { buildVideoPublisherBaseURL } from '@/api/ros'

const remoteVideo = ref<HTMLVideoElement | null>(null)

const incomingStream = ref<MediaStream | null>(null)
const lastFrameUpdatedAt = ref<Date | null>(null)
const nowMs = ref(Date.now())
const peerConnection = ref<RTCPeerConnection | null>(null)
const connectionState = ref<'signaling' | 'ice' | 'waiting' | 'playing' | 'error'>('signaling')
const diagnosticDetail = ref('Preparing WebRTC receiver…')

const connectionMessage = computed(() => ({
  signaling: 'Contacting the video publisher…',
  ice: 'Discovering the network route…',
  waiting: 'Connected; waiting for camera frames…',
  playing: 'Video is playing',
  error: 'Video connection failed',
})[connectionState.value])

let nowTimer: ReturnType<typeof setInterval> | null = null
let inboundStatsTimer: ReturnType<typeof setInterval> | null = null
let lastDecodedFrames = -1
let statsPolling = false

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
      })
    }

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
  peerConnection.value?.close()
  const pc = new RTCPeerConnection()
  const videoPublisherOfferURL = `${buildVideoPublisherBaseURL()}/offer`
  peerConnection.value = pc
  incomingStream.value = null
  lastFrameUpdatedAt.value = null
  lastDecodedFrames = -1
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
  void startConnection()
})

onUnmounted(() => {
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
