import { registerSW } from 'virtual:pwa-register'
import type { ServiceWorkerCallbacks } from '@/models/pwa'

export function listenForServiceWorkerMessages(
  listener: (event: MessageEvent) => void,
) {
  navigator.serviceWorker?.addEventListener('message', listener)
}

export function registerRobinServiceWorker(callbacks: ServiceWorkerCallbacks) {
  return registerSW({
    immediate: true,
    ...callbacks,
  })
}

export function hasActiveServiceWorker() {
  return Boolean(navigator.serviceWorker?.controller)
}
