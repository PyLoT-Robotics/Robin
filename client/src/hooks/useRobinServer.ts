import { computed, ref } from 'vue'

import {
  buildRobinServerURL,
  buildRosWebSocketURL,
  buildVideoPublisherBaseURL,
  getRobinServerHost,
  normalizeConnectionHost,
} from '@/infra/ros/endpoints'
import { useLocalStorage } from './useLocalStorage'

export function useActiveRobinServer() {
  return {
    getVideoPublisherURL: buildVideoPublisherBaseURL,
  }
}

export function useServerConnectionSettings() {
  const serverURLStorage = useLocalStorage('RobinServerURL')
  const serverHostDraft = ref(getRobinServerHost())
  const serverHostError = ref('')
  const normalizedServerHost = computed(() => normalizeConnectionHost(serverHostDraft.value))
  const normalizedServerURL = computed(() => buildRobinServerURL(normalizedServerHost.value))
  const rosbridgeURL = computed(() => buildRosWebSocketURL(normalizedServerURL.value))
  const videoPublisherURL = computed(() => buildVideoPublisherBaseURL(normalizedServerURL.value))

  function saveServerHost() {
    const serverURL = buildRobinServerURL(serverHostDraft.value)
    if (!serverURL) {
      serverHostError.value = 'Enter a valid local IP address.'
      return false
    }

    serverHostError.value = ''
    serverURLStorage.value = serverURL
    return true
  }

  return {
    serverHostDraft,
    serverHostError,
    normalizedServerURL,
    rosbridgeURL,
    videoPublisherURL,
    saveServerHost,
  }
}
