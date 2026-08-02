import type { Point2 } from './types'

export const STAG_HD21_CODES = [
  '001100111000110010110111010111100001011011110001',
  '000010100100110011110010111110010110110101011011',
  '101101111010101000111100000001001010000110100011',
  '010110010100000011111110101111000000100011100100',
  '010100001010011010011001110011101111010010000100',
  '111001010010010000010111001011111000100001001110',
  '111010001100011000101100011001000001010011010111',
  '110000111010000001100110001100000111110000111110',
  '010001111010011111001011000001010000110001110001',
  '100001011100000010101000010111111100110011011000',
  '101011001100001110110011010100010110010000100101',
  '011011101110000101110000000010011001010011101010',
] as const

const HALF_PI = Math.PI / 2

function polarPoint(radius: number, radians: number, circleRadius: number): Point2 {
  return {
    x: 0.5 + Math.cos(radians) * radius * (circleRadius / 0.5),
    y: 0.5 - Math.sin(radians) * radius * (circleRadius / 0.5),
  }
}

/** Sampling positions from StagDetector::fillCodeLocations. */
export const CODE_LOCATIONS: Point2[] = Array.from({ length: 4 }, (_, quadrant) => {
  const rotation = quadrant * HALF_PI
  const innerCircleRadius = 0.4 * 0.9
  return [
    polarPoint(0.088363142525988, 0.785398163397448 + rotation, innerCircleRadius),
    polarPoint(0.206935928182607, 0.459275804122858 + rotation, innerCircleRadius),
    polarPoint(0.206935928182607, HALF_PI - 0.459275804122858 + rotation, innerCircleRadius),
    polarPoint(0.313672146827381, 0.200579720495241 + rotation, innerCircleRadius),
    polarPoint(0.327493143484516, 0.591687617505840 + rotation, innerCircleRadius),
    polarPoint(0.327493143484516, HALF_PI - 0.591687617505840 + rotation, innerCircleRadius),
    polarPoint(0.313672146827381, HALF_PI - 0.200579720495241 + rotation, innerCircleRadius),
    polarPoint(0.437421957035861, 0.145724938287167 + rotation, innerCircleRadius),
    polarPoint(0.437226762361658, 0.433363129825345 + rotation, innerCircleRadius),
    polarPoint(0.430628029742607, 0.785398163397448 + rotation, innerCircleRadius),
    polarPoint(0.437226762361658, HALF_PI - 0.433363129825345 + rotation, innerCircleRadius),
    polarPoint(0.437421957035861, HALF_PI - 0.145724938287167 + rotation, innerCircleRadius),
  ]
}).flat()

const borderDistance = 0.045

export const BLACK_BORDER_LOCATIONS: Point2[] = [
  [1, 3], [2, 2], [3, 1],
  [1 / borderDistance - 3, 1], [1 / borderDistance - 2, 2], [1 / borderDistance - 1, 3],
  [1 / borderDistance - 1, 1 / borderDistance - 3],
  [1 / borderDistance - 2, 1 / borderDistance - 2],
  [1 / borderDistance - 3, 1 / borderDistance - 1],
  [3, 1 / borderDistance - 1], [2, 1 / borderDistance - 2], [1, 1 / borderDistance - 3],
].map(([x, y]) => ({ x: x * borderDistance, y: y * borderDistance }))

export const WHITE_BORDER_LOCATIONS: Point2[] = [
  { x: 0.25, y: -borderDistance }, { x: 0.5, y: -borderDistance }, { x: 0.75, y: -borderDistance },
  { x: 1 + borderDistance, y: 0.25 }, { x: 1 + borderDistance, y: 0.5 }, { x: 1 + borderDistance, y: 0.75 },
  { x: 0.75, y: 1 + borderDistance }, { x: 0.5, y: 1 + borderDistance }, { x: 0.25, y: 1 + borderDistance },
  { x: -borderDistance, y: 0.75 }, { x: -borderDistance, y: 0.5 }, { x: -borderDistance, y: 0.25 },
]

