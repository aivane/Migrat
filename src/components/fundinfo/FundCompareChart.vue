<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  title: { type: String, default: 'เปรียบเทียบ Performance กลุ่มภาพรวม' },
  items: { type: Array, default: () => [] }, // List of sectors / funds to compare
})

// เก็บ ID/Name ของกลุ่มที่เลือกแสดงบนกราฟ
const selectedNames = ref([])

// Initialize selected items ( default เลือกทั้งหมด )
watch(
  () => props.items,
  (newItems) => {
    if (newItems.length && !selectedNames.value.length) {
      selectedNames.value = newItems.map((i) => i.name)
    }
  },
  { immediate: true },
)

const activeItems = computed(() => {
  return props.items.filter((item) => selectedNames.value.includes(item.name))
})

const lineChartRef = ref(null)
let chartInstance = null

function toggleItem(name) {
  if (selectedNames.value.includes(name)) {
    if (selectedNames.value.length > 1) {
      selectedNames.value = selectedNames.value.filter((n) => n !== name)
    }
  } else {
    selectedNames.value.push(name)
  }
}

function resetAll() {
  selectedNames.value = props.items.map((i) => i.name)
}

function renderChart() {
  if (!lineChartRef.value) return
  if (chartInstance) chartInstance.destroy()

  const months = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.']
  const colors = ['#2456d8', '#12b76a', '#f59e0b', '#7a5af5', '#ec4899', '#06b6d4']

  const datasets = activeItems.value.map((item, idx) => {
    // Generate mock performance trend curves
    const basePerf = item.perf || 5
    const dataPoints = months.map((_, i) => {
      const noise = Math.sin(i + idx) * 3
      return Number(((basePerf / 12) * (i + 1) + noise).toFixed(1))
    })

    return {
      label: item.name,
      data: dataPoints,
      borderColor: colors[idx % colors.length],
      backgroundColor: colors[idx % colors.length] + '1A',
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 2,
    }
  })

  chartInstance = new Chart(lineChartRef.value, {
    type: 'line',
    data: { labels: months, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          ticks: { callback: (v) => `${v}%`, font: { family: 'Prompt', size: 12 } },
          grid: { color: 'rgba(150, 150, 150, 0.1)' },
        },
        x: {
          ticks: { font: { family: 'Prompt', size: 12 } },
          grid: { display: false },
        },
      },
    },
  })
}

watch([activeItems, lineChartRef], () => renderChart(), { deep: true })
onMounted(() => renderChart())
onUnmounted(() => {
  if (chartInstance) chartInstance.destroy()
})
</script>

<template>
  <div class="surf brd rounded-2xl p-4 md:p-5 space-y-4">
    <!-- Filter Tags Bar ด้านบน -->
    <div class="flex flex-wrap items-center gap-2 pb-3 border-b brd">
      <span class="text-xs font-bold sub uppercase mr-2">กลุ่มที่เลือกเปรียบเทียบ ({{ activeItems.length }}/{{ items.length }}):</span>
      <button
        v-for="(item, idx) in items"
        :key="item.name"
        @click="toggleItem(item.name)"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border"
        :class="
          selectedNames.includes(item.name)
            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
            : 'surf2 txt border-slate-300 dark:border-slate-700 opacity-60 hover:opacity-100'
        "
      >
        <span>{{ idx + 1 }}. {{ item.name }}</span>
        <span v-if="selectedNames.includes(item.name)" class="text-[10px] ml-0.5">✕</span>
      </button>

      <button
        v-if="selectedNames.length < items.length"
        @click="resetAll"
        class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline ml-auto"
      >
        เลือกทั้งหมด
      </button>
    </div>

    <!-- Main Section: Graph (Left) + Side Details (Right) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
      <!-- Line Chart Area -->
      <div class="lg:col-span-8 surf2 brd rounded-xl p-4 flex flex-col justify-between min-h-[280px]">
        <div class="flex justify-between items-center mb-2">
          <h3 class="text-xs font-bold sub uppercase tracking-wider">{{ title }}</h3>
          <span class="text-[11px] sub">ผลตอบแทนย้อนหลัง 12 เดือน</span>
        </div>
        <div class="h-60 relative w-full">
          <canvas ref="lineChartRef"></canvas>
        </div>
      </div>

      <!-- Right Sidebar: Active Groups List & Quick Stats -->
      <div class="lg:col-span-4 space-y-2.5 overflow-y-auto max-h-[320px] pr-1">
        <div
          v-for="(item, idx) in activeItems"
          :key="item.name"
          class="surf brd p-3 rounded-xl flex items-center justify-between text-xs hover:border-blue-500/50 transition-colors"
        >
          <div class="space-y-0.5">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-blue-600"></span>
              <strong class="txt font-bold">{{ idx + 1 }}. {{ item.name }}</strong>
            </div>
            <p class="text-[11px] sub truncate max-w-[150px]">{{ item.sub || 'สัดส่วนหลักในพอร์ต' }}</p>
          </div>

          <div class="text-right">
            <span class="block font-bold num" :class="(item.perf || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'">
              {{ (item.perf || 0) >= 0 ? '+' : '' }}{{ (item.perf || 0).toFixed(1) }}%
            </span>
            <span class="text-[10px] sub">นัยสำคัญ {{ item.weight || '18.2%' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>