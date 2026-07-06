<template>
  <div class="w-full h-full flex flex-col text-zinc-400">
    <div class="flex flex-wrap justify-center border-b border-border">
      <button
        class="flex flex-row items-center gap-2 border-x border-border px-4 py-2 transition-colors"
        :class="isInitialPoseMode ? 'bg-orange-500/30 text-orange-200' : ''"
        @click="toggleInitialPoseMode"
      >
        <Icon icon="bi:pin-map-fill" class="size-4" />
        <p class="text-2xl">2D Pose Estimate</p>
      </button>
      <button
        class="flex flex-row items-center gap-2 border-x border-border px-4 py-2 transition-colors"
        :class="isNav2GoalMode ? 'bg-sky-500/30 text-sky-100' : ''"
        @click="toggleNav2GoalMode"
      >
        <Icon icon="bi:flag-fill" class="size-4" />
        <p class="text-2xl">Nav2 Goal</p>
      </button>
    </div>
    <div
      ref="viewport"
      class="relative touch-none grow overflow-hidden"
      :style="{ cursor: viewportCursor }"
      @wheel.prevent="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @pointerleave="handlePointerUp"
      @dblclick="fitMapToViewport"
    >
      <BaseMapLayer :layer-style="canvasTransformStyle" :map-frame="currentMapFrame" />
      <CostmapLayer
        :layer-style="canvasTransformStyle"
        :map-width="mapWidth"
        :map-height="mapHeight"
        :map-frame-id="mapFrameId"
        :map-resolution="mapResolution"
        :map-origin-x="mapOriginX"
        :map-origin-y="mapOriginY"
        :map-origin-yaw="mapOriginYaw"
        :global-costmap="latestGlobalCostmap"
        :local-costmap="latestLocalCostmap"
        :tf-transforms="tfTransforms"
        :tf-version="tfVersion"
      />
      <ScanLayer
        :layer-style="canvasTransformStyle"
        :map-width="mapWidth"
        :map-height="mapHeight"
        :map-frame-id="mapFrameId"
        :map-resolution="mapResolution"
        :map-origin-x="mapOriginX"
        :map-origin-y="mapOriginY"
        :map-origin-yaw="mapOriginYaw"
        :latest-scan="latestScan"
        :tf-transforms="tfTransforms"
        :tf-version="tfVersion"
      />
      <GlobalPathLayer
        :layer-style="canvasTransformStyle"
        :map-width="mapWidth"
        :map-height="mapHeight"
        :map-frame-id="mapFrameId"
        :map-resolution="mapResolution"
        :map-origin-x="mapOriginX"
        :map-origin-y="mapOriginY"
        :map-origin-yaw="mapOriginYaw"
        :latest-global-path="latestGlobalPath"
        :tf-transforms="tfTransforms"
        :tf-version="tfVersion"
      />
      <PoseOverlayLayer
        :map-width="mapWidth"
        :map-height="mapHeight"
        :map-resolution="mapResolution"
        :map-origin-x="mapOriginX"
        :map-origin-y="mapOriginY"
        :map-origin-yaw="mapOriginYaw"
        :translate-x="translateX"
        :translate-y="translateY"
        :scale="scale"
        :map-rotation-deg="MAP_ROTATION_DEG"
        :robot-pose="robotPoseInMap"
        :is-pose-interaction-mode="isPoseInteractionMode"
        :is-pose-dragging="isPoseDragging"
        :is-initial-pose-mode="isInitialPoseMode"
        :pose-drag-start-screen="poseDragStartScreen"
        :pose-drag-current-screen="poseDragCurrentScreen"
        :tf-version="tfVersion"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Icon } from '@iconify/vue'
