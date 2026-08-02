<template>
  <div
    class="w-full h-full min-w-0 flex items-center justify-start text-md font-mono text-zinc-200"
  >
    <p class="block min-w-0 w-full max-w-full truncate px-4">
      {{ latestLine }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useRosTopicSubscription } from '@/hooks/useRosTopicSubscription'
import { ref, watch } from 'vue'

const latestLine = ref('Waiting for messages...')
const activeTopic = useLocalStorage('LogTopic')

const { error } = useRosTopicSubscription(activeTopic, (message, topicName) => {
  latestLine.value = `[${new Date().toLocaleTimeString()}] ${topicName} ${JSON.stringify(message)}`
})

watch(
  activeTopic,
  (newTopic) => { latestLine.value = newTopic ? 'Waiting for messages...' : 'No topic selected' },
  { immediate: true },
)

watch(error, (subscriptionError) => {
  if (subscriptionError) latestLine.value = subscriptionError
})
</script>
