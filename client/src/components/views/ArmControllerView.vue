<template>
  <div class="w-full h-full flex flex-col text-zinc-100">
    <div class="flex flex-col">
      <div class="text-zinc-300 flex flex-row gap-1 px-4 py-2 border-b border-border">
        <p>Status:</p>
        <p>{{ statusText }}</p>
      </div>
      <button
        v-if="permissionState === 'required'"
        class="border-b border-border px-4 py-2 text-zinc-200 bg-zinc-900"
        @click="requestPermissionAndStart">
        Enable Motion Sensor
      </button>
    </div>
    <div class="flex flex-col grow overflow-y-auto">
      <PositionVectorView
        :position="position"
        :orientation="orientation"/>
      <div class="border-b border-border px-4 py-3 flex flex-col gap-3">
        <div class="flex flex-row items-center justify-between">
          <p class="text-zinc-300">Position Sliders (±30cm)</p>
          <button
            class="text-sm border border-border px-3 py-1 rounded text-zinc-200"
            @click="sliderLocked = !sliderLocked">
            {{ sliderLocked ? 'Unlock' : 'Lock' }}
          </button>
        </div>
        <div class="flex flex-col gap-2">
          <div class="flex flex-col gap-1">
            <div class="flex flex-row items-center justify-between text-sm text-zinc-300">
              <p>X</p>
              <p>{{ Math.round(position.x * 100) }} cm</p>
            </div>
            <input
              class="w-full"
              type="range"
              :min="-positionLimit"
              :max="positionLimit"
              :step="0.01"
              :value="position.x"
              :disabled="sliderLocked"
              @input="updatePositionAxis('x', $event)"/>
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex flex-row items-center justify-between text-sm text-zinc-300">
              <p>Y</p>
              <p>{{ Math.round(position.y * 100) }} cm</p>
            </div>
            <input
              class="w-full"
              type="range"
              :min="-positionLimit"
              :max="positionLimit"
              :step="0.01"
              :value="position.y"
              :disabled="sliderLocked"
              @input="updatePositionAxis('y', $event)"/>
          </div>
          <div class="flex flex-col gap-1">
            <div class="flex flex-row items-center justify-between text-sm text-zinc-300">
              <p>Z</p>
              <p>{{ Math.round(position.z * 100) }} cm</p>
            </div>
            <input
              class="w-full"
              type="range"
              :min="-positionLimit"
              :max="positionLimit"
              :step="0.01"
              :value="position.z"
              :disabled="sliderLocked"
              @input="updatePositionAxis('z', $event)"/>
          </div>
        </div>
      </div>
      <AccelChart
        :acceleration="acceleration"/>
      <VelocityChart
        :velocity="velocity"/>
    </div>
    <div class="flex flex-row border-border border-y">
      <button
        class="grow border-border bg-black border-x-[0.5px] h-12"
        @click="isPublishingTopic = !isPublishingTopic">
        <div
          class="flex flex-row gap-2 items-center justify-center select-none w-full h-full border-green-400 transition-all duration-200"
          :class="{
            'border-4': isPublishingTopic,
            'border-0': !isPublishingTopic
          }">
          <div class="relative">
            <Icon
              icon="bi:broadcast-pin"/>
            <div class="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 size-3 rounded-full bg-black grid place-content-center">
              <Icon
                class="text-sm"
                :class="{
                  'text-green-500': isPublishingTopic,
                  'text-red-500': !isPublishingTopic
                }"
                :icon="isPublishingTopic ? 'bi:check' : 'bi:x'"/>
            </div>
          </div>
          <p>{{
            isPublishingTopic
              ? "Publishing Topic"
              : "Not Publishing Topic"
          }}</p>
        </div>
      </button>
      <button
        class="border-border border-x-[0.5px] px-4"
        @click="resetPosition"
      >
        <Icon
          icon="bi:arrow-clockwise"
          class="text-xl"/>
      </button>
    </div>
    <button
      class="grid place-content-center grow text-4xl select-none basis-52 min-h-52 transition-all duration-100 border-orange-400"
      @pointerdown="startMove"
      @pointerup="stopMove"
      @pointercancel="stopMove"
      @pointerleave="stopMove"
      :class="{
        'bg-amber-600/0 border-0': !moveActive,
        'bg-amber-500/30 border-4': moveActive,
      }">
      Move
    </button>
  </div>
</template>
<script setup lang="ts">
import AccelChart from '@/components/armController/accelChart.vue'
import PositionVectorView from '@/components/armController/positionVectorView.vue'
import VelocityChart from '@/components/armController/velocityChart.vue'
import { useAccelerometer } from '@/hooks/useAccelerometer'
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useTopicPublisher } from '@/hooks/useTopicPublisher'
import { Icon } from '@iconify/vue'
import type { Vector3 } from '@/models/motion'

