<template>
  <div class="w-full h-full bg-zinc-950 border-l border-zinc-800/80 flex flex-col min-h-0">
    <div class="shrink-0 px-3 py-2 border-b border-zinc-800/80 font-mono text-xs text-zinc-400">
      <div class="flex items-center justify-between gap-2">
        <p>topic: {{ activeTopic }}</p>
        <button
          type="button"
          class="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800"
          @click="isPaused = !isPaused"
        >
          {{ isPaused ? '再開' : '停止' }}
        </button>
      </div>
      <p v-if="subscribeError" class="text-red-400">{{ subscribeError }}</p>
      <p v-if="copiedMessage" class="text-emerald-400">{{ copiedMessage }}</p>
    </div>

    <div
      ref="logContainer"
      class="grow min-h-0 overflow-y-auto px-3 py-2 font-mono text-xs leading-5 text-zinc-200"
    >
      <p v-if="entries.length === 0" class="text-zinc-500">Waiting for messages...</p>
      <p
        v-for="entry in entries"
        :key="entry.id"
        class="whitespace-pre-wrap break-all cursor-pointer hover:text-emerald-300"
        @click="copyLine(entry.line)"
      >
        {{ entry.line }}
      </p>
    </div>
  </div>
</template>
<script setup lang="ts">
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useRosTopicSubscription } from '@/hooks/useRosTopicSubscription'
import type { LogEntry } from '@/models/log'
import { nextTick, onBeforeUnmount, ref } from 'vue'

const MAX_LINES = 50

const entries = ref<LogEntry[]>([])
const logContainer = ref<HTMLElement | null>(null)
const isPaused = ref(false)
const copiedMessage = ref<string | null>(null)

let copiedMessageTimer: ReturnType<typeof setTimeout> | null = null

let sequence = 0

const activeTopic = useLocalStorage('LogTopic')

function pushLine(line: string) {
  sequence += 1
  entries.value.push({
    id: sequence,
    line,
  })

  if (entries.value.length > MAX_LINES) {
    entries.value.splice(0, entries.value.length - MAX_LINES)
  }

  nextTick(() => {
    if (!logContainer.value) {
      return
    }
    logContainer.value.scrollTop = logContainer.value.scrollHeight
  })
}

async function copyLine(line: string) {
  try {
    await navigator.clipboard.writeText(line)
    copiedMessage.value = 'ログをコピーしました'
  } catch {
    copiedMessage.value = 'コピーに失敗しました'
  }

  if (copiedMessageTimer) {
    clearTimeout(copiedMessageTimer)
  }

  copiedMessageTimer = setTimeout(() => {
    copiedMessage.value = null
  }, 1200)
}

const { error: subscribeError } = useRosTopicSubscription(
  activeTopic,
  (message, topicName) => {
    if (isPaused.value) return
    const timestamp = new Date().toLocaleTimeString()
    pushLine(`[${timestamp}] ${topicName} ${JSON.stringify(message)}`)
  }
)

onBeforeUnmount(() => {
  if (copiedMessageTimer) {
    clearTimeout(copiedMessageTimer)
  }
})
</script>
