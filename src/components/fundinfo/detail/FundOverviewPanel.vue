<!-- src/components/fundinfo/detail/FundOverviewPanel.vue -->
<script setup>
// Presentation + local chart UI-state only (mode/range toggles); analytics derivation stays in
// useFundAnalytics, injected as the `navHistory` prop. Renders via Vue's auto-escaping {{ }}
// interpolation and Chart.js's canvas API — never v-html/innerHTML (the old prototype used
// `container.innerHTML = \`...${fund.name}...\``, a DOM-based XSS vector).
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  fund: { type: Object, required: true },
  accent: { type: String, required: true },
  isDark: { type: Boolean, default: false },
  // (range: '1M'|'3M'|'1Y'|'3Y'|'5Y'|'MAX') => { labels, rawLabels, navData, totalReturnData, benchmarkData, isDaily }
  // Injected from useFundAnalytics(fundRef).navHistory — keeps derivation centralized.
  navHistory: { type: Function, required: true },
  // useFundAnalytics(fundRef).apiNavHistoryVersion.value — bumps when the async daily NAV series
  // lands, telling us to re-call navHistory() and redraw (navHistory itself isn't reactive).
  navHistoryVersion: { type: Number, default: 0 },
})

const RANGES = ['1M', '3M', '1Y', '3Y', '5Y', 'MAX']
const MODES = [
  { key: 'nav', label: 'ราคา NAV (฿)' },
  { key: 'return', label: 'ผลตอบแทน (%)' },
]

// No real currency NAV series until the daily series loads (only checkpoint returns) —
// "ผลตอบแทน (%)" is the honest default mode.
const mode = ref('return')
const range = ref('1Y')
const chartRef = ref(null)
const usingDailySeries = ref(false)
let chartInstance = null

function setMode(key) {
  mode.value = key
}
function setRange(key) {
  range.value = key
}

// Perf: gradient must rebuild against the live 2D context each render — CanvasGradient can't be cached.
function buildGradient(canvas, color) {
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 0, 240)
  gradient.addColorStop(0, `${color}44`)
  gradient.addColorStop(1, `${color}00`)
  return gradient
}

function renderChart() {
  // Perf: dispose the previous instance first — Chart.js otherwise leaks a render/resize loop per toggle.
  chartInstance?.destroy()
  chartInstance = null
  if (!chartRef.value || !props.fund) return

  const history = props.navHistory(range.value)
  usingDailySeries.value = !!history?.isDaily
  if (!history?.navData?.length) return // Robustness: no series yet for this fund/range

  const textColor = props.isDark ? '#93a3c0' : '#607091'
  const gridColor = props.isDark ? 'rgba(148,163,184,.08)' : 'rgba(148,163,184,.14)'
  const isReturn = mode.value === 'return'

  const datasets = []
  if (!isReturn) {
    datasets.push({
      label: 'ราคา NAV',
      data: history.navData,
      borderColor: props.accent,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: true,
      backgroundColor: buildGradient(chartRef.value, props.accent),
      tension: 0.1,
    })
  } else {
    // Robustness: guard divide-by-zero if a series ever starts at 0
    const fundStart = history.navData[0] || 1
    const benchStart = history.benchmarkData?.[0] || 1
    datasets.push({
      label: 'ผลตอบแทนกองทุน (%)',
      data: history.navData.map((v) => +((v / fundStart - 1) * 100).toFixed(2)),
      borderColor: props.accent,
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      tension: 0.1,
    })
    datasets.push({
      label: 'ผลตอบแทนเกณฑ์มาตรฐาน (%)',
      data: (history.benchmarkData || []).map((v) => +((v / benchStart - 1) * 100).toFixed(2)),
      borderColor: '#94a3b8',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 4,
      fill: false,
      tension: 0.1,
    })
  }

  chartInstance = new Chart(chartRef.value, {
    type: 'line',
    data: { labels: history.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: {
          display: isReturn,
          position: 'top',
          labels: { font: { size: 11 }, color: textColor, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            // Anti-XSS: Chart.js draws tooltip text to <canvas>, never innerHTML.
            title: (ctx) => history.rawLabels[ctx[0].dataIndex],
            label: (ctx) => {
              const val = ctx.parsed.y
              return isReturn
                ? ` ${ctx.dataset.label}: ${val > 0 ? '+' : ''}${val.toFixed(2)}%`
                : ` ${ctx.dataset.label}: ${val.toFixed(4)} ฿`
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 }, color: textColor, maxRotation: 0, autoSkip: false },
        },
        y: {
          ticks: {
            font: { size: 11 },
            color: textColor,
            callback: (v) => (isReturn ? `${v > 0 ? '+' : ''}${v.toFixed(1)}%` : `${v.toFixed(2)} ฿`),
          },
          grid: { color: gridColor },
        },
      },
    },
  })
}

onMounted(renderChart)
onUnmounted(() => chartInstance?.destroy()) // Perf: release canvas/GPU resources when the panel unmounts

// Single watcher for everything that should trigger a redraw: toggle state, fund id (cheap
// compare), and theme (Chart.js colors are baked in at creation, so dark mode needs a full re-render).
watch([mode, range, () => props.fund?.id, () => props.isDark, () => props.navHistoryVersion], renderChart)
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="text-base font-extrabold txt">กราฟภาพรวม</h2>

      <div class="flex items-center gap-3 flex-wrap">
        <!-- Mode toggle: NAV price vs. % return -->
        <div class="flex items-center gap-1 surf2 p-0.5 rounded-lg" role="group" aria-label="รูปแบบกราฟ">
          <button
            v-for="m in MODES"
            :key="m.key"
            type="button"
            class="fpill"
            :class="{ on: mode === m.key }"
            :aria-pressed="mode === m.key"
            @click="setMode(m.key)"
          >{{ m.label }}</button>
        </div>

        <!-- Range toggle -->
        <div class="flex items-center gap-1 surf2 p-0.5 rounded-lg" role="group" aria-label="ช่วงเวลา">
          <button
            v-for="r in RANGES"
            :key="r"
            type="button"
            class="fpill num"
            :class="{ on: range === r }"
            :aria-pressed="range === r"
            @click="setRange(r)"
          >{{ r }}</button>
        </div>
      </div>
    </div>

    <!-- Anti-XSS: canvas is an opaque rendering surface — Chart.js draws via the 2D/GPU API, no HTML sink. -->
    <div class="h-[400px] relative">
      <canvas ref="chartRef"></canvas>
    </div>

    <p class="text-[10px] sub text-right">
      {{ usingDailySeries
        ? '* หมายเหตุ: ราคา NAV ปิดจริงรายวันจาก API'
        : '* หมายเหตุ: ยังไม่มีราคาปิดรายวันสำหรับกองทุน/ช่วงเวลานี้ กราฟนี้จึงคำนวณจากผลตอบแทนสะสมจริงตามช่วงเวลาที่ API เปิดเผย (1M/3M/1Y/3Y/5Y/10Y) แทน' }}
    </p>
  </section>
</template>
