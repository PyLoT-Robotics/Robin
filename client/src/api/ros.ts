import * as RosLib from 'roslib'
import type { Action, Ros, Topic } from 'roslib'
import { ref } from 'vue'

const rosBridgePath = '/rosbridge'
const videoPublisherPath = '/video_publisher'
const rosBridgeProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'

export const defaultConnectionHost = window.location.hostname

export function normalizeConnectionHost(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const hasProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  const candidate = hasProtocol ? trimmed : `wss://${trimmed}`

  try {
    return new URL(candidate).hostname
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

export function createRos() {
  const rosWebsocketURL = buildRosWebSocketURL()
  const ros = new RosLib.Ros()

  const status = ref<'connected' | 'closed' | 'error'>('closed')
  const error = ref<string | null>(null)
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelayMs = 1000

  const scheduleReconnect = () => {
    if (reconnectTimer) {
      return
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      try {
        ros.connect(rosWebsocketURL)
      } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
        scheduleReconnect()
      }
    }, reconnectDelayMs)

    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000)
  }

  ros.on('connection', () => {
    status.value = 'connected'
    error.value = null
    reconnectDelayMs = 1000
    console.log('🙌 Connected to WebSocket')
  })

  ros.on('close', () => {
    status.value = 'closed'
    console.log('👋 WebSocket Closed!')
    scheduleReconnect()
  })

  ros.on('error', (err) => {
    status.value = 'error'
    error.value = err instanceof Error ? err.message : String(err)
    console.error('⚠ Error occurred in WebSocket Connection')
    console.log(err)
    scheduleReconnect()
  })

  function connect() {
    console.log("connecting...")
    ros.connect(rosWebsocketURL)
  }

  connect()

  return { ros, status, error, connect }
}

export function createTopic(ros: RosLib.Ros, name: string, messageType: string) {
  return new RosLib.Topic({
    ros,
    name,
    messageType,
  })
}

export function createService(
  ros: RosLib.Ros,
  name: string,
  serviceType: 'rosapi/Topics' | 'rosapi/TopicType',
) {
  return new RosLib.Service({
    ros,
    name,
    serviceType,
  })
}

export function createAction(ros: RosLib.Ros, name: string, actionType: string) {
  return new RosLib.Action({
    ros,
    name,
    actionType,
  })
}

export type { Action, Ros, Topic }
