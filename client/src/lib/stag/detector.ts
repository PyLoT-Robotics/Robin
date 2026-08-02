import {
  BLACK_BORDER_LOCATIONS,
  CODE_LOCATIONS,
  STAG_HD21_CODES,
  WHITE_BORDER_LOCATIONS,
} from './constants'
import { estimateCameraPose, homographyFromPoints, intrinsicsFromHorizontalFov, projectPoint } from './pose'
import type { DetectOptions, Point2, StagDetection } from './types'

type Quad = [Point2, Point2, Point2, Point2]

function grayscale(image: ImageData): Uint8Array {
  const output = new Uint8Array(image.width * image.height)
  for (let index = 0, pixel = 0; index < image.data.length; index += 4, pixel++) {
    output[pixel] = Math.round(
      image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114,
    )
  }
  return output
}

function otsuThreshold(values: ArrayLike<number>) {
  const histogram = new Uint32Array(256)
  for (let index = 0; index < values.length; index++) histogram[values[index]]++
  let totalSum = 0
  for (let value = 0; value < 256; value++) totalSum += value * histogram[value]

  let backgroundWeight = 0
  let backgroundSum = 0
  let bestVariance = -1
  let bestThreshold = 127
  for (let threshold = 0; threshold < 256; threshold++) {
    backgroundWeight += histogram[threshold]
    if (backgroundWeight === 0) continue
    const foregroundWeight = values.length - backgroundWeight
    if (foregroundWeight === 0) break
    backgroundSum += threshold * histogram[threshold]
    const backgroundMean = backgroundSum / backgroundWeight
    const foregroundMean = (totalSum - backgroundSum) / foregroundWeight
    const variance = backgroundWeight * foregroundWeight * (backgroundMean - foregroundMean) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      bestThreshold = threshold
    }
  }
  return bestThreshold
}

function cross(origin: Point2, first: Point2, second: Point2) {
  return (first.x - origin.x) * (second.y - origin.y)
    - (first.y - origin.y) * (second.x - origin.x)
}

function convexHull(points: Point2[]) {
  if (points.length <= 4) return points
  const sorted = [...points].sort((left, right) => left.x - right.x || left.y - right.y)
  const lower: Point2[] = []
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2)!, lower.at(-1)!, point) <= 0) lower.pop()
    lower.push(point)
  }
  const upper: Point2[] = []
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index]
    while (upper.length >= 2 && cross(upper.at(-2)!, upper.at(-1)!, point) <= 0) upper.pop()
    upper.push(point)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

function distanceToLine(point: Point2, start: Point2, end: Point2) {
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  return length === 0 ? Math.hypot(point.x - start.x, point.y - start.y) : Math.abs(cross(start, end, point)) / length
}

function simplifyLine(points: Point2[], epsilon: number): Point2[] {
  if (points.length <= 2) return points
  let furthestIndex = 0
  let furthestDistance = 0
  for (let index = 1; index < points.length - 1; index++) {
    const distance = distanceToLine(points[index], points[0], points.at(-1)!)
    if (distance > furthestDistance) {
      furthestDistance = distance
      furthestIndex = index
    }
  }
  if (furthestDistance <= epsilon) return [points[0], points.at(-1)!]
  return [
    ...simplifyLine(points.slice(0, furthestIndex + 1), epsilon).slice(0, -1),
    ...simplifyLine(points.slice(furthestIndex), epsilon),
  ]
}

function simplifyClosedHull(hull: Point2[], epsilon: number) {
  if (hull.length <= 4) return hull
  let firstIndex = 0
  let secondIndex = 1
  let greatestDistance = 0
  for (let index = 1; index < hull.length; index++) {
    const distance = Math.hypot(hull[index].x - hull[0].x, hull[index].y - hull[0].y)
    if (distance > greatestDistance) {
      greatestDistance = distance
      secondIndex = index
    }
  }
  greatestDistance = 0
  for (let index = 0; index < hull.length; index++) {
    const distance = Math.hypot(hull[index].x - hull[secondIndex].x, hull[index].y - hull[secondIndex].y)
    if (distance > greatestDistance) {
      greatestDistance = distance
      firstIndex = index
    }
  }
  if (firstIndex > secondIndex) [firstIndex, secondIndex] = [secondIndex, firstIndex]
  const firstChain = hull.slice(firstIndex, secondIndex + 1)
  const secondChain = [...hull.slice(secondIndex), ...hull.slice(0, firstIndex + 1)]
  return [
    ...simplifyLine(firstChain, epsilon).slice(0, -1),
    ...simplifyLine(secondChain, epsilon).slice(0, -1),
  ]
}

