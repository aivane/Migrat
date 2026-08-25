<!-- src/components/fundinfo/detail/FundPortfolioPanel.vue -->
<script setup>
// Ported from "Panel 3: สัดส่วนการลงทุน" (tab-portfolio) in the v3.2.1 HTML
// prototype. The prototype built each legend via
// `makeLegendHTML()` → a template-literal string assigned to `innerHTML`
// (DOM-based XSS sink) — this version renders the same legend as a plain
// `v-for` + `{{ }}` list instead, so fund/holding names can never be
// interpreted as markup.
//
// Country/holdings breakdowns are still centrally derived by
// useFundAnalytics and injected as props; asset/sector mix come straight
// off the fund record (already-trusted app data, never user input).
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  fund: { type: Object, required: true },
  isDark: { type: Boolean, default: false },
  countryAllocation: { type: Array, default: () => [] }, // useFundAnalytics(fundRef).countryAllocation
  topHoldings: { type: Array, default: () => [] }, // useFundAnalytics(fundRef).topHoldings
})

const ASSET_COLORS = ['#2456d8', '#0e7ac0', '#12b76a', '#e0a411', '#7a5af5', '#64748b']
const SECTOR_COLORS = ['#7a5af5', '#0e7ac0', '#12b76a', '#e0a411', '#ef4444', '#f97316', '#06b6d4', '#ec4899', '#8b5cf6', '#64748b']
const COUNTRY_COLORS = ['#0e7ac0', '#12b76a', '#7a5af5', '#e0a411', '#64748b', '#2456d8']
const HOLDING_COLORS = ['#2456d8', '#0e7ac0', '#12b76a', '#e0a411', '#7a5af5', '#64748b', '#ec4899', '#f97316', '#06b6d4', '#a855f7']

const SECTOR_FALLBACK = [{ name: 'อื่น ๆ / ตราสารหนี้', percent: 100 }]

// ---------- Source data (already-trusted app data + injected props) ----------
const assetData = computed(() => props.fund.asset || props.fund.mix || [])
const sectorData = computed(() => (props.fund.sectorMix?.length ? props.fund.sectorMix : SECTOR_FALLBACK))
const countryData = computed(() => props.countryAllocation)
const holdingData = computed(() => props.topHoldings)

// Pairs each allocation item with its legend swatch color, cycling the
// palette if there are more items than colors (matches `colors[i % length]`
// in the original prototype).
function withColor(list, colors) {
  return list.map((item, idx) => ({ ...item, color: colors[idx % colors.length] }))
}

const assetLegend = computed(() => withColor(assetData.value, ASSET_COLORS))
const sectorLegend = computed(() => withColor(sectorData.value, SECTOR_COLORS))
const countryLegend = computed(() => withColor(countryData.value, COUNTRY_COLORS))
const holdingLegend = computed(() => withColor(holdingData.value, HOLDING_COLORS))

// ---------- Doughnut charts ----------
const assetChartRef = ref(null)
const sectorChartRef = ref(null)
const countryChartRef = ref(null)
const holdingChartRef = ref(null)
const chartInstances = {} // canvas key -> Chart instance, for teardown/rebuild

function buildDoughnut(key, canvas, labels, data, colors) {
  chartInstances[key]?.destroy() // Perf: dispose previous instance to avoid canvas/memory leaks
  chartInstances[key] = null
  if (!canvas || !data.length) return

  chartInstances[key] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: props.isDark ? 2 : 1,
        borderColor: props.isDark ? '#151f33' : '#ffffff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false }, // Legend rendered as our own list below, not via Chart.js
        tooltip: {
          callbacks: {
            // Anti-XSS: Chart.js draws tooltip text to <canvas>, never innerHTML.
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
          },
        },
      },
    },
  })
}

function renderCharts() {
  buildDoughnut('asset', assetChartRef.value, assetData.value.map((a) => a.name), assetData.value.map((a) => a.percent), ASSET_COLORS)
  buildDoughnut('sector', sectorChartRef.value, sectorData.value.map((s) => s.name), sectorData.value.map((s) => s.percent), SECTOR_COLORS)
  buildDoughnut('country', countryChartRef.value, countryData.value.map((c) => c.name), countryData.value.map((c) => c.percent), COUNTRY_COLORS)
  buildDoughnut('holding', holdingChartRef.value, holdingData.value.map((h) => h.name), holdingData.value.map((h) => h.percent), HOLDING_COLORS)
}

