import { defineAsyncComponent, h, type Component } from 'vue'
import AsyncFeatureLoading from '@/components/AsyncFeatureLoading.vue'

function asyncView(name: string, loader: () => Promise<Component>) {
  return defineAsyncComponent({
    loader,
    delay: 0,
    loadingComponent: { render: () => h(AsyncFeatureLoading, { name }) },
  })
}

const ArmController = asyncView('arm controller', () => import('./armController.vue'))
const LiveVideo = asyncView('live video', () => import('./live_video.vue'))
const Log = asyncView('logs', () => import('./log.vue'))
const Map = asyncView('map', () => import('./map.vue'))
const Settings = asyncView('settings', () => import('./settings.vue'))

type ViewDefinition = {
  icon: string
  component: Component
  usesRos: boolean
}

export const views = {
  live_video: {
    icon: 'fa6-solid:video',
    component: LiveVideo,
    usesRos: false,
  },
  log: {
    icon: 'bi:terminal',
    component: Log,
    usesRos: true,
  },
  map: {
    icon: 'bi:map',
    component: Map,
    usesRos: true,
  },
  armController: {
    icon: 'streamline-ultimate:factory-industrial-robot-arm-1-bold',
    component: ArmController,
    usesRos: true,
  },
  settings: {
    icon: 'bi:gear',
    component: Settings,
    usesRos: true,
  },
} as const satisfies Record<string, ViewDefinition>
