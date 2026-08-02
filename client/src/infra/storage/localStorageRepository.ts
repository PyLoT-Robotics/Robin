import type { LocalStorageKey, LocalStorageState } from '@/models/storage'

const legacyServerURLKey = 'WebSocketURL'

export function readLocalStorage(key: LocalStorageKey) {
  const value = localStorage.getItem(key)
  if (key === 'RobinServerURL' && !value) {
    return localStorage.getItem(legacyServerURLKey) ?? ''
  }
  return value ?? ''
}

export function writeLocalStorage(key: LocalStorageKey, value: string) {
  localStorage.setItem(key, value)
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
}

export function readInitialStorageState(): LocalStorageState {
  const storedVideoPriority = localStorage.getItem('WebRTCVideoPriority')
  return {
    CameraTopic: readLocalStorage('CameraTopic'),
    LogTopic: readLocalStorage('LogTopic'),
    RobinServerURL: readLocalStorage('RobinServerURL'),
    WebRTCVideoPriority: storedVideoPriority === null || storedVideoPriority === '50'
      ? '0'
      : storedVideoPriority,
  }
}
