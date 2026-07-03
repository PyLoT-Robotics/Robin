const rosBridgePath = '/rosbridge'
const videoPublisherPath = '/video_publisher'
const rosBridgeProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

export const defaultConnectionHost = window.location.hostname

export function normalizeConnectionHost(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  try {
    return new URL(hasProtocol ? trimmed : `wss://${trimmed}`).hostname
  } catch {
    return ''
  }
}

export function buildRosWebSocketURL(_host?: string) {
  return `${rosBridgeProtocol}//${window.location.host}${rosBridgePath}`
}

export function buildVideoPublisherBaseURL(_host?: string) {
  return `${window.location.origin}${videoPublisherPath}`
}

export const defaultRosWebsocketURL = buildRosWebSocketURL()
