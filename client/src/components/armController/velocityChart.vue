<template>
  <details>
    <summary class="cursor-pointer select-none px-3 py-2 text-sm text-zinc-300">Velocity Graph</summary>
    <div class="h-72 w-full">
      <canvas ref="velocityChartCanvas" class="h-full w-full" />
    </div>
  </details>
</template>
<script setup lang="ts">
import { Chart, type ChartDataset } from 'chart.js/auto'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Vector3 } from '@/models/motion'

const { velocity } = defineProps<{
  velocity: Vector3
}>()

const velocityChartCanvas = ref<HTMLCanvasElement | null>(null)
let velocityChart: Chart<'line', number[], string> | null = null
let sampleCount = 0
let sampleIntervalId: number | null = null

const MAX_POINTS = 100
const SAMPLE_HZ = 20

function appendWithLimit(target: number[], value: number): void {
  target.push(value)
  if (target.length > MAX_POINTS) {
    target.shift()
  }
}

function appendLabel(label: string): void {
  if (!velocityChart) return
  velocityChart.data.labels?.push(label)
  if ((velocityChart.data.labels?.length ?? 0) > MAX_POINTS) {
    velocityChart.data.labels?.shift()
  }
}

function createDatasets(): ChartDataset<'line', number[]>[] {
  return [
    {
      label: 'Velocity X',
      data: [],
      borderColor: '#60a5fa',
      backgroundColor: '#60a5fa',
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.2,
    },
    {
      label: 'Velocity Y',
      data: [],
      borderColor: '#34d399',
      backgroundColor: '#34d399',
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.2,
    },
    {
      label: 'Velocity Z',
      data: [],
      borderColor: '#f59e0b',
      backgroundColor: '#f59e0b',
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.2,
    },
  ]
}

function initChart(): void {
  if (!velocityChartCanvas.value) return

  velocityChart = new Chart<'line', number[], string>(velocityChartCanvas.value, {
    type: 'line',
    data: {
      labels: [],
      datasets: createDatasets(),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: {
        mode: 'nearest',
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: 8,
            color: '#a1a1aa',
          },
          grid: {
            color: '#27272a',
          },
        },
        y: {
          ticks: {
            color: '#a1a1aa',
          },
          grid: {
            color: '#27272a',
          },
          title: {
            display: true,
            text: 'm/s',
            color: '#a1a1aa',
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: '#d4d4d8',
            boxWidth: 14,
            boxHeight: 3,
          },
        },
      },
    },
  })
}

function appendCurrentVelocitySample(): void {
  if (!velocityChart) return
  sampleCount += 1
  appendLabel(String(sampleCount))

  const datasetValues = [velocity.x, velocity.y, velocity.z]

  datasetValues.forEach((value, index) => {
    const dataset = velocityChart?.data.datasets[index]
    if (!dataset) return
    appendWithLimit(dataset.data as number[], value)
  })

  velocityChart.update('none')
}

onMounted(() => {
  initChart()
  sampleIntervalId = window.setInterval(appendCurrentVelocitySample, 1000 / SAMPLE_HZ)
})

onBeforeUnmount(() => {
  if (sampleIntervalId !== null) {
    window.clearInterval(sampleIntervalId)
    sampleIntervalId = null
  }
  velocityChart?.destroy()
  velocityChart = null
})
</script>
