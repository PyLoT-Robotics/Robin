import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

import { createService, createTopic } from '@/infra/ros/rosClient'
import { ros } from '@/hooks/useRosConnection'
import type { RosMessageHandler, Topic } from '@/models/ros'

export function useRosTopicSubscription(
  topicName: Readonly<Ref<string>>,
  onMessage: RosMessageHandler,
) {
  const error = ref<string | null>(null)
  const topicTypeService = createService(ros, '/rosapi/topic_type', 'rosapi/TopicType')
  let subscriber: Topic | null = null
  let subscriptionGeneration = 0

  function stop() {
    subscriber?.unsubscribe()
    subscriber = null
  }

  function resolveTopicType(name: string) {
    return new Promise<string>((resolve) => {
      topicTypeService.callService({ topic: name }, (result) => {
        const type = (result as { type?: string }).type
        resolve(type && type.length > 0 ? type : 'std_msgs/String')
      })
    })
  }

  async function subscribe(name: string) {
    const generation = ++subscriptionGeneration
    stop()
    error.value = null
    if (!name) return

    try {
      const topicType = await resolveTopicType(name)
      if (generation !== subscriptionGeneration) return
      subscriber = createTopic(ros, name, topicType)
      subscriber.subscribe((message) => onMessage(message, name))
    } catch (subscriptionError) {
      error.value = `Failed to subscribe: ${String(subscriptionError)}`
    }
  }

  watch(topicName, subscribe, { immediate: true })
  onBeforeUnmount(() => {
    subscriptionGeneration += 1
    stop()
  })

  return { error, resubscribe: subscribe, stop }
}
