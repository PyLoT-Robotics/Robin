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
import type { CostmapData, Pose2D } from '@/models/map/types'

const props = defineProps<{
  layerStyle: StyleValue
  mapWidth: number
  mapHeight: number
  mapFrameId: string
  mapResolution: number
  mapOriginX: number
  mapOriginY: number
  mapOriginYaw: number
  globalCostmap: CostmapData | null
  localCostmap: CostmapData | null
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

function drawCostmapLayer(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  costmap: CostmapData,
) {
  const frameToMap = resolveTransform(props.tfTransforms, props.mapFrameId, costmap.frameId)
  if (!frameToMap) {
    return
  }

  const cosFrameYaw = Math.cos(frameToMap.yaw)
  const sinFrameYaw = Math.sin(frameToMap.yaw)
  const originWorldX = frameToMap.x + cosFrameYaw * costmap.originX - sinFrameYaw * costmap.originY
  const originWorldY = frameToMap.y + sinFrameYaw * costmap.originX + cosFrameYaw * costmap.originY
  const originWorldYaw = frameToMap.yaw + costmap.originYaw

  const cosYaw = Math.cos(originWorldYaw)
  const sinYaw = Math.sin(originWorldYaw)
  const safeLength = Math.min(costmap.data.length, costmap.width * costmap.height)

  for (let index = 0; index < safeLength; index++) {
    const value = costmap.data[index]
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      continue
    }

    const cx = index % costmap.width
    const cy = Math.floor(index / costmap.width)
    const localX = (cx + 0.5) * costmap.resolution
    const localY = (cy + 0.5) * costmap.resolution

    const worldX = originWorldX + cosYaw * localX - sinYaw * localY
    const worldY = originWorldY + sinYaw * localX + cosYaw * localY
    const pixel = mapWorldToPixel(mapGeometry.value, worldX, worldY)
    if (!pixel) {
      continue
    }

    const px = Math.round(pixel.x)
    const py = Math.round(pixel.y)
    if (px < 0 || px >= width || py < 0 || py >= height) {
      continue
    }

    const offset = (py * width + px) * 4
    const alpha = 0.65 * 255
    const veryHighThreshold = 95
    const lowColor = { r: 136, g: 54, b: 173 }
    const highColor = { r: 212, g: 77, b: 97 }
    const veryHighColor = { r: 54, g: 255, b: 255 }
    let targetColor = lowColor
    if (value >= veryHighThreshold) {
      targetColor = veryHighColor
    } else {
      const t = Math.max(0, Math.min(1, value / (veryHighThreshold - 1)))
      targetColor = {
        r: Math.round(lowColor.r + (highColor.r - lowColor.r) * t),
        g: Math.round(lowColor.g + (highColor.g - lowColor.g) * t),
        b: Math.round(lowColor.b + (highColor.b - lowColor.b) * t),
      }
    }
    const blend = alpha / 255
    const r = rgba[offset] ?? 0
    const g = rgba[offset + 1] ?? 0
    const b = rgba[offset + 2] ?? 0
    const a = rgba[offset + 3] ?? 0

    rgba[offset] = Math.round(r * (1 - blend) + targetColor.r * blend)
    rgba[offset + 1] = Math.round(g * (1 - blend) + targetColor.g * blend)
    rgba[offset + 2] = Math.round(b * (1 - blend) + targetColor.b * blend)
    rgba[offset + 3] = Math.max(a, alpha)
  }
}

function drawCostmapOverlay() {
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

  const imageData = ctx.createImageData(width, height)
  const rgba = imageData.data

  if (props.globalCostmap) {
    drawCostmapLayer(rgba, width, height, props.globalCostmap)
  }

  if (props.localCostmap) {
    drawCostmapLayer(rgba, width, height, props.localCostmap)
  }

  ctx.putImageData(imageData, 0, 0)
}

function scheduleDraw() {
  if (frameRequestId !== null) {
    return
  }
  frameRequestId = window.requestAnimationFrame(() => {
    frameRequestId = null
    drawCostmapOverlay()
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
    props.globalCostmap,
    props.localCostmap,
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
