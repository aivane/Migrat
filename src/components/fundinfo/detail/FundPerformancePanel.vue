<!-- src/components/fundinfo/detail/FundPerformancePanel.vue -->
<script setup>
// Renders via Vue's auto-escaping bindings, not the old tbody.innerHTML build (XSS-prone).
// Risk-metric toggle is local UI state; return/dividend data come from useFundAnalytics via props.
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import Chart from 'chart.js/auto'
import { INSIGHT } from '../../../data/fundinfoConstants'

const props = defineProps({
  fund: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  // (periodKey) => groupAveragePct | null — from useFundAnalytics(fundRef)
  groupAverage: { type: Function, required: true },
  // [{ closedDate, paidDate, amount }] — from useFundAnalytics(fundRef).dividendHistory
  dividendHistory: { type: Array, default: () => [] },
})

// ---------- Dividend history ----------
// direct mode's dividendHistory is always [] (no payment-history endpoint, only a policy flag).
// has_dividend is unreliable (~99% =1 regardless of policy) — only dividend_policy text is trustworthy.
const paysDividends = computed(() => props.fund.dividendPolicy === 'จ่าย')

// ---------- Return comparison table ----------
// `?? 0` guards missing fields (retP is trusted app data, not user input). "6 เดือน"/"10 ปี" used to
// fabricate y1*0.6/y5*1.5 instead of real retP.m6/retP.y10 — groupAverage now keys off the real fields.
const returnRows = computed(() => {
  const r = props.fund.retP || {}
  return [
    { key: 'q1', label: '3 เดือน', value: r.q1 ?? 0 },
    { key: 'm6', label: '6 เดือน', value: r.m6 ?? 0 },
    { key: 'y1', label: '1 ปี', value: r.y1 ?? 0 },
    { key: 'y3', label: '3 ปี (annualized)', value: r.y3 ?? 0 },
    { key: 'y5', label: '5 ปี (annualized)', value: r.y5 ?? 0 },
    { key: 'y10', label: '10 ปี (annualized)', value: r.y10 ?? 0 },
  ].map((row) => ({ ...row, groupAvg: props.groupAverage(row.key) }))
})

const benchLabel = computed(() => {
  const f = props.fund
  return INSIGHT[f.master]?.bench || INSIGHT[f.themes?.[0]]?.bench || 'ดัชนีกลุ่มที่เหมาะสม'
})

function fmtPct(v) {
  return `${v > 0 ? '+' : ''}${v}%`
}

// ---------- Risk-metric toggle table (SD / Sharpe / Max Drawdown) ----------
const RISK_METRICS = [
  { key: 'sd', label: 'SD', suffix: '%' },
  { key: 'sharpe', label: 'SHARPE RATIO', suffix: '' },
  { key: 'maxdd', label: 'MAX DRAWDOWN', suffix: '' },
]
const riskMetric = ref('sd')

// Previously used a hardcoded mock multiplier table even in direct mode. API only publishes
// 1Y/3Y SD/Sharpe/MaxDrawdown (no 3M/6M/5Y/10Y) — only real periods shown; null values render "-".
const CATEGORY_AVG_RISK_KEY = { sharpe: 'sharpe1y', maxdd: 'maxdd1y' } // no peer SD field at all
const riskRows = computed(() => {
  const avgKey = CATEGORY_AVG_RISK_KEY[riskMetric.value]
  return [
    { label: '1 ปี', fVal: props.fund.stats?.[riskMetric.value] ?? null, gVal: avgKey ? (props.fund.categoryAvg?.[avgKey] ?? null) : null },
    { label: '3 ปี', fVal: props.fund.stats3y?.[riskMetric.value] ?? null, gVal: null },
  ]
})
const activeSuffix = computed(() => RISK_METRICS.find((m) => m.key === riskMetric.value)?.suffix || '')
function fmtRisk(v, suffix) {
  return v == null ? '-' : `${v}${suffix}`
}

