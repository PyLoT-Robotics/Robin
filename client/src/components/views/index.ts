import { defineAsyncComponent, h, type Component } from 'vue'
import AsyncFeatureLoading from '@/components/AsyncFeatureLoading.vue'
import type { ViewDefinition } from '@/models/view'

function asyncView(name: string, loader: () => Promise<Component>) {
  return defineAsyncComponent({
    loader,
    delay: 0,
    loadingComponent: { render: () => h(AsyncFeatureLoading, { name }) },
  })
}

const ArmController = asyncView('arm controller', () => import('./ArmControllerView.vue'))
const LiveVideo = asyncView('live video', () => import('./LiveVideoView.vue'))
const Log = asyncView('logs', () => import('./LogView.vue'))
const Map = asyncView('map', () => import('./MapView.vue'))
const Settings = asyncView('settings', () => import('./SettingsView.vue'))
const StagPose = asyncView('STag pose', () => import('./StagPoseView.vue'))

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
  stagPose: {
    icon: 'bi:camera',
    component: StagPose,
    usesRos: true,
  },
  settings: {
    icon: 'bi:gear',
    component: Settings,
    usesRos: true,
  },
} as const satisfies Record<string, ViewDefinition>