function polygonArea(points: Point2[]) {
  let area = 0
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length]
    area += points[index].x * next.y - next.x * points[index].y
  }
  return area / 2
}

function normalizeQuad(points: Point2[]): Quad | undefined {
  if (points.length !== 4) return undefined
  let ordered = [...points]
  if (polygonArea(ordered) < 0) ordered.reverse()
  let topLeftIndex = 0
  for (let index = 1; index < 4; index++) {
    if (ordered[index].x + ordered[index].y < ordered[topLeftIndex].x + ordered[topLeftIndex].y) {
      topLeftIndex = index
    }
  }
  ordered = [...ordered.slice(topLeftIndex), ...ordered.slice(0, topLeftIndex)]
  const lengths = ordered.map((point, index) => {
    const next = ordered[(index + 1) % 4]
    return Math.hypot(next.x - point.x, next.y - point.y)
  })
  if (Math.min(...lengths) < Math.max(...lengths) * 0.12) return undefined
  return ordered as Quad
}

function findQuadCandidates(
  gray: Uint8Array,
  width: number,
  height: number,
  minimumMarkerPixels: number,
) {
  const threshold = otsuThreshold(gray)
  const dark = new Uint8Array(gray.length)
  for (let index = 0; index < gray.length; index++) dark[index] = gray[index] <= threshold ? 1 : 0
  const visited = new Uint8Array(gray.length)
  const queue = new Int32Array(gray.length)
  const candidates: { quad: Quad; area: number }[] = []
  const minimumComponentArea = Math.max(40, minimumMarkerPixels ** 2 * 0.05)

  for (let seed = 0; seed < dark.length; seed++) {
    if (!dark[seed] || visited[seed]) continue
    visited[seed] = 1
    queue[0] = seed
    let head = 0
    let tail = 1
    let componentArea = 0
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    const boundary: Point2[] = []

    while (head < tail) {
      const pixel = queue[head++]
      const x = pixel % width
      const y = Math.floor(pixel / width)
      componentArea++
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      if (
        x === 0 || y === 0 || x === width - 1 || y === height - 1
        || !dark[pixel - 1] || !dark[pixel + 1]
        || !dark[pixel - width] || !dark[pixel + width]
      ) boundary.push({ x, y })

      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const nextY = y + offsetY
        if (nextY < 0 || nextY >= height) continue
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
          if (offsetX === 0 && offsetY === 0) continue
          const nextX = x + offsetX
          if (nextX < 0 || nextX >= width) continue
          const next = nextY * width + nextX
          if (dark[next] && !visited[next]) {
            visited[next] = 1
            queue[tail++] = next
          }
        }
      }
    }

    const boxWidth = maxX - minX + 1
    const boxHeight = maxY - minY + 1
    if (
      componentArea < minimumComponentArea
      || Math.min(boxWidth, boxHeight) < minimumMarkerPixels
      || boxWidth > width * 0.98
      || boxHeight > height * 0.98
    ) continue
    const fillRatio = componentArea / (boxWidth * boxHeight)
    if (fillRatio < 0.06 || fillRatio > 0.92) continue

    const sampleStep = Math.max(1, Math.floor(boundary.length / 1500))
    const hull = convexHull(boundary.filter((_, index) => index % sampleStep === 0))
    const perimeter = hull.reduce((sum, point, index) => {
      const next = hull[(index + 1) % hull.length]
      return sum + Math.hypot(next.x - point.x, next.y - point.y)
    }, 0)
    let quad: Quad | undefined
    for (const ratio of [0.004, 0.008, 0.015, 0.025, 0.04, 0.065]) {
      const simplified = simplifyClosedHull(hull, perimeter * ratio)
      if (simplified.length === 4) {
        quad = normalizeQuad(simplified)
        if (quad) break
      }
    }
    if (!quad) continue
    const area = Math.abs(polygonArea(quad))
    if (area < minimumMarkerPixels ** 2 * 0.35) continue
    candidates.push({ quad, area })
  }
  return candidates.sort((left, right) => right.area - left.area).slice(0, 24)
}

