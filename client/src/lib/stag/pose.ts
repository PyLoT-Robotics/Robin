import type {
  CameraIntrinsics,
  Point2,
  Quaternion,
  StagCameraPose,
  Vector3,
} from './types'

type Matrix3 = [number, number, number, number, number, number, number, number, number]

export function intrinsicsFromHorizontalFov(
  width: number,
  height: number,
  horizontalFovDegrees = 60,
): CameraIntrinsics {
  const focalLength = width / (2 * Math.tan(horizontalFovDegrees * Math.PI / 360))
  return { fx: focalLength, fy: focalLength, cx: width / 2, cy: height / 2 }
}

function solveLinearSystem(matrix: number[][], values: number[]): number[] | null {
  const size = values.length
  const augmented = matrix.map((row, index) => [...row, values[index]])

  for (let column = 0; column < size; column++) {
    let pivot = column
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null
    ;[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]]

    const scale = augmented[column][column]
    for (let item = column; item <= size; item++) augmented[column][item] /= scale
    for (let row = 0; row < size; row++) {
      if (row === column) continue
      const factor = augmented[row][column]
      for (let item = column; item <= size; item++) {
        augmented[row][item] -= factor * augmented[column][item]
      }
    }
  }
  return augmented.map((row) => row[size])
}

export function homographyFromPoints(source: Point2[], target: Point2[]): Matrix3 | null {
  if (source.length !== 4 || target.length !== 4) return null
  const matrix: number[][] = []
  const values: number[] = []
  for (let index = 0; index < 4; index++) {
    const { x, y } = source[index]
    const { x: u, y: v } = target[index]
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    values.push(u)
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    values.push(v)
  }
  const result = solveLinearSystem(matrix, values)
  return result
    ? [result[0], result[1], result[2], result[3], result[4], result[5], result[6], result[7], 1]
    : null
}

export function projectPoint(homography: Matrix3, point: Point2): Point2 {
  const denominator = homography[6] * point.x + homography[7] * point.y + homography[8]
  return {
    x: (homography[0] * point.x + homography[1] * point.y + homography[2]) / denominator,
    y: (homography[3] * point.x + homography[4] * point.y + homography[5]) / denominator,
  }
}

function norm(vector: Vector3) {
  return Math.hypot(vector.x, vector.y, vector.z)
}

function scale(vector: Vector3, amount: number): Vector3 {
  return { x: vector.x * amount, y: vector.y * amount, z: vector.z * amount }
}

function dot(left: Vector3, right: Vector3) {
  return left.x * right.x + left.y * right.y + left.z * right.z
}

function normalize(vector: Vector3): Vector3 {
  const length = norm(vector)
  return scale(vector, 1 / Math.max(length, 1e-12))
}

function cross(left: Vector3, right: Vector3): Vector3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  }
}

function quaternionFromRotation(rotation: Matrix3): Quaternion {
  const trace = rotation[0] + rotation[4] + rotation[8]
  let x: number
  let y: number
  let z: number
  let w: number
  if (trace > 0) {
    const amount = Math.sqrt(trace + 1) * 2
    w = amount / 4
    x = (rotation[7] - rotation[5]) / amount
    y = (rotation[2] - rotation[6]) / amount
    z = (rotation[3] - rotation[1]) / amount
  } else if (rotation[0] > rotation[4] && rotation[0] > rotation[8]) {
    const amount = Math.sqrt(1 + rotation[0] - rotation[4] - rotation[8]) * 2
    w = (rotation[7] - rotation[5]) / amount
    x = amount / 4
    y = (rotation[1] + rotation[3]) / amount
    z = (rotation[2] + rotation[6]) / amount
  } else if (rotation[4] > rotation[8]) {
    const amount = Math.sqrt(1 + rotation[4] - rotation[0] - rotation[8]) * 2
    w = (rotation[2] - rotation[6]) / amount
    x = (rotation[1] + rotation[3]) / amount
    y = amount / 4
    z = (rotation[5] + rotation[7]) / amount
  } else {
    const amount = Math.sqrt(1 + rotation[8] - rotation[0] - rotation[4]) * 2
    w = (rotation[3] - rotation[1]) / amount
    x = (rotation[2] + rotation[6]) / amount
    y = (rotation[5] + rotation[7]) / amount
    z = amount / 4
  }
  return { x, y, z, w }
}

function transpose(matrix: Matrix3): Matrix3 {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ]
}

function eulerFromRotation(rotation: Matrix3) {
  const pitch = Math.asin(Math.max(-1, Math.min(1, -rotation[6])))
  const cosine = Math.cos(pitch)
  if (Math.abs(cosine) > 1e-6) {
    return {
      roll: Math.atan2(rotation[7], rotation[8]),
      pitch,
      yaw: Math.atan2(rotation[3], rotation[0]),
    }
  }
  return { roll: Math.atan2(-rotation[5], rotation[4]), pitch, yaw: 0 }
}

/**
 * Decompose a planar marker homography without OpenCV. The returned transform
 * is the phone camera in marker coordinates (+x right, +y up, +z out of paper).
 */
export function estimateCameraPose(
  corners: [Point2, Point2, Point2, Point2],
  markerSizeMeters: number,
  intrinsics: CameraIntrinsics,
): StagCameraPose | undefined {
  const half = markerSizeMeters / 2
  const markerPoints: Point2[] = [
    { x: -half, y: half },
    { x: half, y: half },
    { x: half, y: -half },
    { x: -half, y: -half },
  ]
  const homography = homographyFromPoints(markerPoints, corners)
  if (!homography) return undefined

  const cameraColumn = (column: 0 | 1 | 2): Vector3 => {
    const h0 = homography[column]
    const h1 = homography[3 + column]
    const h2 = homography[6 + column]
    return {
      x: (h0 - intrinsics.cx * h2) / intrinsics.fx,
      y: (h1 - intrinsics.cy * h2) / intrinsics.fy,
      z: h2,
    }
  }
  const firstRaw = cameraColumn(0)
  const secondRaw = cameraColumn(1)
  const translationRaw = cameraColumn(2)
  let amount = 2 / (norm(firstRaw) + norm(secondRaw))
  if (translationRaw.z * amount < 0) amount *= -1

  const first = normalize(scale(firstRaw, amount))
  const secondProjected = scale(first, dot(scale(secondRaw, amount), first))
  const second = normalize({
    x: secondRaw.x * amount - secondProjected.x,
    y: secondRaw.y * amount - secondProjected.y,
    z: secondRaw.z * amount - secondProjected.z,
  })
  const third = normalize(cross(first, second))
  const markerInCamera: Matrix3 = [
    first.x, second.x, third.x,
    first.y, second.y, third.y,
    first.z, second.z, third.z,
  ]
  const translation = scale(translationRaw, amount)
  const cameraInMarker = transpose(markerInCamera)
  const position = {
    x: -(cameraInMarker[0] * translation.x + cameraInMarker[1] * translation.y + cameraInMarker[2] * translation.z),
    y: -(cameraInMarker[3] * translation.x + cameraInMarker[4] * translation.y + cameraInMarker[5] * translation.z),
    z: -(cameraInMarker[6] * translation.x + cameraInMarker[7] * translation.y + cameraInMarker[8] * translation.z),
  }
  return {
    position,
    orientation: quaternionFromRotation(cameraInMarker),
    euler: eulerFromRotation(cameraInMarker),
    viewingDirection: normalize({
      x: markerInCamera[6],
      y: markerInCamera[7],
      z: markerInCamera[8],
    }),
  }
}

