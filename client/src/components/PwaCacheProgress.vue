<template>
  <aside
    v-if="visible"
    class="fixed z-50 right-3 top-3 w-80 max-w-[calc(100vw-1.5rem)] rounded-md border border-zinc-700 bg-zinc-950/95 p-3 text-zinc-100 shadow-xl"
    role="status"
    aria-live="polite"
  >
    <div class="mb-2 flex justify-between gap-3 text-sm">
      <span>{{ title }}</span>
      <span v-if="pwaCache.state.value !== 'downloading'" class="font-mono">{{ pwaCache.percentage.value }}%</span>
    </div>
    <div v-if="pwaCache.state.value !== 'downloading'" class="h-2 overflow-hidden rounded-full bg-zinc-800">
      <div
        class="h-full bg-sky-500 transition-[width] duration-200"
        :style="{ width: `${pwaCache.percentage.value}%` }"
      />
    </div>
    <p class="mt-2 truncate font-mono text-xs text-zinc-400" :title="pwaCache.currentFile.value">
      <template v-if="pwaCache.total.value">
        {{ pwaCache.completed.value }}/{{ pwaCache.total.value }} ·
      </template>
      {{ pwaCache.currentFile.value }}
    </p>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { pwaCache } from '@/pwa'

const visible = ref(pwaCache.state.value !== 'ready')
let hideTimer: ReturnType<typeof setTimeout> | undefined

const title = computed(() => {
  if (pwaCache.state.value === 'error') return 'Offline cache error'
  if (pwaCache.state.value === 'downloading') return 'Downloading feature'
  if (pwaCache.state.value === 'ready') return 'Robin is ready offline'
  return 'Downloading minimum UI'
})

watch(pwaCache.state, (state) => {
  visible.value = true
  if (state === 'ready') {
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => { visible.value = false }, 3000)
  }
}, { immediate: true })
</script>
