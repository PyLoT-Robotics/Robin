<template>
  <div
    v-if="status === 'error' || status === 'closed'"
    class="border-red-500 border-b text-red-400 bg-red-500/20 flex flex-row items-center justify-center gap-2 py-2">
    <span>{{ error || 'Cannot connect to ROS.' }}</span>
    <button
      @click="connect"
      class="underline">Reconnect</button>
  </div>
</template>
<script setup lang="ts">
import { status, error, connect } from '@/plugins/ros'
</script>
