<template>
  <canvas ref="layerCanvas" class="absolute left-0 top-0" :style="layerStyle"></canvas>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch, type StyleValue } from 'vue'
import type { MapFrameData } from '@/models/map/types'

const props = defineProps<{
  layerStyle: StyleValue
  mapFrame: MapFrameData | null
}>()

const layerCanvas = ref<HTMLCanvasElement>()
let frameRequestId: number | null = null
let pendingFrame: MapFrameData | null = null

function drawMap(frame: MapFrameData) {
  if (!layerCanvas.value) {
    return
  }

  const width = frame.width
  const height = frame.height
  const data = frame.data

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return
  }

  const ctx = layerCanvas.value.getContext('2d')
  if (!ctx) {
    return
  }

  layerCanvas.value.width = width
  layerCanvas.value.height = height

  const imageData = ctx.createImageData(width, height)
  const rgba = imageData.data
  const pixelCount = width * height
  const safeLength = Math.min(data.length, pixelCount)

  for (let i = 0; i < pixelCount; i++) {
    const value = i < safeLength ? data[i] : -1
    const color =
      value === 0
        ? { r: 255, g: 255, b: 255 }
        : value === 100
          ? { r: 0, g: 0, b: 0 }
          : value === -1 || value === -100
            ? { r: 112, g: 137, b: 134 }
            : { r: 127, g: 127, b: 127 }
    const x = i % width
    const y = Math.floor(i / width)
    const flippedY = height - 1 - y
    const offset = (flippedY * width + x) * 4
    rgba[offset] = color.r
    rgba[offset + 1] = color.g
    rgba[offset + 2] = color.b
    rgba[offset + 3] = 255
  }

  ctx.putImageData(imageData, 0, 0)
}

function scheduleDraw(frame: MapFrameData | null) {
  pendingFrame = frame
  if (frameRequestId !== null) {
    return
  }

  frameRequestId = window.requestAnimationFrame(() => {
    frameRequestId = null
    if (!pendingFrame) {
      return
    }

    const nextFrame = pendingFrame
    pendingFrame = null
    drawMap(nextFrame)
  })
}

watch(
  () => props.mapFrame,
  (nextFrame) => {
    scheduleDraw(nextFrame)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (frameRequestId !== null) {
    window.cancelAnimationFrame(frameRequestId)
    frameRequestId = null
  }
  pendingFrame = null
})
</script>
