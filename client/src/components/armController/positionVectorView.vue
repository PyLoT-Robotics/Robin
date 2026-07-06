<template>
  <div class="flex flex-col">
    <div ref="container" class="h-72 w-full border-border border-b"/>
    <div class="flex flex-col gap-1 py-2 px-4 border-b border-border">
      <p class="text-xs text-zinc-400">
        X : <span class="text-red-400">{{ position.x.toFixed(3) }}</span>
        Y : <span class="ml-3 text-green-400">{{ position.y.toFixed(3) }}</span>
        Z : <span class="ml-3 text-blue-400">{{ position.z.toFixed(3) }}</span>
      </p>
      <p class="text-xs text-zinc-500">
        Orientation:
        α <span class="text-zinc-300">{{ orientation.available ? orientation.alpha.toFixed(1) : '--' }}</span>
        β <span class="text-zinc-300">{{ orientation.available ? orientation.beta.toFixed(1) : '--' }}</span>
        γ <span class="text-zinc-300">{{ orientation.available ? orientation.gamma.toFixed(1) : '--' }}</span>
      </p>
    </div>
  </div>
</template>
<script setup lang="ts">
import * as THREE from 'three'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DeviceOrientation, Vector3 } from '@/models/motion'
import type {
  ThreeCameraLike,
  ThreeQuaternionLike,
  ThreeRendererLike,
  ThreeSceneLike,
} from '@/models/three'

const { position, orientation } = defineProps<{
  position: Vector3
  orientation: DeviceOrientation
}>()

const container = ref<HTMLDivElement | null>(null)

let scene: ThreeSceneLike | null = null
let camera: ThreeCameraLike | null = null
let renderer: ThreeRendererLike | null = null
let resizeObserver: ResizeObserver | null = null

let positionPoint: THREE.Mesh | null = null
let projectionLine: THREE.Line | null = null
let xAxisGuide: THREE.Line | null = null
let yAxisGuide: THREE.Line | null = null
const referenceObjects: THREE.Object3D[] = []

const ORIGIN = new THREE.Vector3(0, 0, 0)
const SCALE = 3
const POSITION_LIMIT = 0.3
const AXIS_LENGTH = POSITION_LIMIT * SCALE
const BASE_CAMERA_POSITION = new THREE.Vector3(0, 3, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const WORLD_UP = new THREE.Vector3(0, 0, 1)
const DEVICE_TO_WORLD_QUATERNION = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)) as unknown as ThreeQuaternionLike

let referenceQuaternionInverse: ThreeQuaternionLike | null = null

function renderScene(): void {
  if (!scene || !camera || !renderer) return
  renderer.render(scene, camera)
}

function controllerToScene(value: Vector3): THREE.Vector3 {
  // Controller X is scene-up, Y is scene-left, and Z is scene-forward.
  return new THREE.Vector3(value.y * SCALE, value.z * SCALE, value.x * SCALE)
}

function updatePositionMarker(): void {
  if (!positionPoint || !projectionLine || !xAxisGuide || !yAxisGuide) return

  const current = controllerToScene(position)
  const projectedToXy = controllerToScene({ x: position.x, y: position.y, z: 0 })
  const projectedToX = controllerToScene({ x: position.x, y: 0, z: 0 })
  const projectedToY = controllerToScene({ x: 0, y: position.y, z: 0 })
  positionPoint.position.copy(current)
  projectionLine.geometry.setFromPoints([projectedToXy, current])
  xAxisGuide.geometry.setFromPoints([projectedToXy, projectedToX])
  yAxisGuide.geometry.setFromPoints([projectedToXy, projectedToY])
}

function applyPositionToArrows(): void {
  updatePositionMarker()
  renderScene()
}

function createAxisLabel(text: string, color: string, position: THREE.Vector3): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    context.font = 'bold 72px system-ui'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = color
    context.fillText(text, 64, 64)
  }

  const texture = new THREE.CanvasTexture(canvas)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
  sprite.position.copy(position)
  sprite.scale.set(0.22, 0.22, 0.22)
  return sprite
}

