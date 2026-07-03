<template>
  <div class="w-full h-full overflow-y-auto flex flex-col gap-8 text-zinc-200 text-xl py-4">
    <div class="flex flex-col gap-1 font-mono">
      <p class="px-2 text-lg">Camera Topic</p>
      <select
        v-model="cameraTopic"
        class="bg-zinc-900 text-zinc-200 px-2 py-1 border-y border-border outline-none"
      >
        <option v-for="topic in topicsList" :key="`camera-${topic}`" :value="topic">
          {{ topic }}
        </option>
      </select>
    </div>

    <div class="flex flex-col gap-1 font-mono">
      <p class="px-2 text-lg">Log Topic</p>
      <select
        v-model="logTopic"
        class="bg-zinc-900 text-zinc-200 px-2 py-1 border-y border-border outline-none"
      >
        <option v-for="topic in topicsList" :key="`log-${topic}`" :value="topic">
          {{ topic }}
        </option>
      </select>
    </div>

    <div class="flex flex-col gap-2 font-mono">
      <div class="flex items-center justify-between px-2 text-lg">
        <label for="webrtc-video-priority">Video Priority</label>
        <span class="text-sm text-zinc-400">{{ videoPriorityLabel }}</span>
      </div>
      <input
        id="webrtc-video-priority"
        v-model="videoPriority"
        type="range"
        min="0"
        max="100"
        step="25"
        class="mx-2 accent-orange-500"
      >
      <div class="flex justify-between px-2 text-sm text-zinc-400">
        <span>Lower latency</span>
        <span>Higher quality</span>
      </div>
    </div>

    <div class="flex flex-col gap-1 font-mono">
      <p class="px-2 text-lg">Connection Endpoint</p>
      <div class="bg-zinc-900 text-zinc-200 px-2 py-1 border-y border-border">
        Fixed to current dev server origin
      </div>
      <p class="px-2 text-sm text-zinc-400">
        WebSocket: {{ rosbridgeURL }}<br>
        VideoPublisher: {{ videoPublisherURL }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import {
  buildRosWebSocketURL,
  buildVideoPublisherBaseURL,
  createTopic,
  type Topic,
} from '@/api/ros'
import { useTopicsList } from '@/hooks/useTopicsList'
import { ros, status } from '@/plugins/ros'

const cameraTopicStorage = useLocalStorage('CameraTopic')
const logTopicStorage = useLocalStorage('LogTopic')
const videoPriorityStorage = useLocalStorage('WebRTCVideoPriority')
const videoPublisherSubscribeTopicName = '/robin/video_publisher_subscribe_topic'

const { topicsList } = useTopicsList(ros)
let videoPublisherSubscribeTopic: Topic | null = null

function ensureVideoPublisherSubscribeTopic() {
  if (videoPublisherSubscribeTopic) {
    return videoPublisherSubscribeTopic
  }

  videoPublisherSubscribeTopic = createTopic(
    ros,
    videoPublisherSubscribeTopicName,
    'std_msgs/String',
  )
  return videoPublisherSubscribeTopic
}

function publishCameraTopic(value: string) {
  const topic = value.trim()
  if (!topic) {
    return
  }

  ensureVideoPublisherSubscribeTopic().publish({
    data: topic,
  })
}

const cameraTopic = computed({
  get: () => cameraTopicStorage.value ?? '/camera/image_raw',
  set: (value: string) => {
    cameraTopicStorage.value = value
  },
})

const logTopic = computed({
  get: () => logTopicStorage.value ?? '/log',
  set: (value: string) => {
    logTopicStorage.value = value
  },
})

const videoPriority = computed({
  get: () => Number(videoPriorityStorage.value || 0),
  set: (value: number) => {
    videoPriorityStorage.value = String(value)
  },
})

const videoPriorityLabel = computed(() => {
  if (videoPriority.value <= 25) return 'Latency'
  if (videoPriority.value >= 75) return 'Quality'
  return 'Balanced'
})

const rosbridgeURL = buildRosWebSocketURL()
const videoPublisherURL = buildVideoPublisherBaseURL()

watch(
  [cameraTopic, status],
  ([value, connectionStatus]) => {
    if (connectionStatus === 'connected') publishCameraTopic(value)
  },
  { immediate: true },
)
</script>
