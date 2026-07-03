import { computed, readonly, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

type CacheProgressMessage = {
  type: 'CACHE_PROGRESS'
  completed: number
  total: number
  file: string
}


type DeferredDownloadMessage = {
  type: 'DEFERRED_DOWNLOAD'
  state: 'started' | 'finished' | 'failed'
  file: string
}

const completed = ref(0)
const total = ref(0)
const currentFile = ref('Registering offline cache…')
const state = ref<'starting' | 'caching' | 'downloading' | 'ready' | 'error'>(
  navigator.serviceWorker?.controller ? 'ready' : 'starting',
)

navigator.serviceWorker?.addEventListener('message', (event: MessageEvent<CacheProgressMessage | DeferredDownloadMessage>) => {
  if (event.data?.type === 'CACHE_PROGRESS') {
    completed.value = Math.max(completed.value, event.data.completed)
    total.value = event.data.total
    currentFile.value = event.data.file
    state.value = completed.value === event.data.total ? 'ready' : 'caching'
  }
  if (event.data?.type === 'DEFERRED_DOWNLOAD') {
    currentFile.value = event.data.file
    state.value = event.data.state === 'started'
      ? 'downloading'
      : event.data.state === 'failed' ? 'error' : 'ready'
  }
})

registerSW({
  immediate: true,
  onOfflineReady() {
    state.value = 'ready'
    completed.value = total.value
    currentFile.value = 'Minimum UI is ready. Features download when opened.'
  },
  onRegisterError(error) {
    state.value = 'error'
    currentFile.value = `Offline cache failed: ${error instanceof Error ? error.message : String(error)}`
  },
})

export const pwaCache = {
  state: readonly(state),
  completed: readonly(completed),
  total: readonly(total),
  currentFile: readonly(currentFile),
  percentage: computed(() => total.value > 0 ? Math.round(completed.value / total.value * 100) : 0),
}
