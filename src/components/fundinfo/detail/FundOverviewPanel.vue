<!-- src/components/fundinfo/detail/FundOverviewPanel.vue -->
<script setup>
// Ported from "Panel 1: กราฟภาพรวม" (tab-overview) in the v3.2.1 HTML
// prototype, converted from JS tab-switching (hidden/shown via classList)
// into an always-visible section for the full-page layout.
//
// Presentation + local, ephemeral chart UI-state only (mode/range toggles).
// All mock-analytics derivation stays in useFundAnalytics — this component
// receives its `navHistory` function as a prop and never re-implements the
// derivation itself, mirroring FundDetailHeader.vue's pattern.
//
// Security note: the original prototype built this markup via
// `container.innerHTML = \`...${fund.name}...\`` (raw string interpolation
// into innerHTML) — a DOM-based XSS vector if any fund field were ever
// attacker-influenced. This component never uses v-html; all text goes
// through Vue's auto-escaping {{ }} interpolation, and all chart labels are
// drawn to <canvas> via the Chart.js API (never innerHTML).
import { ref, onMounted, onUnmounted, watch } from 'vue'
import Chart from 'chart.js/auto'
import { fundinfoApiMode } from '../../../services/fundinfoApi'

const props = defineProps({
  fund: { type: Object, required: true },
  accent: { type: String, required: true },
  isDark: { type: Boolean, default: false },
  // (range: '1M'|'3M'|'1Y'|'3Y'|'5Y'|'MAX') => { labels, rawLabels, navData, totalReturnData, benchmarkData, isDaily }
  // Inject useFundAnalytics(fundRef).navHistory from the parent — keeps
  // mock-data derivation centralized and this panel purely presentational.
  navHistory: { type: Function, required: true },
  // useFundAnalytics(fundRef).apiNavHistoryVersion.value — the real daily NAV
  // series loads asynchronously after first render, so this bumps to tell us
  // to re-call navHistory() and redraw once it lands (navHistory() itself is
  // a plain sync function, not reactive on its own).
  navHistoryVersion: { type: Number, default: 0 },
})

const RANGES = ['1M', '3M', '1Y', '3Y', '5Y', 'MAX']
const MODES = [
  { key: 'nav', label: 'ราคา NAV (฿)' },
  { key: 'return', label: 'ผลตอบแทน (%)' },
]

// API Compatibility — direct mode has no real currency NAV series (only
// checkpoint return percentages), so "ผลตอบแทน (%)" is the honest default;
// mock mode keeps the original NAV-price default.
const mode = ref(fundinfoApiMode === 'mock' ? 'nav' : 'return')
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

// Perf: gradient must be rebuilt against the live 2D context on every
// (re)render — a CanvasGradient can't be cached in a computed/ref.
function buildGradient(canvas, color) {
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 0, 240)
  gradient.addColorStop(0, `${color}44`)
  gradient.addColorStop(1, `${color}00`)
  return gradient
}

function renderChart() {
  // Perf: dispose the previous instance before creating a new one — Chart.js
  // keeps a render/resize loop bound to the canvas otherwise, leaking memory
  // on every mode/range toggle.
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
            // Anti-XSS: Chart.js renders tooltip text to <canvas> via its
            // own drawing API, not via innerHTML — these strings can never
            // be interpreted as markup regardless of source data.
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

// Single watcher for everything that must trigger a redraw: toggle state,
// the active fund (compared by id, not full object, to keep this cheap),
// and theme (Chart.js colors are baked in at creation time, not reactive,
// so a dark-mode toggle needs a full re-render, not just a CSS change).
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

    <!-- Anti-XSS: canvas is an opaque rendering surface: Chart.js draws to
         it via the 2D/GPU API, so there is no HTML sink here at all. -->
    <div class="h-[400px] relative">
      <canvas ref="chartRef"></canvas>
    </div>

    <p class="text-[10px] sub text-right">
      {{ fundinfoApiMode === 'mock'
        ? '* หมายเหตุ: กราฟนี้เคลื่อนไหวโดยอ้างอิงจากลักษณะสถิติความผันผวนย้อนหลังของกองทุนรวมจริง'
        : usingDailySeries
          ? '* หมายเหตุ: ราคา NAV ปิดจริงรายวันจาก API'
          : '* หมายเหตุ: ยังไม่มีราคาปิดรายวันสำหรับกองทุน/ช่วงเวลานี้ กราฟนี้จึงคำนวณจากผลตอบแทนสะสมจริงตามช่วงเวลาที่ API เปิดเผย (1M/3M/1Y/3Y/5Y/10Y) แทน' }}
    </p>
  </section>
</template>
