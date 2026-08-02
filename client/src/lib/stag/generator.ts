import { STAG_HD21_CODES } from './constants'
import type { Point2 } from './types'

const CODE_RADIUS = 0.062482177287080
const FILLER_RADIUS_RATIO = 0.7

function generatorCodeLocations(): Point2[] {
  const locations: Point2[] = []
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const rotation = quadrant * Math.PI / 2
    const polar = (radius: number, angle: number): Point2 => ({
      x: 0.5 + Math.cos(angle + rotation) * radius,
      y: 0.5 - Math.sin(angle + rotation) * radius,
    })
    locations.push(
      polar(0.088363142525988, 0.785398163397448),
      polar(0.206935928182607, 0.459275804122858),
      polar(0.206935928182607, Math.PI / 2 - 0.459275804122858),
      polar(0.313672146827381, 0.200579720495241),
      polar(0.327493143484516, 0.591687617505840),
      polar(0.327493143484516, Math.PI / 2 - 0.591687617505840),
      polar(0.313672146827381, Math.PI / 2 - 0.200579720495241),
      polar(0.437421957035861, 0.145724938287167),
      polar(0.437226762361658, 0.433363129825345),
      polar(0.430628029742607, 0.785398163397448),
      polar(0.437226762361658, Math.PI / 2 - 0.433363129825345),
      polar(0.437421957035861, Math.PI / 2 - 0.145724938287167),
    )
  }
  return locations
}

const GENERATOR_LOCATIONS = generatorCodeLocations()

function fillCircle(context: CanvasRenderingContext2D, point: Point2, radius: number, color: string) {
  context.fillStyle = color
  context.beginPath()
  context.arc(point.x, point.y, radius, 0, Math.PI * 2)
  context.fill()
}

/** Draw an HD21 marker using the original STag marker-generator geometry. */
export function drawMarker(
  context: CanvasRenderingContext2D,
  id: number,
  size: number,
) {
  const code = STAG_HD21_CODES[id]
  if (!code) throw new RangeError(`HD21 marker id must be between 0 and ${STAG_HD21_CODES.length - 1}.`)

  const borderRatio = 0.125
  const markerSize = size / (1 + borderRatio * 2)
  const borderSize = markerSize * borderRatio
  const center = size / 2
  const outerRadius = markerSize * 0.4
  const innerRadius = markerSize * 0.35
  const codeRadius = innerRadius * 2 * CODE_RADIUS
  const fillerRadius = codeRadius * FILLER_RADIUS_RATIO

  context.save()
  context.fillStyle = 'white'
  context.fillRect(0, 0, size, size)
  context.fillStyle = 'black'
  context.fillRect(borderSize, borderSize, markerSize, markerSize)
  fillCircle(context, { x: center, y: center }, outerRadius, 'white')

  const pixelLocations = GENERATOR_LOCATIONS.map((point) => ({
    x: center - innerRadius + point.x * innerRadius * 2,
    y: center - innerRadius + point.y * innerRadius * 2,
  }))

  // The reference generator joins nearby active samples before redrawing the
  // sample centres. This produces the stable irregular blobs used by STag.
  for (let first = 0; first < 48; first++) {
    if (code[first] !== '1') continue
    for (let second = first + 1; second < 48; second++) {
      if (code[second] !== '1') continue
      const normalizedDistance = Math.hypot(
        GENERATOR_LOCATIONS[first].x - GENERATOR_LOCATIONS[second].x,
        GENERATOR_LOCATIONS[first].y - GENERATOR_LOCATIONS[second].y,
      )
      if (normalizedDistance < CODE_RADIUS * 4) {
        fillCircle(context, {
          x: (pixelLocations[first].x + pixelLocations[second].x) / 2,
          y: (pixelLocations[first].y + pixelLocations[second].y) / 2,
        }, fillerRadius, 'black')
      }
    }
  }
  pixelLocations.forEach((point, index) => {
    fillCircle(context, point, codeRadius, code[index] === '1' ? 'black' : 'white')
  })

  // Restore the quiet white ring exactly around the encoded inner disc.
  context.globalCompositeOperation = 'destination-out'
  context.beginPath()
  context.arc(center, center, outerRadius, 0, Math.PI * 2)
  context.arc(center, center, innerRadius, 0, Math.PI * 2, true)
  context.fill('evenodd')
  context.globalCompositeOperation = 'source-over'
  context.fillStyle = 'white'
  context.beginPath()
  context.arc(center, center, outerRadius, 0, Math.PI * 2)
  context.arc(center, center, innerRadius, 0, Math.PI * 2, true)
  context.fill('evenodd')
  context.restore()
}

export function createMarkerCanvas(id: number, size = 1000) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas is unavailable.')
  drawMarker(context, id, size)
  return canvas
}

export function markerFilename(id: number) {
  return `stag-hd21-${String(id).padStart(2, '0')}.png`
}
