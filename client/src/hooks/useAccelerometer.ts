import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { DeviceOrientation, MotionPermissionState, Vector3 } from '@/models/motion'

export function useAccelerometer(){
    const acceleration = reactive<Vector3>({ x: 0, y: 0, z: 0 })
    const orientation = reactive<DeviceOrientation>({
      alpha: 0,
      beta: 0,
      gamma: 0,
      available: false,
    })
    const permissionState = ref<MotionPermissionState>('unknown')
    let isListening = false
    
    const statusText = computed(() => {
      switch (permissionState.value) {
        case 'unsupported':
          return 'This browser/device does not support DeviceMotionEvent.'
        case 'required':
          return 'Permission required. Tap the button to enable motion sensor.'
        case 'denied':
          return 'Permission denied. Please allow Motion & Orientation access in browser settings.'
        case 'granted':
          return 'Receiving sensor values from your device.'
        default:
          return 'Checking sensor availability...'
      }
    })
    
    function handleMotion(event: DeviceMotionEvent): void {
      const accel = event.acceleration
      acceleration.x = accel?.x ?? 0
      acceleration.y = accel?.y ?? 0
      acceleration.z = accel?.z ?? 0
    }

    function handleOrientation(event: DeviceOrientationEvent): void {
      const hasOrientation =
        event.alpha !== null
        && event.beta !== null
        && event.gamma !== null

      if (!hasOrientation) {
        orientation.available = false
        return
      }

      orientation.alpha = event.alpha
      orientation.beta = event.beta
      orientation.gamma = event.gamma
      orientation.available = true
    }
    
    function startListening(): void {
      if (isListening || typeof window === 'undefined') return
      window.addEventListener('devicemotion', handleMotion)
      window.addEventListener('deviceorientation', handleOrientation)
      isListening = true
    }
    
    async function requestPermissionAndStart(): Promise<void> {
      if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
        permissionState.value = 'unsupported'
        return
      }
    
      const deviceMotionCtor = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }
      const deviceOrientationCtor = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }
    
      if (!deviceMotionCtor.requestPermission) {
        permissionState.value = 'granted'
        startListening()
        return
      }
    
      try {
        const motionResult = await deviceMotionCtor.requestPermission()
        const orientationResult = deviceOrientationCtor.requestPermission
          ? await deviceOrientationCtor.requestPermission()
          : 'granted'

        if (motionResult === 'granted' && orientationResult === 'granted') {
          permissionState.value = 'granted'
          startListening()
          return
        }
        permissionState.value = 'denied'
      } catch {
        permissionState.value = 'denied'
      }
    }
    
    onMounted(() => {
      if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
        permissionState.value = 'unsupported'
        return
      }
    
      const deviceMotionCtor = DeviceMotionEvent as typeof DeviceMotionEvent & {
        requestPermission?: () => Promise<'granted' | 'denied'>
      }
    
      if (deviceMotionCtor.requestPermission) {
        permissionState.value = 'required'
        return
      }
    
      permissionState.value = 'granted'
      startListening()
    })
    
    onBeforeUnmount(() => {
      if (typeof window === 'undefined' || !isListening) return
      window.removeEventListener('devicemotion', handleMotion)
      window.removeEventListener('deviceorientation', handleOrientation)
      isListening = false
    })

    return {
        acceleration,
        orientation,
        statusText,
        permissionState,
        requestPermissionAndStart
    }
}