function getScreenOrientationAngleRad(): number {
  if (typeof window === 'undefined') return 0

  if (window.screen.orientation && typeof window.screen.orientation.angle === 'number') {
    return window.screen.orientation.angle * Math.PI / 180
  }

  const legacyOrientation = window.orientation
  if (typeof legacyOrientation === 'number') {
    return legacyOrientation * Math.PI / 180
  }

  return 0
}

function createDeviceQuaternion(): ThreeQuaternionLike | null {
  if (!orientation.available) {
    return null
  }

  const alpha = orientation.alpha * Math.PI / 180
  const beta = orientation.beta * Math.PI / 180
  const gamma = orientation.gamma * Math.PI / 180
  const orient = getScreenOrientationAngleRad()

  const euler = new THREE.Euler(-beta, gamma, -alpha, 'YXZ')
  const deviceQuaternion = new THREE.Quaternion().setFromEuler(euler) as unknown as ThreeQuaternionLike
  const screenQuaternion = new THREE.Quaternion().setFromAxisAngle(Z_AXIS, -orient) as unknown as ThreeQuaternionLike

  deviceQuaternion.multiply(DEVICE_TO_WORLD_QUATERNION)
  deviceQuaternion.multiply(screenQuaternion)

  return deviceQuaternion
}

function applyOrientationToCamera(): void {
  if (!camera) return

  const deviceQuaternion = createDeviceQuaternion()

  if (!deviceQuaternion) {
    referenceQuaternionInverse = null
    camera.position.set(BASE_CAMERA_POSITION.x, BASE_CAMERA_POSITION.y, BASE_CAMERA_POSITION.z)
    camera.up.set(WORLD_UP.x, WORLD_UP.y, WORLD_UP.z)
    camera.lookAt(0, 0, 0)
    renderScene()
    return
  }

  if (!referenceQuaternionInverse) {
    referenceQuaternionInverse = deviceQuaternion.clone().invert()
  }

  const relativeQuaternion = referenceQuaternionInverse.clone().multiply(deviceQuaternion)

  const rotatedUp = WORLD_UP.clone().applyQuaternion(relativeQuaternion as any)
  camera.up.set(rotatedUp.x, rotatedUp.y, rotatedUp.z)

  const rotatedPosition = BASE_CAMERA_POSITION.clone().applyQuaternion(relativeQuaternion as any)

  camera.position.set(rotatedPosition.x, rotatedPosition.y, rotatedPosition.z)
  camera.lookAt(0, 0, 0)
  renderScene()
}

function handleScreenOrientationChange(): void {
  referenceQuaternionInverse = null
  applyOrientationToCamera()
}

