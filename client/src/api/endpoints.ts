const defaultServerPort = '5173'
const rosBridgePath = '/rosbridge'
const videoPublisherPath = '/video_publisher'

export function normalizeServerURL(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  try {
    const url = new URL(hasProtocol ? trimmed : `https://${trimmed}`)

    if (url.protocol === 'wss:') url.protocol = 'https:'
    if (url.protocol === 'ws:') url.protocol = 'http:'
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''

    if (!url.port) url.port = defaultServerPort
    return url.origin
  } catch {
    return ''
  }
}

export function normalizeConnectionHost(value: string) {
  const normalizedURL = normalizeServerURL(value)
  return normalizedURL ? new URL(normalizedURL).hostname : ''
}

export function buildRobinServerURL(host: string) {
  const normalizedHost = normalizeConnectionHost(host)
  if (!normalizedHost) return ''

  const urlHost = normalizedHost.includes(':') ? `[${normalizedHost}]` : normalizedHost
  return `https://${urlHost}:${defaultServerPort}`
}

export const defaultServerURL = normalizeServerURL(import.meta.env.VITE_ROBIN_SERVER_URL ?? '')

export function getRobinServerURL() {
  const storedURL = localStorage.getItem('RobinServerURL') || localStorage.getItem('WebSocketURL') || ''
  return normalizeServerURL(storedURL) || defaultServerURL
}

export function getRobinServerHost() {
  return normalizeConnectionHost(getRobinServerURL())
}

export function buildRosWebSocketURL(serverURL = getRobinServerURL()) {
  const normalizedURL = normalizeServerURL(serverURL)
  if (!normalizedURL) return ''

  const url = new URL(rosBridgePath, normalizedURL)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

export function buildVideoPublisherBaseURL(serverURL = getRobinServerURL()) {
  const normalizedURL = normalizeServerURL(serverURL)
  if (!normalizedURL) return ''

  return new URL(videoPublisherPath, normalizedURL).toString()
}

export const defaultRosWebsocketURL = buildRosWebSocketURL(defaultServerURL)
