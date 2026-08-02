import * as RosLib from 'roslib'
import { readonly, ref } from 'vue'

import { buildRosWebSocketURL } from '@/infra/ros/endpoints'
import type { RosConnectionStatus } from '@/models/ros'

const ros = new RosLib.Ros()
const status = ref<RosConnectionStatus>('closed')
const error = ref<string | null>(null)
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelayMs = 1000

function scheduleReconnect() {
  if (reconnectTimer) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connect()
  }, reconnectDelayMs)
  reconnectDelayMs = Math.min(reconnectDelayMs * 2, 15000)
}

ros.on('connection', () => {
  status.value = 'connected'
  error.value = null
  reconnectDelayMs = 1000
})

ros.on('close', () => {
  status.value = 'closed'
  scheduleReconnect()
})

ros.on('error', (connectionError) => {
  status.value = 'error'
  error.value = connectionError instanceof Error
    ? connectionError.message
    : String(connectionError)
  scheduleReconnect()
})

function connect() {
  const rosWebsocketURL = buildRosWebSocketURL()
  if (!rosWebsocketURL) {
    status.value = 'error'
    error.value = 'Configure the Robin server URL in Settings.'
    return
  }

  try {
    ros.connect(rosWebsocketURL)
  } catch (connectionError) {
    status.value = 'error'
    error.value = connectionError instanceof Error
      ? connectionError.message
      : String(connectionError)
    scheduleReconnect()
  }
}

connect()

export function useRosConnection() {
  return {
    ros,
    status: readonly(status),
    error: readonly(error),
    connect,
  }
}

export { ros, status, error, connect }