onMounted(renderCharts)
onUnmounted(() => Object.values(chartInstances).forEach((c) => c?.destroy())) // Perf: release all 4 canvases on teardown
watch([() => props.fund?.id, () => props.isDark], renderCharts)
</script>

<template>
  <section class="flex flex-col gap-8">
    <!-- Asset allocation -->
    <div>
      <h3 class="text-sm font-bold sub uppercase tracking-wide mb-2.5">สัดส่วนประเภทสินทรัพย์ (Asset Allocation)</h3>
      <div class="flex flex-col sm:flex-row items-center gap-8 py-4">
        <div class="w-44 h-44 shrink-0 relative flex items-center justify-center">
          <canvas ref="assetChartRef"></canvas>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 w-full">
          <div v-for="item in assetLegend" :key="item.name" class="flex items-center justify-between text-sm py-1 border-b border-[var(--line)]">
            <span class="flex items-center gap-2 min-w-0">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
              <span class="truncate font-medium txt" :title="item.name">{{ item.name }}</span>
            </span>
            <span class="num font-bold txt ml-2 shrink-0">{{ item.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sector allocation -->
    <div class="border-t border-[var(--line)] pt-6">
      <h3 class="text-sm font-bold sub uppercase tracking-wide mb-2.5">สัดส่วนกลุ่มอุตสาหกรรม (Sector Allocation)</h3>
      <div class="flex flex-col sm:flex-row items-center gap-8 py-4">
        <div class="w-44 h-44 shrink-0 relative flex items-center justify-center">
          <canvas ref="sectorChartRef"></canvas>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 w-full">
          <div v-for="item in sectorLegend" :key="item.name" class="flex items-center justify-between text-sm py-1 border-b border-[var(--line)]">
            <span class="flex items-center gap-2 min-w-0">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
              <span class="truncate font-medium txt" :title="item.name">{{ item.name }}</span>
            </span>
            <span class="num font-bold txt ml-2 shrink-0">{{ item.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Country allocation -->
    <div class="border-t border-[var(--line)] pt-6">
      <h3 class="text-sm font-bold sub uppercase tracking-wide mb-2.5">สัดส่วนประเทศที่ลงทุน (Country Allocation)</h3>
      <div class="flex flex-col sm:flex-row items-center gap-8 py-4">
        <div class="w-44 h-44 shrink-0 relative flex items-center justify-center">
          <canvas ref="countryChartRef"></canvas>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 w-full">
          <div v-for="item in countryLegend" :key="item.name" class="flex items-center justify-between text-sm py-1 border-b border-[var(--line)]">
            <span class="flex items-center gap-2 min-w-0">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
              <span class="truncate font-medium txt" :title="item.name">{{ item.name }}</span>
            </span>
            <span class="num font-bold txt ml-2 shrink-0">{{ item.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Top 10 holdings -->
    <div class="border-t border-[var(--line)] pt-6">
      <h3 class="text-sm font-bold sub uppercase tracking-wide mb-2.5">หลักทรัพย์ที่ถือครองสูงสุด 10 อันดับแรก</h3>
      <div class="flex flex-col sm:flex-row items-center gap-8 py-4">
        <div class="w-44 h-44 shrink-0 relative flex items-center justify-center">
          <canvas ref="holdingChartRef"></canvas>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 w-full">
          <div v-for="item in holdingLegend" :key="item.name" class="flex items-center justify-between text-sm py-1 border-b border-[var(--line)]">
            <span class="flex items-center gap-2 min-w-0">
              <span class="w-3 h-3 rounded-full shrink-0" :style="{ backgroundColor: item.color }"></span>
              <span class="truncate font-medium txt" :title="item.name">{{ item.name }}</span>
            </span>
            <span class="num font-bold txt ml-2 shrink-0">{{ item.percent.toFixed(1) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
