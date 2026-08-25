<!-- src/components/fundinfo/detail/FundPerformancePanel.vue -->
<script setup>
// Ported from "Panel 2: ผลการดำเนินงานและปันผล" (tab-performance) in the
// v3.2.1 HTML prototype, converted from JS tab-switching + a manually
// rebuilt <tbody> (`tbody.innerHTML = rows.map(...).join('')`, a DOM-based
// XSS sink if any row value were ever attacker-influenced) into an
// always-visible section using Vue's auto-escaping template bindings only.
//
// The risk-metric toggle (SD / Sharpe / Max Drawdown) is local UI state,
// same pattern as FundOverviewPanel.vue's mode/range toggle. Return-table
// and dividend data are still centrally derived by useFundAnalytics and
// injected as props — this component stays presentation + local-toggle only.
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import Chart from 'chart.js/auto'
import { INSIGHT } from '../../../data/fundinfoData'

const props = defineProps({
  fund: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  // (fundReturnPct) => groupAveragePct — from useFundAnalytics(fundRef)
  groupAverage: { type: Function, required: true },
  // [{ closedDate, paidDate, amount }] — from useFundAnalytics(fundRef).dividendHistory
  dividendHistory: { type: Array, default: () => [] },
})

// ---------- Return comparison table ----------
// Input validation: retP is produced entirely by fundinfoData.js, never by
// user input, but we still guard with `?? 0` so a missing field renders
// "0.0%" instead of crashing the table.
const returnRows = computed(() => {
  const r = props.fund.retP || {}
  return [
    { label: '3 เดือน', value: r.q1 ?? 0 },
    { label: '6 เดือน', value: +((r.y1 ?? 0) * 0.6).toFixed(1) },
    { label: '1 ปี', value: r.y1 ?? 0 },
    { label: '3 ปี (annualized)', value: r.y3 ?? 0 },
    { label: '5 ปี (annualized)', value: r.y5 ?? 0 },
    { label: '10 ปี (annualized)', value: +((r.y5 ?? 0) * 1.5).toFixed(1) },
  ]
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

// Deterministic multiplier table per period, ported 1:1 from the prototype's
// renderMetricTable() — mock illustrative figures only, not live risk data.
const RISK_MULTIPLIERS = {
  sd: [
    ['3 เดือน', 0.8, 0.9], ['6 เดือน', 0.9, 0.95], ['1 ปี', 1, 1.05],
    ['3 ปี (annualized)', 1.05, 1.1], ['5 ปี (annualized)', 1.1, 1.15], ['10 ปี (annualized)', 1.2, 1.25],
  ],
  sharpe: [
    ['3 เดือน', 0.9, 0.85], ['6 เดือน', 0.95, 0.95], ['1 ปี', 1, 0.95],
    ['3 ปี (annualized)', 1.05, 1.0], ['5 ปี (annualized)', 1.1, 1.05], ['10 ปี (annualized)', 1.15, 1.1],
  ],
  maxdd: [
    ['3 เดือน', 0.4, 0.45], ['6 เดือน', 0.6, 0.65], ['1 ปี', 1, 1.1],
    ['3 ปี (annualized)', 1.1, 1.2], ['5 ปี (annualized)', 1.2, 1.3], ['10 ปี (annualized)', 1.4, 1.5],
  ],
}

const riskRows = computed(() => {
  const base = props.fund.stats?.[riskMetric.value] ?? 0
  return RISK_MULTIPLIERS[riskMetric.value].map(([label, fMult, gMult]) => ({
    label,
    fVal: +(base * fMult).toFixed(2),
    gVal: +(base * gMult).toFixed(2),
  }))
})
const activeSuffix = computed(() => RISK_METRICS.find((m) => m.key === riskMetric.value)?.suffix || '')

// ---------- Calendar-year returns bar chart ----------
const cyrChartRef = ref(null)
let cyrChartInstance = null

function renderCyrChart() {
  cyrChartInstance?.destroy() // Perf: dispose previous instance to avoid canvas/memory leaks
  cyrChartInstance = null
  const canvas = cyrChartRef.value
  const cyr = props.fund.cyr
  if (!canvas || !cyr) return

  const posColor = props.isDark ? '#34d399' : '#12b76a'
  const negColor = props.isDark ? '#fb7185' : '#f04438'
  const textColor = props.isDark ? '#93a3c0' : '#607091'
  const gridColor = props.isDark ? 'rgba(148,163,184,.08)' : 'rgba(148,163,184,.14)'

  const labels = Object.keys(cyr)
  const values = Object.values(cyr)

  cyrChartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: values.map((v) => (v >= 0 ? posColor : negColor)),
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
            label: (ctx) => ` ${ctx.parsed.y > 0 ? '+' : ''}${ctx.parsed.y.toFixed(1)}%`,
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
    <!-- Layout Fix: 4 grid items (header-L, table-L, header-R, table-R) instead of 2
         "column" divs. On mobile (grid-cols-1) source order alone stacks them correctly
         (header1, table1, header2, table2). From lg: up, explicit col/row placement puts
         both headers in grid row 1 and both tables in row 2 — CSS Grid auto-sizes each
         row to its tallest cell, so the shorter header (left, no toggle pills) stretches
         to match the taller one (right, with the SD/Sharpe/Max Drawdown toggle) and both
         tables start flush at the same y ("ลงมาเท่ากัน"). table-fixed + explicit <th>
         widths replace overflow-x-auto: columns can no longer exceed the container, so
         no horizontal scrollbar renders. -->
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
                <td class="p-3 text-right num sub">{{ groupAverage(row.value) }}%</td>
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
                <td class="p-3 text-right num txt">{{ row.fVal }}{{ activeSuffix }}</td>
                <td class="p-3 text-right num sub">{{ row.gVal }}{{ activeSuffix }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Calendar year returns (full width) -->
    <div class="border-t border-[var(--line)] pt-6">
      <h3 class="text-sm font-bold sub uppercase tracking-wide mb-3">ผลตอบแทนรายปีปฏิทิน (Calendar Year Returns)</h3>
      <div class="h-60 relative">
        <canvas ref="cyrChartRef"></canvas>
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
            <tr v-if="!dividendHistory.length">
              <td colspan="3" class="p-4 text-center sub">ไม่มีนโยบายจ่ายเงินปันผล (เป็นแบบสะสมมูลค่า)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