// ---------- Calendar-year returns bar chart ----------
// API has no true calendar-year series, only checkpoints (1M/3M/1Y/3Y/5Y/10Y). Uses retPRaw
// (null-aware), not retP (defaults missing periods to 0%), so young funds render muted, not fabricated.
const PERIOD_BARS = [
  ['m1', '1M'], ['q1', '3M'], ['y1', '1Y'], ['y3', '3Y'], ['y5', '5Y'], ['y10', '10Y'],
]
const hasAnyPeriodData = computed(() => {
  const raw = props.fund.retPRaw || {}
  return PERIOD_BARS.some(([key]) => raw[key] != null)
})
const canShowReturnChart = hasAnyPeriodData
const cyrChartRef = ref(null)
let cyrChartInstance = null

function renderCyrChart() {
  cyrChartInstance?.destroy() // Perf: dispose previous instance to avoid canvas/memory leaks
  cyrChartInstance = null
  const canvas = cyrChartRef.value
  if (!canvas) return

  const posColor = props.isDark ? '#34d399' : '#12b76a'
  const negColor = props.isDark ? '#fb7185' : '#f04438'
  const mutedColor = props.isDark ? '#334155' : '#e2e8f0'
  const textColor = props.isDark ? '#93a3c0' : '#607091'
  const gridColor = props.isDark ? 'rgba(148,163,184,.08)' : 'rgba(148,163,184,.14)'

  let labels
  let values
  let available

  if (!hasAnyPeriodData.value) return
  const raw = props.fund.retPRaw || {}
  labels = PERIOD_BARS.map(([, label]) => label)
  available = PERIOD_BARS.map(([key]) => raw[key] != null)
  values = PERIOD_BARS.map(([key]) => raw[key] ?? 0)

  cyrChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        // Missing periods (fund too young for 3Y/5Y/10Y) render a flat muted bar, not a fabricated 0%.
        backgroundColor: values.map((v, i) => (!available[i] ? mutedColor : v >= 0 ? posColor : negColor)),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            // Anti-XSS: Chart.js draws this to <canvas>, never innerHTML.
            label: (ctx) => (!available[ctx.dataIndex] ? ' ยังไม่มีข้อมูล' : ` ${ctx.parsed.y > 0 ? '+' : ''}${ctx.parsed.y.toFixed(1)}%`),
          },
        },
      },
      scales: {
        x: { ticks: { font: { size: 10 }, color: textColor }, grid: { display: false } },
        y: { ticks: { font: { size: 10 }, color: textColor }, grid: { color: gridColor } },
      },
    },
  })
}

onMounted(renderCyrChart)
onUnmounted(() => cyrChartInstance?.destroy())
watch([() => props.fund?.id, () => props.isDark], renderCyrChart)
</script>