const isPublishingTopic = ref(false)
const armControllerPositionTopicName = '/luna_arm_custom_ik_pose_commander/target_delta'
const armControllerTopic = useTopicPublisher<Vector3>(
  armControllerPositionTopicName,
  'geometry_msgs/Vector3',
)

const moveActive = ref(false)

function startMove(): void {
  moveActive.value = true
}

function stopMove(): void {
  moveActive.value = false
  velocity.x = 0
  velocity.y = 0
  velocity.z = 0
}

function resetPosition(): void {
  position.x = 0
  position.y = 0
  position.z = 0
  velocity.x = 0
  velocity.y = 0
  velocity.z = 0
}

const { acceleration: _acceleration, orientation, statusText, permissionState, requestPermissionAndStart } = useAccelerometer()

const acceleration = reactive<Vector3>({ x: 0, y: 0, z: 0 })
const velocity = reactive<Vector3>({ x: 0, y: 0, z: 0 })
const position = reactive<Vector3>({ x: 0, y: 0, z: 0 })
const sliderLocked = ref(true)
const positionLimit = 0.3
const tps = 20
const dt = 1 / tps

const deadBandThreshold = 0.04
function applyDeadband(value: number){
  if (Math.abs(value) < deadBandThreshold) {
    return 0
  }
  return value
}

function clampPosition(value: number): number {
  return Math.max(-positionLimit, Math.min(positionLimit, value))
}

function updatePositionAxis(axis: keyof Vector3, event: Event): void {
  const target = event.target as HTMLInputElement
  const parsed = Number.parseFloat(target.value)
  if (Number.isNaN(parsed)) {
    return
  }
  position[axis] = clampPosition(parsed)
  velocity[axis] = 0
}

function rotateAccelerationByOrientation(accel: Vector3): Vector3 {
  if (!orientation.available) {
    return accel
  }

  const alpha = orientation.alpha * Math.PI / 180
  const beta = orientation.beta * Math.PI / 180
  const gamma = orientation.gamma * Math.PI / 180

  const ca = Math.cos(alpha)
  const sa = Math.sin(alpha)
  const cb = Math.cos(beta)
  const sb = Math.sin(beta)
  const cg = Math.cos(gamma)
  const sg = Math.sin(gamma)

  const r11 = ca * cg - sa * sb * sg
  const r12 = -cb * sa
  const r13 = ca * sg + cg * sa * sb

  const r21 = cg * sa + ca * sb * sg
  const r22 = ca * cb
  const r23 = sa * sg - ca * cg * sb

  const r31 = -cb * sg
  const r32 = sb
  const r33 = cb * cg

  return {
    x: r11 * accel.x + r12 * accel.y + r13 * accel.z,
    y: r21 * accel.x + r22 * accel.y + r23 * accel.z,
    z: r31 * accel.x + r32 * accel.y + r33 * accel.z,
  }
}

function mapDeviceAxesToController(accel: Vector3): Vector3 {
  return {
    x: -accel.y,
    y: accel.x,
    z: -accel.z,
  }
}

function loop(){
  const rotated = mapDeviceAxesToController(
    rotateAccelerationByOrientation({
      x: _acceleration.x,
      y: _acceleration.y,
      z: _acceleration.z,
    }),
  )

  const accelX = rotated.x
  const accelY = rotated.y
  const accelZ = rotated.z

  const accelerationAlpha = 0.8
  acceleration.x = applyDeadband(accelX * accelerationAlpha + acceleration.x * (1 - accelerationAlpha))
  acceleration.y = applyDeadband(accelY * accelerationAlpha + acceleration.y * (1 - accelerationAlpha))
  acceleration.z = applyDeadband(accelZ * accelerationAlpha + acceleration.z * (1 - accelerationAlpha))

  if (moveActive.value) {
    velocity.x += acceleration.x * dt
    velocity.y += acceleration.y * dt
    velocity.z += acceleration.z * dt

    position.x = clampPosition(position.x + velocity.x * dt)
    position.y = clampPosition(position.y + velocity.y * dt)
    position.z = clampPosition(position.z + velocity.z * dt)
  } else {
    velocity.x = 0
    velocity.y = 0
    velocity.z = 0
  }

  if( isPublishingTopic.value && moveActive.value ){
    armControllerTopic.publish({
      x: position.x,
      y: position.y,
      z: position.z,
    })
  }
}

let interval: number | null = null
onMounted(() => {
  interval = window.setInterval(loop, 1000 / tps)
})
onBeforeUnmount(() => {
  if (interval !== null) {
    window.clearInterval(interval)
    interval = null
  }
})
</script>