function setupThree(): void {
  if (!container.value) return

  const width = container.value.clientWidth
  const height = container.value.clientHeight

  scene = new THREE.Scene() as unknown as ThreeSceneLike
  scene.background = new THREE.Color('#0a0a0a')

  camera = new THREE.PerspectiveCamera(48, width / height, 0.01, 100) as unknown as ThreeCameraLike
  camera.position.set(BASE_CAMERA_POSITION.x, BASE_CAMERA_POSITION.y, BASE_CAMERA_POSITION.z)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true }) as unknown as ThreeRendererLike
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height)

  container.value.appendChild(renderer.domElement)

  const ambientLight = new THREE.AmbientLight('#ffffff', 0.6)
  const directionalLight = new THREE.DirectionalLight('#ffffff', 0.6)
  directionalLight.position.set(2, 3, 2)

  const grid = new THREE.GridHelper(4, 8, '#27272a', '#18181b')

  const referenceX = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), ORIGIN, AXIS_LENGTH, '#7f1d1d', 0.12, 0.06)
  const referenceY = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), ORIGIN, AXIS_LENGTH, '#14532d', 0.12, 0.06)
  const referenceZ = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), ORIGIN, AXIS_LENGTH, '#1e3a8a', 0.12, 0.06)
  const referenceNegativeX = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), ORIGIN, AXIS_LENGTH, '#7f1d1d', 0.12, 0.06)
  const referenceNegativeY = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), ORIGIN, AXIS_LENGTH, '#14532d', 0.12, 0.06)
  const referenceNegativeZ = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), ORIGIN, AXIS_LENGTH, '#1e3a8a', 0.12, 0.06)
  const xLabel = createAxisLabel('X', '#ef4444', new THREE.Vector3(0, 0, AXIS_LENGTH + 0.12))
  const yLabel = createAxisLabel('Y', '#22c55e', new THREE.Vector3(AXIS_LENGTH + 0.12, 0, 0))
  const zLabel = createAxisLabel('Z', '#3b82f6', new THREE.Vector3(0, AXIS_LENGTH + 0.12, 0))
  referenceObjects.push(
    referenceX,
    referenceY,
    referenceZ,
    referenceNegativeX,
    referenceNegativeY,
    referenceNegativeZ,
    xLabel,
    yLabel,
    zLabel,
  )

  scene.add(ambientLight)
  scene.add(directionalLight)
  scene.add(grid)
  referenceObjects.forEach((object) => scene?.add(object))
  positionPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 20, 12),
    new THREE.MeshBasicMaterial({ color: '#f8fafc' }),
  )
  projectionLine = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: '#a1a1aa', transparent: true, opacity: 0.8 }),
  )
  xAxisGuide = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: '#ef4444', transparent: true, opacity: 0.65 }),
  )
  yAxisGuide = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: '#22c55e', transparent: true, opacity: 0.65 }),
  )
  scene.add(positionPoint)
  scene.add(projectionLine)
  scene.add(xAxisGuide)
  scene.add(yAxisGuide)

  resizeObserver = new ResizeObserver(() => {
    if (!container.value || !camera || !renderer) return
    const nextWidth = container.value.clientWidth
    const nextHeight = container.value.clientHeight
    camera.aspect = nextWidth / nextHeight
    camera.updateProjectionMatrix()
    renderer.setSize(nextWidth, nextHeight)
    renderScene()
  })
  resizeObserver.observe(container.value)

  applyPositionToArrows()
  applyOrientationToCamera()
}

onMounted(() => {
  setupThree()
  window.addEventListener('orientationchange', handleScreenOrientationChange)
})

watch(
  () => ({ x: position.x, y: position.y, z: position.z }),
  () => {
    applyPositionToArrows()
  },
  { deep: false },
)

watch(
  () => ({
    alpha: orientation.alpha,
    beta: orientation.beta,
    gamma: orientation.gamma,
    available: orientation.available,
  }),
  () => {
    applyOrientationToCamera()
  },
  { deep: false },
)

onBeforeUnmount(() => {
  window.removeEventListener('orientationchange', handleScreenOrientationChange)
  resizeObserver?.disconnect()
  resizeObserver = null

  if (renderer?.domElement && container.value?.contains(renderer.domElement)) {
    container.value.removeChild(renderer.domElement)
  }

  renderer?.dispose()
  positionPoint?.geometry.dispose()
  ;(positionPoint?.material as THREE.Material | undefined)?.dispose()
  projectionLine?.geometry.dispose()
  ;(projectionLine?.material as THREE.Material | undefined)?.dispose()
  xAxisGuide?.geometry.dispose()
  ;(xAxisGuide?.material as THREE.Material | undefined)?.dispose()
  yAxisGuide?.geometry.dispose()
  ;(yAxisGuide?.material as THREE.Material | undefined)?.dispose()
  for (const object of referenceObjects) {
    if (object instanceof THREE.Sprite) {
      object.material.map?.dispose()
      object.material.dispose()
    }
  }
  referenceObjects.length = 0
  positionPoint = null
  projectionLine = null
  xAxisGuide = null
  yAxisGuide = null
  renderer = null
  camera = null
  scene = null
})
</script>
