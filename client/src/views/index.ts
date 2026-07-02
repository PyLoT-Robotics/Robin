import { defineAsyncComponent, type Component } from 'vue'

const ArmController = defineAsyncComponent(() => import('./armController.vue'))
const LiveVideo = defineAsyncComponent(() => import('./live_video.vue'))
const Log = defineAsyncComponent(() => import('./log.vue'))
const Map = defineAsyncComponent(() => import('./map.vue'))
const Settings = defineAsyncComponent(() => import('./settings.vue'))

type ViewDefinition = {
  icon: string
  component: Component
}

export const views = {
  live_video: {
    icon: 'fa6-solid:video',
    component: LiveVideo,
  },
  log: {
    icon: 'bi:terminal',
    component: Log,
  },
  map: {
    icon: 'bi:map',
    component: Map,
  },
  armController: {
    icon: 'streamline-ultimate:factory-industrial-robot-arm-1-bold',
    component: ArmController,
  },
  settings: {
    icon: 'bi:gear',
    component: Settings,
  },
} as const satisfies Record<string, ViewDefinition>
