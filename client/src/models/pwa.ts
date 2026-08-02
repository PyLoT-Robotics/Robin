export type CacheProgressMessage = {
  type: 'CACHE_PROGRESS'
  completed: number
  total: number
  file: string
}

export type DeferredDownloadMessage = {
  type: 'DEFERRED_DOWNLOAD'
  state: 'started' | 'finished' | 'failed'
  file: string
}

export type PwaCacheState = 'starting' | 'caching' | 'downloading' | 'ready' | 'error'

export type PwaWorkerMessage = CacheProgressMessage | DeferredDownloadMessage

export type ServiceWorkerCallbacks = {
  onOfflineReady: () => void
  onRegisterError: (error: unknown) => void
}
