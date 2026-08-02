import { createTopic } from './rosClient'
import type { Control } from '@/models/control'
import type { JoyMessage, Ros, StringMessage } from '@/models/ros'

const JOY_TOPIC_NAME = '/joy'
const JOY_TOPIC_TYPE_ROS1 = 'sensor_msgs/Joy'
const JOY_TOPIC_TYPE_ROS2 = 'sensor_msgs/msg/Joy'
const STRING_TOPIC_TYPE = 'std_msgs/String'

function getDpadValue(a: boolean, b: boolean): number {
  return a ? (b ? 0 : 1) : b ? -1 : 0
}

function convertControlToJoyMessage(controls: Control): JoyMessage {
  const dpadX = getDpadValue(controls.RIGHT, controls.LEFT)
  const dpadY = getDpadValue(controls.DOWN, controls.UP)
  return {
    axes: [
      controls.leftStick.x,
      controls.leftStick.y,
      controls.LT ? 1 : 0,
      controls.rightStick.y,
      controls.rightStick.x,
      controls.RT ? 1 : 0,
      dpadX,
      dpadY,
    ],
    buttons: [
      controls.A ? 1 : 0,
      controls.B ? 1 : 0,
      controls.X ? 1 : 0,
      controls.Y ? 1 : 0,
      controls.LB ? 1 : 0,
      controls.RB ? 1 : 0,
      controls.LT ? 1 : 0,
      controls.RT ? 1 : 0,
      0,
      0,
      0,
    ],
  }
}

function normalizeJoyTopicType(topicType: string): string {
  if (topicType === JOY_TOPIC_TYPE_ROS1 || topicType === JOY_TOPIC_TYPE_ROS2) {
    return topicType
  }

  if (topicType === STRING_TOPIC_TYPE) {
    return STRING_TOPIC_TYPE
  }

  return JOY_TOPIC_TYPE_ROS1
}

export function createControllerTopicInterval(ros: Ros, TPS: number, controls: Control) {
  let joyTopicType = JOY_TOPIC_TYPE_ROS1
  let joyTopic = createTopic(ros, JOY_TOPIC_NAME, joyTopicType)
  let resolved = false

  ros.getTopicType(JOY_TOPIC_NAME, (topicType) => {
    joyTopicType = normalizeJoyTopicType(topicType)
    joyTopic = createTopic(ros, JOY_TOPIC_NAME, joyTopicType)
    resolved = true
  })

  return setInterval(() => {
    const joyMessage = convertControlToJoyMessage(controls)

    if (!resolved) {
      joyTopic.publish(joyMessage)
      return
    }

    if (joyTopicType === STRING_TOPIC_TYPE) {
      const stringMessage: StringMessage = { data: JSON.stringify(joyMessage) }
      joyTopic.publish(stringMessage)
      return
    }

    joyTopic.publish(joyMessage)
  }, 1000 / TPS)
}
