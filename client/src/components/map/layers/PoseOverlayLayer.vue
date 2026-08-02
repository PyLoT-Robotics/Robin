<template>
  <canvas ref="layerCanvas" class="absolute inset-0 pointer-events-none"></canvas>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mapPixelToViewportPoint, mapWorldToPixel } from '@/models/map/coordinates'
import type { Pose2D, ScreenPoint } from '@/models/map/types'

const props = defineProps<{
  mapWidth: number
  mapHeight: number
  mapResolution: number
  mapOriginX: number
  mapOriginY: number
  mapOriginYaw: number
  translateX: number
  translateY: number
  scale: number
  mapRotationDeg: number
  robotPose: Pose2D | null
  isPoseInteractionMode: boolean
  isPoseDragging: boolean
  isInitialPoseMode: boolean
  poseDragStartScreen: ScreenPoint | null
  poseDragCurrentScreen: ScreenPoint | null
  tfVersion: number
}>()

const layerCanvas = ref<HTMLCanvasElement>()
let frameRequestId: number | null = null

function drawRobotMarker(ctx: CanvasRenderingContext2D) {
  if (!props.robotPose) {
    return
  }

  const geometry = {
    width: props.mapWidth,
    height: props.mapHeight,
    resolution: props.mapResolution,
    originX: props.mapOriginX,
    originY: props.mapOriginY,
    originYaw: props.mapOriginYaw,
  }
  const viewportTransform = {
    translateX: props.translateX,
    translateY: props.translateY,
    scale: props.scale,
    rotationDeg: props.mapRotationDeg,
  }

  const basePixel = mapWorldToPixel(geometry, props.robotPose.x, props.robotPose.y)
  if (!basePixel) {
    return
  }

  const headingLengthMeters = 0.45
  const noseWorldX = props.robotPose.x + Math.cos(props.robotPose.yaw) * headingLengthMeters
  const noseWorldY = props.robotPose.y + Math.sin(props.robotPose.yaw) * headingLengthMeters
  const nosePixel = mapWorldToPixel(geometry, noseWorldX, noseWorldY)

  const baseViewport = mapPixelToViewportPoint(
    props.mapWidth,
    props.mapHeight,
    viewportTransform,
    basePixel.x,
    basePixel.y,
  )
  if (!baseViewport) {
    return
  }

  let headingAngle = 0
  if (nosePixel) {
    const noseViewport = mapPixelToViewportPoint(
      props.mapWidth,
      props.mapHeight,
      viewportTransform,
      nosePixel.x,
      nosePixel.y,
    )
    if (noseViewport) {
      headingAngle = Math.atan2(noseViewport.y - baseViewport.y, noseViewport.x - baseViewport.x)
    }
  }

  ctx.save()
  ctx.translate(baseViewport.x, baseViewport.y)
  ctx.rotate(headingAngle)

  ctx.fillStyle = 'rgba(14, 165, 233, 0.95)'
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.95)'
  ctx.lineWidth = 2

  ctx.beginPath()
  ctx.arc(0, 0, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(14, 0)
  ctx.lineTo(-2, 7)
  ctx.lineTo(-2, -7)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()

  ctx.restore()
}

function drawPoseOverlay() {
  if (!layerCanvas.value) {
    return
  }

  const ctx = layerCanvas.value.getContext('2d')
  if (!ctx) {
    return
  }

  const parent = layerCanvas.value.parentElement
  if (!parent) {
    return
  }

  const width = parent.clientWidth
  const height = parent.clientHeight
  if (width <= 0 || height <= 0) {
    return
  }

  if (layerCanvas.value.width !== width) {
    layerCanvas.value.width = width
  }
  if (layerCanvas.value.height !== height) {
    layerCanvas.value.height = height
  }

  ctx.clearRect(0, 0, width, height)

  drawRobotMarker(ctx)

  if (
    !props.isPoseInteractionMode ||
    !props.isPoseDragging ||
    !props.poseDragStartScreen ||
    !props.poseDragCurrentScreen
  ) {
    return
  }

  const from = props.poseDragStartScreen
  const to = props.poseDragCurrentScreen
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 2) {
    return
  }

  const ux = dx / length
  const uy = dy / length
  const headSize = Math.max(10, Math.min(22, length * 0.25))
  const shaftEndX = to.x - ux * headSize
  const shaftEndY = to.y - uy * headSize
  const normalX = -uy
  const normalY = ux

  const overlayColor = props.isInitialPoseMode
    ? 'rgba(245, 158, 11, 0.95)'
    : 'rgba(56, 189, 248, 0.95)'
  ctx.strokeStyle = overlayColor
  ctx.fillStyle = overlayColor
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(shaftEndX, shaftEndY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(shaftEndX + normalX * headSize * 0.45, shaftEndY + normalY * headSize * 0.45)
  ctx.lineTo(shaftEndX - normalX * headSize * 0.45, shaftEndY - normalY * headSize * 0.45)
  ctx.closePath()
  ctx.fill()
}

function scheduleDraw() {
  if (frameRequestId !== null) {
    return
  }
  frameRequestId = window.requestAnimationFrame(() => {
    frameRequestId = null
    drawPoseOverlay()
  })
}

onMounted(() => {
  window.addEventListener('resize', scheduleDraw)
  scheduleDraw()
})

watch(
  () => [
    props.mapWidth,
    props.mapHeight,
    props.mapResolution,
    props.mapOriginX,
    props.mapOriginY,
    props.mapOriginYaw,
    props.translateX,
    props.translateY,
    props.scale,
    props.mapRotationDeg,
    props.robotPose,
    props.isPoseInteractionMode,
    props.isPoseDragging,
    props.isInitialPoseMode,
    props.poseDragStartScreen,
    props.poseDragCurrentScreen,
    props.tfVersion,
  ],
  () => {
    scheduleDraw()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleDraw)
  if (frameRequestId !== null) {
    window.cancelAnimationFrame(frameRequestId)
    frameRequestId = null
  }
})
</script>
