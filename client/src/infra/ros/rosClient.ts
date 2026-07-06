import * as RosLib from 'roslib'
import type { Ros } from '@/models/ros'

export function createTopic(ros: Ros, name: string, messageType: string) {
  return new RosLib.Topic({
    ros,
    name,
    messageType,
  })
}

export function createService(
  ros: Ros,
  name: string,
  serviceType: 'rosapi/Topics' | 'rosapi/TopicType',
) {
  return new RosLib.Service({
    ros,
    name,
    serviceType,
  })
}

export function createAction(ros: Ros, name: string, actionType: string) {
  return new RosLib.Action({
    ros,
    name,
    actionType,
  })
}
