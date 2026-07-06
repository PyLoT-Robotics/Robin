export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function normalizeYaw(yaw: number) {
  let normalized = yaw
  while (normalized > Math.PI) {
    normalized -= 2 * Math.PI
  }
  while (normalized < -Math.PI) {
    normalized += 2 * Math.PI
  }
  return normalized
}

export function quaternionToYaw(
  rotation: { x?: number; y?: number; z?: number; w?: number } | undefined,
) {
  if (!rotation) {
    return 0
  }

  const x = typeof rotation.x === 'number' ? rotation.x : 0
  const y = typeof rotation.y === 'number' ? rotation.y : 0
  const z = typeof rotation.z === 'number' ? rotation.z : 0
  const w = typeof rotation.w === 'number' ? rotation.w : 1

  const sinyCosp = 2 * (w * z + x * y)
  const cosyCosp = 1 - 2 * (y * y + z * z)
  return Math.atan2(sinyCosp, cosyCosp)
}

export function yawToQuaternion(yaw: number) {
  const half = yaw / 2
  return {
    x: 0,
    y: 0,
    z: Math.sin(half),
    w: Math.cos(half),
  }
}
