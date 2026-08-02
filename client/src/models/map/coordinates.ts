import type { MapGeometry, ViewportTransform } from './types'

export type { MapGeometry, ViewportTransform } from './types'

export function mapWorldToPixel(geometry: MapGeometry, worldX: number, worldY: number) {
  if (geometry.resolution <= 0 || geometry.width <= 0 || geometry.height <= 0) {
    return null
  }

  const dx = worldX - geometry.originX
  const dy = worldY - geometry.originY
  const cosYaw = Math.cos(geometry.originYaw)
  const sinYaw = Math.sin(geometry.originYaw)

  const localX = (dx * cosYaw + dy * sinYaw) / geometry.resolution
  const localY = (-dx * sinYaw + dy * cosYaw) / geometry.resolution

  const pixelX = localX
  const pixelY = geometry.height - 1 - localY
  return { x: pixelX, y: pixelY }
}

export function mapPixelToWorld(geometry: MapGeometry, pixelX: number, pixelY: number) {
  if (geometry.resolution <= 0 || geometry.width <= 0 || geometry.height <= 0) {
    return null
  }

  const localX = pixelX
  const localY = geometry.height - 1 - pixelY
  const cosYaw = Math.cos(geometry.originYaw)
  const sinYaw = Math.sin(geometry.originYaw)
  const worldX = geometry.originX + geometry.resolution * (cosYaw * localX - sinYaw * localY)
  const worldY = geometry.originY + geometry.resolution * (sinYaw * localX + cosYaw * localY)
  return { x: worldX, y: worldY }
}

export function viewportPointToMapPixel(
  mapWidth: number,
  mapHeight: number,
  transform: ViewportTransform,
  pointX: number,
  pointY: number,
) {
  if (mapWidth <= 0 || mapHeight <= 0 || transform.scale <= 0) {
    return null
  }

  const cx = mapWidth / 2
  const cy = mapHeight / 2
  const untransformedX = pointX - transform.translateX - cx
  const untransformedY = pointY - transform.translateY - cy
  const scaledX = untransformedX / transform.scale
  const scaledY = untransformedY / transform.scale
  const rad = (transform.rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const localX = scaledX * cos + scaledY * sin + cx
  const localY = -scaledX * sin + scaledY * cos + cy
  return { x: localX, y: localY }
}

export function mapPixelToViewportPoint(
  mapWidth: number,
  mapHeight: number,
  transform: ViewportTransform,
  pixelX: number,
  pixelY: number,
) {
  if (mapWidth <= 0 || mapHeight <= 0) {
    return null
  }

  const cx = mapWidth / 2
  const cy = mapHeight / 2
  const localX = pixelX - cx
  const localY = pixelY - cy
  const rad = (transform.rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  const rotatedX = localX * cos - localY * sin
  const rotatedY = localX * sin + localY * cos

  return {
    x: transform.translateX + cx + rotatedX * transform.scale,
    y: transform.translateY + cy + rotatedY * transform.scale,
  }
}
