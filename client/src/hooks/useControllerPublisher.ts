import { createControllerTopicInterval } from '@/infra/ros/joyPublisher'
import type { Control } from '@/models/control'
import { ros } from './useRosConnection'

export function startControllerPublisher(tps: number, controls: Control) {
  return createControllerTopicInterval(ros, tps, controls)
}
