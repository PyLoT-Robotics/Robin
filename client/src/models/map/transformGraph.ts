import { normalizeYaw } from './math'
import type { Pose2D } from './types'

export function normalizeFrameId(frameId: string | undefined) {
  if (!frameId) {
    return ''
  }
  return frameId.replace(/^\/+/, '')
}

export function composePose(a: Pose2D, b: Pose2D): Pose2D {
  const cosA = Math.cos(a.yaw)
  const sinA = Math.sin(a.yaw)
  return {
    x: a.x + cosA * b.x - sinA * b.y,
    y: a.y + sinA * b.x + cosA * b.y,
    yaw: normalizeYaw(a.yaw + b.yaw),
  }
}

export function invertPose(pose: Pose2D): Pose2D {
  const cosYaw = Math.cos(pose.yaw)
  const sinYaw = Math.sin(pose.yaw)
  return {
    x: -(cosYaw * pose.x + sinYaw * pose.y),
    y: sinYaw * pose.x - cosYaw * pose.y,
    yaw: normalizeYaw(-pose.yaw),
  }
}

export function setTransform(
  transforms: Map<string, Pose2D>,
  parentFrame: string | undefined,
  childFrame: string | undefined,
  pose: Pose2D,
) {
  const parent = normalizeFrameId(parentFrame)
  const child = normalizeFrameId(childFrame)
  if (!parent || !child) {
    return
  }
  transforms.set(`${parent}|${child}`, pose)
}

export function resolveTransform(
  transforms: Map<string, Pose2D>,
  targetFrame: string,
  sourceFrame: string,
) {
  const source = normalizeFrameId(sourceFrame)
  const target = normalizeFrameId(targetFrame)
  if (!source || !target) {
    return null
  }
  if (source === target) {
    return { x: 0, y: 0, yaw: 0 }
  }

  const queue: Array<{ frame: string; pose: Pose2D }> = [
    {
      frame: source,
      pose: { x: 0, y: 0, yaw: 0 },
    },
  ]
  const visited = new Set<string>([source])

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) {
      break
    }

    if (current.frame === target) {
      return current.pose
    }

    for (const [key, pose] of transforms) {
      const separator = key.indexOf('|')
      const parent = key.slice(0, separator)
      const child = key.slice(separator + 1)

      if (child === current.frame && !visited.has(parent)) {
        visited.add(parent)
        queue.push({
          frame: parent,
          pose: composePose(pose, current.pose),
        })
      }

      if (parent === current.frame && !visited.has(child)) {
        visited.add(child)
        queue.push({
          frame: child,
          pose: composePose(invertPose(pose), current.pose),
        })
      }
    }
  }

  return null
}
