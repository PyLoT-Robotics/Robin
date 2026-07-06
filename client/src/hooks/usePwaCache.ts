import { computed, readonly, ref } from 'vue'

import {
  hasActiveServiceWorker,
  listenForServiceWorkerMessages,
  registerRobinServiceWorker,
} from '@/infra/pwa/serviceWorker'
import type { PwaCacheState, PwaWorkerMessage } from '@/models/pwa'

const completed = ref(0)
const total = ref(0)
const currentFile = ref('Registering offline cache…')
const state = ref<PwaCacheState>(hasActiveServiceWorker() ? 'ready' : 'starting')

listenForServiceWorkerMessages((event: MessageEvent<PwaWorkerMessage>) => {
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

registerRobinServiceWorker({
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

export function usePwaCache() {
  return pwaCache
}
