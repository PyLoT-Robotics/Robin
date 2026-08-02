<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-black text-zinc-100">
    <div class="relative min-h-48 grow overflow-hidden">
      <video ref="video" class="hidden" autoplay playsinline muted />
      <canvas ref="cameraCanvas" class="absolute inset-0 size-full object-contain" />
      <div v-if="!stream" class="absolute inset-0 grid place-content-center px-6 text-center text-zinc-400">
        スマホの背面カメラを開始してください
      </div>
    </div>

    <div class="max-h-[55%] shrink-0 overflow-y-auto border-t border-border text-sm">
      <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
        <p>{{ status }}</p>
        <p class="shrink-0 font-mono" :class="targetDetection ? 'text-green-400' : 'text-zinc-500'">
          {{ detectionFps.toFixed(1) }} fps
        </p>
      </div>

      <div v-if="currentPose" class="grid grid-cols-2 gap-x-5 gap-y-1 border-b border-border px-4 py-2 font-mono">
        <p>X {{ formatMetres(currentPose.position.x) }}</p>
        <p>Roll {{ formatDegrees(currentPose.euler.roll) }}</p>
        <p>Y {{ formatMetres(currentPose.position.y) }}</p>
        <p>Pitch {{ formatDegrees(currentPose.euler.pitch) }}</p>
        <p>Z {{ formatMetres(currentPose.position.z) }}</p>
        <p>Yaw {{ formatDegrees(currentPose.euler.yaw) }}</p>
      </div>

      <div class="grid grid-cols-3 border-b border-border">
        <label class="flex flex-col gap-1 border-r border-border px-3 py-2">
          Marker ID
          <select v-model.number="markerId" class="rounded bg-zinc-900 px-2 py-1">
            <option v-for="id in markerIds" :key="id" :value="id">HD21 / {{ id }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 border-r border-border px-3 py-2">
          Size (cm)
          <input v-model.number="markerSizeCm" type="number" min="1" max="100" step="0.5" class="rounded bg-zinc-900 px-2 py-1" />
        </label>
        <label class="flex flex-col gap-1 px-3 py-2">
          Camera HFOV
          <input v-model.number="horizontalFov" type="number" min="20" max="140" step="1" class="rounded bg-zinc-900 px-2 py-1" />
        </label>
      </div>

      <div class="grid grid-cols-3 border-b border-border">
        <button class="border-r border-border px-3 py-3" @click="startCamera">
          {{ stream ? 'Restart camera' : 'Start camera' }}
        </button>
        <button
          class="border-r border-border px-3 py-3 disabled:text-zinc-600"
          :class="isPublishing ? 'bg-green-700/40 text-green-100' : ''"
          :disabled="!stream"
          @click="togglePublishing"
        >
          {{ isPublishing ? 'Publishing' : 'Publish off' }}
        </button>
        <button class="px-3 py-3 disabled:text-zinc-600" :disabled="!currentPose" @click="resetOrigin">
          Reset origin
        </button>
      </div>

      <details class="border-b border-border">
        <summary class="cursor-pointer px-4 py-3">STag marker generator</summary>
        <div class="flex items-center gap-4 px-4 pb-4">
          <canvas ref="markerPreview" class="size-32 bg-white" />
          <div class="flex grow flex-col gap-3">
            <p class="text-zinc-400">HD21 / ID {{ markerId }} · 1000 × 1000 PNG</p>
            <button class="rounded border border-border px-4 py-2" @click="saveMarker">
              Save marker image
            </button>
          </div>
        </div>
      </details>

      <p class="px-4 py-3 text-xs text-zinc-400">
        検出・方向推定は端末内で完結します。Publish 中は原点からの位置差を
        <code>/luna_arm_custom_ik_pose_commander/target_delta</code>、絶対姿勢を
        <code>/robin/stag/camera_pose</code> に送信します。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useTopicPublisher } from '@/hooks/useTopicPublisher'
import {
  createMarkerCanvas,
  detectMarkers,
  drawMarker,
  markerFilename,
  STAG_HD21_CODES,
  type StagCameraPose,
  type StagDetection,
  type Vector3,
} from '@/lib/stag'

type PoseMessage = {
  position: Vector3
  orientation: { x: number; y: number; z: number; w: number }
}

const video = ref<HTMLVideoElement | null>(null)
const cameraCanvas = ref<HTMLCanvasElement | null>(null)
const markerPreview = ref<HTMLCanvasElement | null>(null)
const stream = ref<MediaStream | null>(null)
const markerId = ref(0)
const markerSizeCm = ref(5)
const horizontalFov = ref(60)
const isPublishing = ref(false)
const status = ref('Camera is stopped.')
const targetDetection = ref<StagDetection | null>(null)
const currentPose = ref<StagCameraPose | null>(null)
const detectionFps = ref(0)
const markerIds = STAG_HD21_CODES.map((_, id) => id)

const positionTopic = useTopicPublisher<Vector3>(
  '/luna_arm_custom_ik_pose_commander/target_delta',
  'geometry_msgs/Vector3',
)
const poseTopic = useTopicPublisher<PoseMessage>('/robin/stag/camera_pose', 'geometry_msgs/Pose')

let origin: Vector3 | null = null
let processingCanvas: HTMLCanvasElement | null = null
let loopTimer: ReturnType<typeof setTimeout> | null = null
let loopActive = false
let lastDetectionAt = 0

