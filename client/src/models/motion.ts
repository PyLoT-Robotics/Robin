export type Vector3 = {
  x: number
  y: number
  z: number
}

export type DeviceOrientation = {
  alpha: number
  beta: number
  gamma: number
  available: boolean
}

export type MotionPermissionState =
  | 'unknown'
  | 'required'
  | 'granted'
  | 'denied'
  | 'unsupported'
