import { createService } from '@/infra/ros/rosClient'
import { computed, ref } from 'vue'
import { ros } from './useRosConnection'

export function useTopicsList() {
  const topicsService = createService(ros, '/rosapi/topics', 'rosapi/Topics')

  const _topicsList = ref<string[]>([])
  const topicsList = computed<Readonly<string[]>>(() => _topicsList.value)

  function updateTopicsList() {
    return new Promise<void>((resolve) => {
      topicsService.callService({}, (result) => {
        _topicsList.value = (result as { topics: string[] }).topics
        resolve()
      })
    })
  }

  updateTopicsList()

  return { topicsList, updateTopicsList }
}