function formatMetres(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)} m`
}

function formatDegrees(value: number) {
  const degrees = value * 180 / Math.PI
  return `${degrees >= 0 ? '+' : ''}${degrees.toFixed(1)}°`
}

function drawCameraFrame(detection?: StagDetection) {
  const source = processingCanvas
  const output = cameraCanvas.value
  if (!source || !output) return
  output.width = source.width
  output.height = source.height
  const context = output.getContext('2d')
  if (!context) return
  context.drawImage(source, 0, 0)
  if (!detection) return

  context.lineWidth = Math.max(2, output.width / 240)
  context.strokeStyle = '#4ade80'
  context.beginPath()
  detection.corners.forEach((corner, index) => {
    if (index === 0) context.moveTo(corner.x, corner.y)
    else context.lineTo(corner.x, corner.y)
  })
  context.closePath()
  context.stroke()

  const [corner, xCorner, , yCorner] = detection.corners
  context.strokeStyle = '#ef4444'
  context.beginPath()
  context.moveTo(corner.x, corner.y)
  context.lineTo(xCorner.x, xCorner.y)
  context.stroke()
  context.strokeStyle = '#60a5fa'
  context.beginPath()
  context.moveTo(corner.x, corner.y)
  context.lineTo(yCorner.x, yCorner.y)
  context.stroke()
  context.fillStyle = '#4ade80'
  context.font = `bold ${Math.max(16, output.width / 24)}px sans-serif`
  context.fillText(`ID ${detection.id}`, corner.x + 6, corner.y - 8)
}

function publishPose(pose: StagCameraPose) {
  if (!origin) origin = { ...pose.position }
  positionTopic.publish({
    x: pose.position.x - origin.x,
    y: pose.position.y - origin.y,
    z: pose.position.z - origin.z,
  })
  poseTopic.publish({ position: pose.position, orientation: pose.orientation })
}

function processFrame() {
  if (!loopActive || !video.value || video.value.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    scheduleFrame()
    return
  }
  const sourceVideo = video.value
  processingCanvas ??= document.createElement('canvas')
  const scale = Math.min(1, 480 / sourceVideo.videoWidth)
  processingCanvas.width = Math.max(1, Math.round(sourceVideo.videoWidth * scale))
  processingCanvas.height = Math.max(1, Math.round(sourceVideo.videoHeight * scale))
  const context = processingCanvas.getContext('2d', { willReadFrequently: true })
  if (!context) return
  context.drawImage(sourceVideo, 0, 0, processingCanvas.width, processingCanvas.height)

  const startedAt = performance.now()
  const detections = detectMarkers(
    context.getImageData(0, 0, processingCanvas.width, processingCanvas.height),
    {
      markerSizeMeters: Math.max(0.001, markerSizeCm.value / 100),
      horizontalFovDegrees: horizontalFov.value,
      maxHammingDistance: 6,
    },
  )
  const elapsed = performance.now() - startedAt
  detectionFps.value = 1000 / Math.max(1, elapsed)
  const detected = detections.find((item) => item.id === markerId.value)
  targetDetection.value = detected ?? null
  currentPose.value = detected?.pose ?? null
  drawCameraFrame(detected)

  if (detected?.pose) {
    lastDetectionAt = performance.now()
    status.value = `HD21 / ${detected.id} detected · ${detected.hammingDistance} corrected bits`
    if (isPublishing.value) publishPose(detected.pose)
  } else if (performance.now() - lastDetectionAt > 500) {
    status.value = `Looking for HD21 / ${markerId.value}…`
  }
  scheduleFrame()
}

function scheduleFrame() {
  if (!loopActive) return
  loopTimer = setTimeout(processFrame, 100)
}

function stopCamera() {
  loopActive = false
  if (loopTimer) clearTimeout(loopTimer)
  loopTimer = null
  stream.value?.getTracks().forEach((track) => track.stop())
  stream.value = null
  if (video.value) video.value.srcObject = null
  targetDetection.value = null
  currentPose.value = null
}

async function startCamera() {
  stopCamera()
  isPublishing.value = false
  origin = null
  try {
    stream.value = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
    if (!video.value) return
    video.value.srcObject = stream.value
    await video.value.play()
    loopActive = true
    status.value = `Looking for HD21 / ${markerId.value}…`
    processFrame()
  } catch (error) {
    status.value = `Camera unavailable: ${error instanceof Error ? error.message : String(error)}`
  }
}

function resetOrigin() {
  origin = currentPose.value ? { ...currentPose.value.position } : null
}

function togglePublishing() {
  isPublishing.value = !isPublishing.value
  if (isPublishing.value) resetOrigin()
}

function updateMarkerPreview() {
  const canvas = markerPreview.value
  if (!canvas) return
  canvas.width = 320
  canvas.height = 320
  const context = canvas.getContext('2d')
  if (context) drawMarker(context, markerId.value, canvas.width)
}

function saveMarker() {
  const canvas = createMarkerCanvas(markerId.value, 1000)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = markerFilename(markerId.value)
    anchor.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

watch(markerId, () => {
  targetDetection.value = null
  currentPose.value = null
  origin = null
  updateMarkerPreview()
})

onMounted(async () => {
  await nextTick()
  updateMarkerPreview()
})

onBeforeUnmount(stopCamera)
</script>
