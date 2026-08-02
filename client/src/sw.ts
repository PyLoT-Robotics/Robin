/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>
}

const manifest = self.__WB_MANIFEST
const shellEntries = manifest.filter(({ url }) => (
  url === 'index.html' ||
  url === 'manifest.webmanifest' ||
  /^assets\/index-[^/]+\.(js|css)$/.test(url) ||
  /^assets\/(reactivity|runtime-core)\.esm-bundler-[^/]+\.js$/.test(url) ||
  /^(favicon\.ico|apple-touch-icon-180x180\.png|pwa-(64x64|192x192|512x512)\.png|maskable-icon-512x512\.png)$/.test(url)
))
const urls = shellEntries.map(({ url }) => new URL(url, self.location.origin).href)
const manifestKey = manifest.map(({ url, revision }) => `${url}:${revision ?? ''}`).join('|')
let manifestHash = 0
for (const character of manifestKey) {
  manifestHash = (Math.imul(manifestHash, 31) + character.charCodeAt(0)) | 0
}
const CACHE_NAME = `robin-client-${(manifestHash >>> 0).toString(16)}`

async function reportProgress(completed: number, total: number, file: string) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'CACHE_PROGRESS', completed, total, file })
  }
}

async function reportDownload(state: 'started' | 'finished' | 'failed', file: string) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({ type: 'DEFERRED_DOWNLOAD', state, file })
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    let completed = 0
    await reportProgress(0, urls.length, 'Downloading minimum app shell…')

    await Promise.all(urls.map(async (url) => {
      const response = await fetch(url, { cache: 'reload' })
      if (!response.ok) throw new Error(`Could not cache ${url}: HTTP ${response.status}`)
      await cache.put(url, response)
      completed += 1
      await reportProgress(completed, urls.length, new URL(url).pathname)
    }))

    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((name) => name !== CACHE_NAME && (
        name.startsWith('robin-client-') || name.startsWith('workbox-precache')
      ))
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    const cached = await cache.match(event.request)
    if (cached) return cached

    try {
      const file = new URL(event.request.url).pathname
      const shouldCache = ['script', 'style', 'image', 'font', 'worker'].includes(
        event.request.destination,
      )
      if (shouldCache) await reportDownload('started', file)
      const response = await fetch(event.request)
      if (
        shouldCache &&
        response.ok &&
        new URL(event.request.url).origin === self.location.origin
      ) {
        await cache.put(event.request, response.clone())
      }
      if (shouldCache) await reportDownload('finished', file)
      return response
    } catch (error) {
      if (['script', 'style', 'image', 'font', 'worker'].includes(event.request.destination)) {
        await reportDownload('failed', new URL(event.request.url).pathname)
      }
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match(new URL('index.html', self.registration.scope).href)
        if (fallback) return fallback
        return new Response(
          '<!doctype html><title>Robin is offline</title><h1>Robin is offline</h1><p>Reconnect to the internet, then reload this page.</p>',
          {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          },
        )
      }
      throw error
    }
  })())
})

export {}
