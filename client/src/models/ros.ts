import type { Action, Ros, Topic } from 'roslib'

export type RosConnectionStatus = 'connected' | 'closed' | 'error'

export type JoyMessage = {
  axes: number[]
  buttons: number[]
}

export type StringMessage = {
  data: string
}

export type RosMessageHandler = (message: unknown, topicName: string) => void

export type { Action, Ros, Topic }
