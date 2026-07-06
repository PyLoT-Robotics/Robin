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
import type { LaserScanData, Pose2D } from '@/models/map/types'

const props = defineProps<{
  layerStyle: StyleValue
  mapWidth: number
  mapHeight: number
  mapFrameId: string
  mapResolution: number
  mapOriginX: number
  mapOriginY: number
  mapOriginYaw: number
  latestScan: LaserScanData | null
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

function drawScanOverlay() {
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

  if (!props.latestScan || props.mapResolution <= 0) {
    return
  }

  const mapToScan = resolveTransform(props.tfTransforms, props.mapFrameId, props.latestScan.frameId)
  if (!mapToScan) {
    return
  }

  const stride = Math.max(1, Math.floor(props.latestScan.ranges.length / 4000))

  ctx.fillStyle = 'rgba(255, 70, 70, 0.9)'
  ctx.beginPath()

  for (let i = 0; i < props.latestScan.ranges.length; i += stride) {
    const range = props.latestScan.ranges[i]
    if (
      typeof range !== 'number' ||
      !Number.isFinite(range) ||
      range < props.latestScan.rangeMin ||
      range > props.latestScan.rangeMax
    ) {
      continue
    }

    const angle = props.latestScan.angleMin + i * props.latestScan.angleIncrement
    const scanX = range * Math.cos(angle)
    const scanY = range * Math.sin(angle)

    const cosYaw = Math.cos(mapToScan.yaw)
    const sinYaw = Math.sin(mapToScan.yaw)
    const mapX = mapToScan.x + cosYaw * scanX - sinYaw * scanY
    const mapY = mapToScan.y + sinYaw * scanX + cosYaw * scanY
    const pixel = mapWorldToPixel(mapGeometry.value, mapX, mapY)
    if (!pixel) {
      continue
    }

    const x = pixel.x
    const y = pixel.y

    if (x < 0 || x >= width || y < 0 || y >= height) {
      continue
    }

    ctx.rect(x, y, 1.4, 1.4)
  }

  ctx.fill()
}

function scheduleDraw() {
  if (frameRequestId !== null) {
    return
  }
  frameRequestId = window.requestAnimationFrame(() => {
    frameRequestId = null
    drawScanOverlay()
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
    props.latestScan,
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
