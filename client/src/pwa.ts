import { computed, readonly, ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

type CacheProgressMessage = {
  type: 'CACHE_PROGRESS'
  completed: number
  total: number
  file: string
}

const completed = ref(0)
const total = ref(0)
const currentFile = ref('Registering offline cache…')
const state = ref<'starting' | 'caching' | 'ready' | 'error'>(
  navigator.serviceWorker?.controller ? 'ready' : 'starting',
)

navigator.serviceWorker?.addEventListener('message', (event: MessageEvent<CacheProgressMessage>) => {
  if (event.data?.type !== 'CACHE_PROGRESS') return
  completed.value = Math.max(completed.value, event.data.completed)
  total.value = event.data.total
  currentFile.value = event.data.file
  state.value = completed.value === event.data.total ? 'ready' : 'caching'
})

registerSW({
  immediate: true,
  onOfflineReady() {
    state.value = 'ready'
    completed.value = total.value
    currentFile.value = 'All client code and assets are saved for offline use.'
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
