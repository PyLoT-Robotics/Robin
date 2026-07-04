import { ref, computed } from 'vue'

type LocalStorageKeys = 'CameraTopic' | 'LogTopic' | 'WebRTCVideoPriority' | 'RobinServerURL'

// グローバルな状態を管理
const storedVideoPriority = localStorage.getItem('WebRTCVideoPriority')

const storageState = ref<Record<LocalStorageKeys, string>>({
  CameraTopic: localStorage.getItem('CameraTopic') || '',
  LogTopic: localStorage.getItem('LogTopic') || '',
  RobinServerURL: localStorage.getItem('RobinServerURL') || localStorage.getItem('WebSocketURL') || '',
  // The previous release used 50 as its implicit default. Migrate that value
  // once to the latency-first profile for congested networks.
  WebRTCVideoPriority: storedVideoPriority === null || storedVideoPriority === '50'
    ? '0'
    : storedVideoPriority,
})

export function getLocalStorageItem(key: LocalStorageKeys): string {
  return localStorage.getItem(key) || ''
}

export function useLocalStorage(key: LocalStorageKeys) {
  return computed({
    get: () => storageState.value[key],
    set: (value: string) => {
      storageState.value[key] = value
      localStorage.setItem(key, value)
      // 他のタブ/ウィンドウとの同期
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: value }))
    },
  })
}