<template>
  <section class="space-y-8">
    <!-- 4 grid items (not 2 column divs) so CSS Grid row-sizing keeps both headers/tables flush
         at the same height on desktop despite one header having extra toggle pills. table-fixed +
         explicit <th> widths avoid horizontal scroll. -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
      <!-- Header: return comparison -->
      <div class="min-w-0 flex items-center lg:col-start-1 lg:row-start-1">
        <h3 class="text-sm font-bold sub uppercase tracking-wide">ตารางเปรียบเทียบผลตอบแทน (Performance)</h3>
      </div>

      <!-- Header: risk metric toggle -->
      <div class="min-w-0 flex items-center justify-between flex-wrap gap-2 lg:col-start-2 lg:row-start-1">
        <h3 class="text-sm font-bold sub uppercase tracking-wide">ตารางเปรียบเทียบย้อนหลัง (ตัวชี้วัดความเสี่ยง)</h3>
        <div class="flex gap-1 surf2 p-0.5 rounded-lg" role="group" aria-label="เลือกตัวชี้วัดความเสี่ยง">
          <button
            v-for="m in RISK_METRICS"
            :key="m.key"
            type="button"
            class="fpill"
            :class="{ on: riskMetric === m.key }"
            :aria-pressed="riskMetric === m.key"
            @click="riskMetric = m.key"
          >{{ m.label }}</button>
        </div>
      </div>

      <!-- Return comparison table -->
      <div class="min-w-0 lg:col-start-1 lg:row-start-2">
        <div class="brd rounded-xl overflow-hidden">
          <table class="w-full text-sm text-left table-fixed">
            <thead>
              <tr class="surf2 sub border-b border-[var(--line)] font-bold">
                <th class="p-3 w-2/5">ช่วงเวลา</th>
                <th class="p-3 text-right w-[30%]">กองทุนนี้</th>
                <th class="p-3 text-right w-[30%]">เฉลี่ยกลุ่ม</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in returnRows" :key="row.label" class="border-b border-[var(--line)]">
                <td class="p-3 font-medium txt whitespace-nowrap">{{ row.label }}</td>
                <td class="p-3 text-right num" :class="row.value >= 0 ? 'text-pos' : 'text-neg'">{{ fmtPct(row.value) }}</td>
                <td class="p-3 text-right num sub">{{ row.groupAvg != null ? fmtPct(row.groupAvg) : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-[10px] sub mt-1.5">* เกณฑ์อ้างอิง: {{ benchLabel }}</p>
      </div>

      <!-- Risk metric table -->
      <div class="min-w-0 lg:col-start-2 lg:row-start-2">
        <div class="brd rounded-xl overflow-hidden">
          <table class="w-full text-sm text-left table-fixed">
            <thead>
              <tr class="surf2 sub border-b border-[var(--line)] font-bold">
                <th class="p-3 w-2/5">ช่วงเวลา</th>
                <th class="p-3 text-right w-[30%]">กองทุนนี้</th>
                <th class="p-3 text-right w-[30%]">เฉลี่ยกลุ่ม</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in riskRows" :key="row.label" class="border-b border-[var(--line)]">
                <td class="p-3 font-medium txt whitespace-nowrap">{{ row.label }}</td>
                <td class="p-3 text-right num txt">{{ fmtRisk(row.fVal, activeSuffix) }}</td>
                <td class="p-3 text-right num sub">{{ fmtRisk(row.gVal, activeSuffix) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Return by period: 1M/3M/1Y/3Y/5Y/10Y checkpoint bars; periods without data render muted/gray. -->
    <div class="border-t border-[var(--line)] pt-6">
      <h3 class="text-sm font-bold sub uppercase tracking-wide mb-3">
        ผลตอบแทนตามช่วงเวลา (Return by Period)
      </h3>
      <div v-if="canShowReturnChart" class="h-60 relative">
        <canvas ref="cyrChartRef"></canvas>
      </div>
      <div v-else class="h-24 flex items-center justify-center text-center text-sm sub border border-dashed border-[var(--line)] rounded-xl">
        ข้อมูล API ยังไม่มีผลตอบแทนของกองทุนนี้เลย — ไม่ใช่หน้าเสีย
      </div>
    </div>

    <!-- Dividend history (full width) -->
    <div class="border-t border-[var(--line)] pt-6">
      <h3 class="text-sm font-bold sub uppercase tracking-wide mb-3">ประวัติการปันผล (Dividend History)</h3>
      <div class="overflow-x-auto brd rounded-xl">
        <table class="w-full text-sm text-left">
          <thead>
            <tr class="surf2 sub border-b border-[var(--line)] font-bold">
              <th class="p-3">วันปิดพอร์ตปันผล</th>
              <th class="p-3">วันจ่ายปันผล</th>
              <th class="p-3 text-right">จำนวนเงินจ่าย</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, idx) in dividendHistory" :key="idx" class="border-b border-[var(--line)]">
              <td class="p-3 txt">{{ d.closedDate }}</td>
              <td class="p-3 txt">{{ d.paidDate }}</td>
              <td class="p-3 text-right num txt">{{ d.amount }}</td>
            </tr>
            <tr v-if="!dividendHistory.length && paysDividends">
              <td colspan="3" class="p-4 text-center sub">กองทุนนี้มีนโยบายจ่ายปันผล แต่ยังไม่มีข้อมูลประวัติการจ่ายจริง (วันที่/จำนวนเงิน)</td>
            </tr>
            <tr v-else-if="!dividendHistory.length">
              <td colspan="3" class="p-4 text-center sub">ไม่มีนโยบายจ่ายเงินปันผล (เป็นแบบสะสมมูลค่า)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
