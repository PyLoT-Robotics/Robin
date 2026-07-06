import { createTopic } from '@/infra/ros/rosClient'
import { ros } from '@/hooks/useRosConnection'

export function useTopicPublisher<TMessage extends object>(
  topicName: string,
  messageType: string,
) {
  const topic = createTopic(ros, topicName, messageType)

  return {
    publish(message: TMessage) {
      topic.publish(message)
    },
  }
}