import BaseMapLayer from '@/components/map/layers/BaseMapLayer.vue'
import CostmapLayer from '@/components/map/layers/CostmapLayer.vue'
import ScanLayer from '@/components/map/layers/ScanLayer.vue'
import GlobalPathLayer from '@/components/map/layers/GlobalPathLayer.vue'
import PoseOverlayLayer from '@/components/map/layers/PoseOverlayLayer.vue'
import { useMapRos } from '@/hooks/useMapRos'
import {
  mapPixelToWorld,
  viewportPointToMapPixel as toMapPixelFromViewport,
} from '@/models/map/coordinates'
import { clamp } from '@/models/map/math'
import type { PoseInteractionMode, ScreenPoint } from '@/models/map/types'

const viewport = ref<HTMLDivElement>()
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const poseInteractionMode = ref<PoseInteractionMode>('none')
const isInitialPoseMode = computed(() => poseInteractionMode.value === 'initial_pose')
const isNav2GoalMode = computed(() => poseInteractionMode.value === 'nav2_goal')
const isPoseInteractionMode = computed(() => poseInteractionMode.value !== 'none')
const isPoseDragging = ref(false)

const MIN_SCALE = 0.25
const MAX_SCALE = 8
const MAP_ROTATION_DEG = -90

const {
  currentMapFrame,
  latestScan,
  latestGlobalCostmap,
  latestLocalCostmap,
  latestGlobalPath,
  tfTransforms,
  tfVersion,
  mapWidth,
  mapHeight,
  mapResolution,
  mapOriginX,
  mapOriginY,
  mapOriginYaw,
  mapFrameId,
  robotPoseInMap,
  sendPoseCommand,
} = useMapRos({
  onMapSizeChanged: fitMapToViewport,
})

const isDragging = ref(false)
let dragStartX = 0
let dragStartY = 0
let dragOriginX = 0
let dragOriginY = 0
let activePointerId: number | null = null
const activeTouchPoints = new Map<number, { x: number; y: number }>()
let pinchDistance = 0
let pinchCenter: { x: number; y: number } | null = null
let poseDragStartScreen: ScreenPoint | null = null
let poseDragCurrentScreen: ScreenPoint | null = null
let poseDragStartWorld: { x: number; y: number } | null = null

const canvasTransformStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value}) rotate(${MAP_ROTATION_DEG}deg)`,
  transformOrigin: `${mapWidth.value / 2}px ${mapHeight.value / 2}px`,
  imageRendering: 'pixelated' as const,
}))

const viewportCursor = computed(() => {
  if (isPoseInteractionMode.value) {
    if (isPoseDragging.value) {
      return 'crosshair'
    }
    return 'cell'
  }
  if (isDragging.value) {
    return 'grabbing'
  }
  return 'grab'
})

function getRotatedMapSize() {
  const normalizedRotation = Math.abs(MAP_ROTATION_DEG) % 180
  if (normalizedRotation === 90) {
    return { width: mapHeight.value, height: mapWidth.value }
  }
  return { width: mapWidth.value, height: mapHeight.value }
}

function viewportClientPointToMapPixel(clientX: number, clientY: number) {
  if (!viewport.value || mapWidth.value <= 0 || mapHeight.value <= 0 || scale.value <= 0) {
    return null
  }

  const rect = viewport.value.getBoundingClientRect()
  const px = clientX - rect.left
  const py = clientY - rect.top

  return toMapPixelFromViewport(
    mapWidth.value,
    mapHeight.value,
    {
      translateX: translateX.value,
      translateY: translateY.value,
      scale: scale.value,
      rotationDeg: MAP_ROTATION_DEG,
    },
    px,
    py,
  )
}

function viewportPointToWorld(clientX: number, clientY: number) {
  const pixel = viewportClientPointToMapPixel(clientX, clientY)
  if (!pixel) {
    return null
  }
  return mapPixelToWorld(
    {
      width: mapWidth.value,
      height: mapHeight.value,
      resolution: mapResolution.value,
      originX: mapOriginX.value,
      originY: mapOriginY.value,
      originYaw: mapOriginYaw.value,
    },
    pixel.x,
    pixel.y,
  )
}

function toggleInitialPoseMode() {
  poseInteractionMode.value = isInitialPoseMode.value ? 'none' : 'initial_pose'
  isPoseDragging.value = false
  poseDragStartScreen = null
  poseDragCurrentScreen = null
  poseDragStartWorld = null
  activePointerId = null
}

function toggleNav2GoalMode() {
  poseInteractionMode.value = isNav2GoalMode.value ? 'none' : 'nav2_goal'
  isPoseDragging.value = false
  poseDragStartScreen = null
  poseDragCurrentScreen = null
  poseDragStartWorld = null
  activePointerId = null
}

function fitMapToViewport() {
  if (!viewport.value || mapWidth.value <= 0 || mapHeight.value <= 0) {
    return
  }

  const viewportWidth = viewport.value.clientWidth
  const viewportHeight = viewport.value.clientHeight
  if (viewportWidth <= 0 || viewportHeight <= 0) {
    return
  }

  const rotatedSize = getRotatedMapSize()
  const fitScale = clamp(
    Math.min(viewportWidth / rotatedSize.width, viewportHeight / rotatedSize.height),
    MIN_SCALE,
    MAX_SCALE,
  )

  scale.value = fitScale
  translateX.value = (viewportWidth - rotatedSize.width * fitScale) / 2
  translateY.value = (viewportHeight - rotatedSize.height * fitScale) / 2
}

function zoomAt(nextScale: number, centerX: number, centerY: number) {
  const safeScale = clamp(nextScale, MIN_SCALE, MAX_SCALE)
  const prevScale = scale.value
  if (safeScale === prevScale) {
    return
  }

  translateX.value = centerX - ((centerX - translateX.value) * safeScale) / prevScale
  translateY.value = centerY - ((centerY - translateY.value) * safeScale) / prevScale
  scale.value = safeScale
}

function handleWheel(event: WheelEvent) {
  if (!viewport.value) {
    return
  }

  const rect = viewport.value.getBoundingClientRect()
  const centerX = event.clientX - rect.left
  const centerY = event.clientY - rect.top
  const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1
  zoomAt(scale.value * zoomFactor, centerX, centerY)
}

function getPointerPositionInViewport(event: PointerEvent) {
  if (!viewport.value) {
    return null
  }
  const rect = viewport.value.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}

function readPinchState() {
  const points = Array.from(activeTouchPoints.values())
  const a = points[0]
  const b = points[1]
  if (!a || !b) {
    return null
  }

  const dx = b.x - a.x
  const dy = b.y - a.y
  const distance = Math.hypot(dx, dy)
  if (!Number.isFinite(distance) || distance <= 0) {
    return null
  }

  return {
    distance,
    center: {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    },
  }
}

function resetPinchState() {
  pinchDistance = 0
  pinchCenter = null
}

function beginPinchIfReady() {
  const pinch = readPinchState()
  if (!pinch) {
    return false
  }

  pinchDistance = pinch.distance
  pinchCenter = pinch.center
  isDragging.value = false
  activePointerId = null
  return true
}

function updatePinchGesture() {
  if (activeTouchPoints.size < 2) {
    return false
  }

  const pinch = readPinchState()
  if (!pinch) {
    return false
  }

  if (pinchDistance <= 0 || !pinchCenter) {
    pinchDistance = pinch.distance
    pinchCenter = pinch.center
    return true
  }

  const centerDx = pinch.center.x - pinchCenter.x
  const centerDy = pinch.center.y - pinchCenter.y
  translateX.value += centerDx
  translateY.value += centerDy

  const zoomRatio = pinch.distance / pinchDistance
  zoomAt(scale.value * zoomRatio, pinch.center.x, pinch.center.y)

  pinchDistance = pinch.distance
  pinchCenter = pinch.center
  return true
}

function handlePointerDown(event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return
  }

  if (!viewport.value) {
    return
  }

  viewport.value.setPointerCapture(event.pointerId)

  const pointerPosition = getPointerPositionInViewport(event)

  if (!isPoseInteractionMode.value && event.pointerType === 'touch' && pointerPosition) {
    activeTouchPoints.set(event.pointerId, pointerPosition)

    if (activeTouchPoints.size >= 2) {
      beginPinchIfReady()
      return
    }
  }

  if (isPoseInteractionMode.value) {
    const world = viewportPointToWorld(event.clientX, event.clientY)
    if (!world) {
      return
    }

    const rect = viewport.value.getBoundingClientRect()
    poseDragStartScreen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    poseDragCurrentScreen = { ...poseDragStartScreen }
    poseDragStartWorld = world
    isPoseDragging.value = true
    activePointerId = event.pointerId
    return
  }

  isDragging.value = true
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragOriginX = translateX.value
  dragOriginY = translateY.value
  activePointerId = event.pointerId
}

function handlePointerMove(event: PointerEvent) {
  if (!isPoseInteractionMode.value && event.pointerType === 'touch') {
    const pointerPosition = getPointerPositionInViewport(event)
    if (pointerPosition) {
      activeTouchPoints.set(event.pointerId, pointerPosition)
    }

    if (activeTouchPoints.size >= 2) {
      updatePinchGesture()
      return
    }
  }

  if (isPoseInteractionMode.value) {
    if (!isPoseDragging.value || event.pointerId !== activePointerId || !viewport.value) {
      return
    }
    const rect = viewport.value.getBoundingClientRect()
    poseDragCurrentScreen = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
    return
  }

  if (!isDragging.value || event.pointerId !== activePointerId) {
    return
  }

  translateX.value = dragOriginX + (event.clientX - dragStartX)
  translateY.value = dragOriginY + (event.clientY - dragStartY)
}

function handlePointerUp(event: PointerEvent) {
  if (viewport.value && viewport.value.hasPointerCapture(event.pointerId)) {
    viewport.value.releasePointerCapture(event.pointerId)
  }

  if (!isPoseInteractionMode.value && event.pointerType === 'touch') {
    activeTouchPoints.delete(event.pointerId)

    if (activeTouchPoints.size >= 2) {
      beginPinchIfReady()
      return
    }

    resetPinchState()

    if (activeTouchPoints.size === 1) {
      const remaining = activeTouchPoints.entries().next().value
      if (remaining) {
        activePointerId = remaining[0]
        dragStartX = remaining[1].x
        dragStartY = remaining[1].y
        dragOriginX = translateX.value
        dragOriginY = translateY.value
        isDragging.value = true
        return
      }
    }
  }

  if (isPoseInteractionMode.value) {
    if (!isPoseDragging.value || event.pointerId !== activePointerId) {
      return
    }

    const startWorld = poseDragStartWorld
    const endWorld = viewportPointToWorld(event.clientX, event.clientY)
    if (startWorld && endWorld) {
      const dx = endWorld.x - startWorld.x
      const dy = endWorld.y - startWorld.y
      const yaw = Math.hypot(dx, dy) < 1e-4 ? 0 : Math.atan2(dy, dx)
      if (isInitialPoseMode.value) {
        sendPoseCommand('initial_pose', startWorld, yaw)
      } else if (isNav2GoalMode.value) {
        sendPoseCommand('nav2_goal', startWorld, yaw)
      }
    }

    isPoseDragging.value = false
    poseDragStartScreen = null
    poseDragCurrentScreen = null
    poseDragStartWorld = null
    activePointerId = null
    activeTouchPoints.clear()
    resetPinchState()
    return
  }

  isDragging.value = false
  activePointerId = null
}

onMounted(async () => {
  window.addEventListener('resize', fitMapToViewport)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fitMapToViewport)

  activeTouchPoints.clear()
  resetPinchState()
})
</script>
