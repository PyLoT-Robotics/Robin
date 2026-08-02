<template>
  <canvas
    ref="layerCanvas"
    class="absolute left-0 top-0 pointer-events-none"
    :style="layerStyle"
  ></canvas>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type StyleValue } from 'vue'
import { mapWorldToPixel, type MapGeometry } from '@/models/map/coordinates'
import { resolveTransform } from '@/models/map/transformGraph'
import type { GlobalPathData, Pose2D } from '@/models/map/types'

const props = defineProps<{
  layerStyle: StyleValue
  mapWidth: number
  mapHeight: number
  mapFrameId: string
  mapResolution: number
  mapOriginX: number
  mapOriginY: number
  mapOriginYaw: number
  latestGlobalPath: GlobalPathData | null
  tfTransforms: Map<string, Pose2D>
  tfVersion: number
}>()

const layerCanvas = ref<HTMLCanvasElement>()
let frameRequestId: number | null = null

const mapGeometry = computed<MapGeometry>(() => ({
  width: props.mapWidth,
  height: props.mapHeight,
  resolution: props.mapResolution,
  originX: props.mapOriginX,
  originY: props.mapOriginY,
  originYaw: props.mapOriginYaw,
}))

function drawGlobalPathOverlay() {
  if (!layerCanvas.value) {
    return
  }

  const ctx = layerCanvas.value.getContext('2d')
  if (!ctx) {
    return
  }

  const width = props.mapWidth
  const height = props.mapHeight
  if (width <= 0 || height <= 0) {
    return
  }

  layerCanvas.value.width = width
  layerCanvas.value.height = height
  ctx.clearRect(0, 0, width, height)

  if (
    !props.latestGlobalPath ||
    props.latestGlobalPath.points.length < 2
  ) {
    return
  }

  const pathToMap = resolveTransform(
    props.tfTransforms,
    props.mapFrameId,
    props.latestGlobalPath.frameId,
  )
  if (!pathToMap) {
    return
  }

  const cosYaw = Math.cos(pathToMap.yaw)
  const sinYaw = Math.sin(pathToMap.yaw)
  let hasPath = false

  ctx.beginPath()

  for (const point of props.latestGlobalPath.points) {
    const mapX = pathToMap.x + cosYaw * point.x - sinYaw * point.y
    const mapY = pathToMap.y + sinYaw * point.x + cosYaw * point.y
    const pixel = mapWorldToPixel(mapGeometry.value, mapX, mapY)
    if (!pixel) {
      continue
    }

    if (!hasPath) {
      ctx.moveTo(pixel.x, pixel.y)
      hasPath = true
    } else {
      ctx.lineTo(pixel.x, pixel.y)
    }
  }

  if (!hasPath) {
    return
  }

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'
  ctx.lineWidth = Math.max(2, props.mapResolution > 0 ? 0.1 / props.mapResolution : 2)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.stroke()
}

function scheduleDraw() {
  if (frameRequestId !== null) {
    return
  }
  frameRequestId = window.requestAnimationFrame(() => {
    frameRequestId = null
    drawGlobalPathOverlay()
  })
}

watch(
  () => [
    props.mapWidth,
    props.mapHeight,
    props.mapFrameId,
    props.mapResolution,
    props.mapOriginX,
    props.mapOriginY,
    props.mapOriginYaw,
    props.latestGlobalPath,
    props.tfVersion,
  ],
  () => {
    scheduleDraw()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (frameRequestId !== null) {
    window.cancelAnimationFrame(frameRequestId)
    frameRequestId = null
  }
})
</script>
