<template>
  <details class="border-b border-zinc-700">
    <summary class="cursor-pointer select-none px-3 py-2 text-sm text-zinc-300">Acceleration Graph</summary>
    <div class="h-72 w-full">
      <canvas ref="accelChartCanvas" class="h-full w-full" />
    </div>
  </details>
</template>
<script setup lang="ts">
import { Chart, type ChartDataset } from 'chart.js/auto'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Vector3 } from '@/models/motion'

const {
  acceleration
} = defineProps<{
  acceleration: Vector3
}>()

const accelChartCanvas = ref<HTMLCanvasElement | null>(null)
let accelChart: Chart<'line', number[], string> | null = null
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
  if (!accelChart) return
  accelChart.data.labels?.push(label)
  if ((accelChart.data.labels?.length ?? 0) > MAX_POINTS) {
    accelChart.data.labels?.shift()
  }
}

function createDatasets(): ChartDataset<'line', number[]>[] {
  return [
    {
      label: 'Accel X',
      data: [],
      borderColor: '#60a5fa',
      backgroundColor: '#60a5fa',
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.2,
    },
    {
      label: 'Accel Y',
      data: [],
      borderColor: '#34d399',
      backgroundColor: '#34d399',
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.2,
    },
    {
      label: 'Accel Z',
      data: [],
      borderColor: '#f59e0b',
      backgroundColor: '#f59e0b',
      pointRadius: 0,
      borderWidth: 1.5,
      tension: 0.2,
    }
  ]
}

function applyRawVisibility(): void {
  if (!accelChart) return
  for (let i = 0; i < 3; i += 1) {
    const dataset = accelChart.data.datasets[i]
    if (!dataset) continue
  }
}

function initChart(): void {
  if (!accelChartCanvas.value) return

  accelChart = new Chart<'line', number[], string>(accelChartCanvas.value, {
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
            text: 'm/s²',
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

  applyRawVisibility()
}

function appendCurrentAccelerationSample(): void {
  if(!accelChart) return
  sampleCount += 1
  appendLabel(String(sampleCount))

  const datasetValues = [
    acceleration.x,
    acceleration.y,
    acceleration.z
  ]

  datasetValues.forEach((value, index) => {
    const dataset = accelChart?.data.datasets[index]
    if (!dataset) return
    appendWithLimit(dataset.data as number[], value)
  })

  accelChart.update('none')
}

onMounted(() => {
  initChart()
  sampleIntervalId = window.setInterval(appendCurrentAccelerationSample, 1000 / SAMPLE_HZ)
})

onBeforeUnmount(() => {
  if (sampleIntervalId !== null) {
    window.clearInterval(sampleIntervalId)
    sampleIntervalId = null
  }
  accelChart?.destroy()
  accelChart = null
})
</script>
