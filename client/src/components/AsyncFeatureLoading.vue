<template>
  <div class="grid h-full min-h-24 w-full place-content-center gap-3 text-center text-zinc-300">
    <div class="mx-auto size-6 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
    <p class="text-sm">Downloading {{ name }}...</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ name: string }>()
</script>