function readBilinear(gray: Uint8Array, width: number, height: number, point: Point2) {
  const x = Math.max(0, Math.min(width - 1.001, point.x))
  const y = Math.max(0, Math.min(height - 1.001, point.y))
  const left = Math.floor(x)
  const top = Math.floor(y)
  const right = Math.min(width - 1, left + 1)
  const bottom = Math.min(height - 1, top + 1)
  const horizontal = x - left
  const vertical = y - top
  const topValue = gray[top * width + left] * (1 - horizontal) + gray[top * width + right] * horizontal
  const bottomValue = gray[bottom * width + left] * (1 - horizontal) + gray[bottom * width + right] * horizontal
  return Math.round(topValue * (1 - vertical) + bottomValue * vertical)
}

function hammingDistance(left: readonly number[], right: string) {
  let distance = 0
  for (let index = 0; index < 48; index++) if (left[index] !== Number(right[index])) distance++
  return distance
}

function decode(bits: number[], maxDistance: number) {
  let best: { id: number; rotation: number; distance: number } | undefined
  for (let rotation = 0; rotation < 4; rotation++) {
    const offset = rotation * 12
    const rotated = [...bits.slice(offset), ...bits.slice(0, offset)]
    STAG_HD21_CODES.forEach((code, id) => {
      const distance = hammingDistance(rotated, code)
      if (!best || distance < best.distance) best = { id, rotation, distance }
    })
  }
  return best && best.distance <= maxDistance ? best : undefined
}

function readMarker(gray: Uint8Array, width: number, height: number, quad: Quad, maxDistance: number) {
  const homography = homographyFromPoints(
    [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    quad,
  )
  if (!homography) return undefined
  const readLocations = (locations: Point2[]) => locations.map((location) => (
    readBilinear(gray, width, height, projectPoint(homography, location))
  ))
  const codeValues = readLocations(CODE_LOCATIONS)
  const blackValues = readLocations(BLACK_BORDER_LOCATIONS)
  const whiteValues = readLocations(WHITE_BORDER_LOCATIONS)
  const blackMean = blackValues.reduce((sum, value) => sum + value, 0) / blackValues.length
  const whiteMean = whiteValues.reduce((sum, value) => sum + value, 0) / whiteValues.length
  if (whiteMean - blackMean < 28) return undefined

  const threshold = otsuThreshold([...codeValues, ...blackValues, ...whiteValues])
  const decoded = decode(codeValues.map((value) => value <= threshold ? 1 : 0), maxDistance)
  if (!decoded) return undefined

  // Decoder rotations are 12 samples (one quadrant) each. Rotate the image
  // corners by the same amount so corner 0 is stable in marker coordinates.
  const corners = [
    ...quad.slice(decoded.rotation),
    ...quad.slice(0, decoded.rotation),
  ] as Quad
  return { ...decoded, corners }
}

function centersNear(left: Quad, right: Quad) {
  const center = (quad: Quad) => ({
    x: quad.reduce((sum, point) => sum + point.x, 0) / 4,
    y: quad.reduce((sum, point) => sum + point.y, 0) / 4,
  })
  const leftCenter = center(left)
  const rightCenter = center(right)
  const leftEdge = Math.hypot(left[1].x - left[0].x, left[1].y - left[0].y)
  return Math.hypot(leftCenter.x - rightCenter.x, leftCenter.y - rightCenter.y) < leftEdge * 0.2
}

/** Detect HD21 STag markers in RGBA image data. */
export function detectMarkers(image: ImageData, options: DetectOptions = {}): StagDetection[] {
  const gray = grayscale(image)
  const maximumDistance = options.maxHammingDistance ?? 6
  const markerSizeMeters = options.markerSizeMeters
  const intrinsics = options.intrinsics ?? intrinsicsFromHorizontalFov(
    image.width,
    image.height,
    options.horizontalFovDegrees ?? 60,
  )
  const detections: StagDetection[] = []

  for (const candidate of findQuadCandidates(
    gray,
    image.width,
    image.height,
    options.minimumMarkerPixels ?? 36,
  )) {
    const decoded = readMarker(gray, image.width, image.height, candidate.quad, maximumDistance)
    if (!decoded || detections.some((detection) => centersNear(detection.corners, decoded.corners))) continue
    detections.push({
      id: decoded.id,
      corners: decoded.corners,
      hammingDistance: decoded.distance,
      pose: markerSizeMeters
        ? estimateCameraPose(decoded.corners, markerSizeMeters, intrinsics)
        : undefined,
    })
  }
  return detections
}

