<!-- FundInfoDetailView.vue -->
<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Chart from 'chart.js/auto'
import { FUNDS, INSIGHT, FUND_TYPES } from '../../data/fundinfoData'
import { useFundinfoTheme } from '../../composables/useFundinfoTheme'

const route = useRoute()
const router = useRouter()
const { isDark, toggleTheme } = useFundinfoTheme()

const fund = computed(() => FUNDS.find((f) => f.id === route.params.id))
const typeMeta = computed(() => (fund.value ? FUND_TYPES[fund.value.type] : null))
const insight = computed(() => (fund.value?.master ? INSIGHT[fund.value.master] : null))
const accent = computed(() => typeMeta.value?.accent || '#2456d8')

function hashId(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
}
const h = computed(() => (fund.value ? hashId(fund.value.id) : 1))
function jitter(seed, scale) {
  return (((h.value * seed) % 11) / 11 - 0.5) * scale
}

function goBack() {
  if (fund.value) router.push({ name: `fundinfo-${fund.value.type}` })
  else router.push('/fundinfo/feeder')
}

// ---------- ภาพรวมกองทุน ----------
const dividendPolicy = computed(() => {
  if (!fund.value) return { text: '-', sub: '' }
  if (!fund.value.div) return { text: 'ไม่มีนโยบายจ่ายเงินปันผล', sub: '(เป็นแบบสะสมมูลค่า)' }
  return { text: 'มีนโยบายจ่ายเงินปันผล', sub: `(เฉลี่ยประมาณ ${fund.value.div}% ต่อปี)` }
})
const inceptionDate = computed(() => insight.value?.master?.incep || '-')
const aumText = computed(() => (fund.value ? `${fund.value.aum.toLocaleString('th-TH')} ล้านบาท` : '-'))

// ---------- ผลการดำเนินงานและความเสี่ยง ----------
const timeRanges = ['1M', '3M', '1Y', '3Y', '5Y', 'MAX']
const selectedRange = ref('1Y')
const rangePoints = { '1M': 4, '3M': 13, '1Y': 52, '3Y': 60, '5Y': 60, MAX: 60 }

function buildNavHistory(f) {
  const points = 60
  const growthY = (f.perf || 0) / 100
  const weeklyDrift = growthY / 52
  let val = f.nav
  const vals = [val]
  for (let i = 1; i < points; i++) {
    const seed = ((hashId(f.id) * (i + 5)) % 97) / 97 - 0.5
    const noise = seed * f.nav * 0.012
    val = val / (1 + weeklyDrift) - noise
    vals.unshift(+val.toFixed(4))
  }
  return vals
}
const navHistoryFull = computed(() => (fund.value ? buildNavHistory(fund.value) : []))
const navHistorySlice = computed(() => {
  const n = rangePoints[selectedRange.value] || 52
  return navHistoryFull.value.slice(-n)
})

const periods = [
  { key: 'm1', label: '1 เดือน (1M)' },
  { key: 'q1', label: '3 เดือน (3M)' },
  { key: 'y1', label: '1 ปี (1Y)' },
  { key: 'y3', label: '3 ปี (3Y)' },
  { key: 'y5', label: '5 ปี (5Y)' },
]
function fundReturn(key) { return fund.value?.retP?.[key] }
function benchReturn(key, idx) {
  const fv = fundReturn(key)
  if (fv === undefined) return null
  const offset = (((h.value * (idx + 4)) % 7) - 3) / 30
  return +(fv - offset).toFixed(1)
}
function diffReturn(key, idx) {
  const fv = fundReturn(key)
  const bv = benchReturn(key, idx)
  if (fv === undefined || bv === null) return null
  return +(fv - bv).toFixed(1)
}
function fmtPct(v) {
  if (v === undefined || v === null) return '-'
  return `${v > 0 ? '+' : ''}${v}%`
}

// ---------- สัดส่วนการลงทุน ----------
const assetAllocation = computed(() => fund.value?.asset || fund.value?.mix || [])
const sectorAllocation = computed(() => fund.value?.sectorMix || fund.value?.mix || [])
const topHoldings = computed(() => (fund.value?.top5 || []).slice(0, 5))
const holdingMax = computed(() => Math.max(...topHoldings.value.map((i) => Number(i.percent) || 0), 1))

const countryAllocation = computed(() => {
  if (!fund.value) return []
  if (fund.value.type === 'mixed') return []
  if (fund.value.type === 'thai') return [{ name: 'ไทย', percent: 100 }]
  if (!fund.value.country) return []
  const main = +(90 + Math.abs(jitter(17, 8))).toFixed(0)
  return [
    { name: fund.value.country, percent: main },
    { name: 'อื่นๆ', percent: 100 - main },
  ]
})

// ---------- ค่าธรรมเนียมและเงื่อนไขการซื้อขาย ----------
const feeBreakdown = computed(() => {
  if (!fund.value) return null
  const ter = fund.value.fee || 0
  return {
    management: +(ter * 0.75).toFixed(2),
    trustee: +(ter * 0.1).toFixed(2),
    registrar: +(ter * 0.15).toFixed(2),
    ter: ter.toFixed(2),
  }
})
const minInvestmentText = computed(() => (fund.value ? `${Number(fund.value.minInvest).toLocaleString('en-US')} บาท / 1 บาท` : '-'))

// ---------- Charts ----------
const navChartRef = ref(null)
const cyrChartRef = ref(null)
const assetChartRef = ref(null)
let navChartInstance = null
let cyrChartInstance = null
let assetChartInstance = null

function renderNavChart() {
  navChartInstance?.destroy()
  if (!navChartRef.value || !fund.value) return
  const data = navHistorySlice.value
  navChartInstance = new Chart(navChartRef.value, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: accent.value,
        backgroundColor: `${accent.value}22`,
        fill: true,
        pointRadius: 0,
        tension: 0.35,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: { ticks: { font: { size: 10 } }, grid: { color: 'rgba(226,232,240,.6)' } },
      },
    },
  })
}

function renderCyrChart() {
  cyrChartInstance?.destroy()
  if (!cyrChartRef.value || !fund.value) return
  const cyr = fund.value.cyr || {}
  const values = Object.values(cyr)
  cyrChartInstance = new Chart(cyrChartRef.value, {
    type: 'bar',
    data: {
      labels: Object.keys(cyr),
      datasets: [{ data: values, backgroundColor: values.map((v) => (v >= 0 ? '#10b981' : '#f43f5e')), borderRadius: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { font: { size: 10 } }, grid: { color: 'rgba(226,232,240,.6)' } },
        x: { ticks: { font: { size: 10 } }, grid: { display: false } },
      },
    },
  })
}

function renderAssetChart() {
  assetChartInstance?.destroy()
  if (!assetChartRef.value || !fund.value) return
  const data = assetAllocation.value
  assetChartInstance = new Chart(assetChartRef.value, {
    type: 'doughnut',
    data: {
      labels: data.map((i) => i.name),
      datasets: [{ data: data.map((i) => i.percent), backgroundColor: [accent.value, '#64748b', '#94a3b8', '#cbd5e1'], borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 10 } } } },
      cutout: '68%',
    },
  })
}

function renderAll() {
  renderNavChart()
  renderCyrChart()
  renderAssetChart()
}

onMounted(renderAll)
watch(fund, renderAll)
watch(selectedRange, renderNavChart)
onUnmounted(() => {
  navChartInstance?.destroy()
  cyrChartInstance?.destroy()
  assetChartInstance?.destroy()
})
</script>

<template>
  <div class="fundinfo-scope min-h-screen" :class="{ dark: isDark }">
    <main class="min-h-screen bg-[var(--bg)] text-[var(--txt)] font-['Prompt'] antialiased">

      <header class="sticky top-0 z-30 surf brdb px-4 py-4">
        <div class="max-w-[1120px] mx-auto flex items-center justify-between">
          <button type="button" class="flex items-center gap-2 text-sm font-semibold sub hover:txt" @click="goBack">
            <span>‹</span>
            <span class="txt font-bold">Fundinfo</span>
            <span class="sub">/ ข้อมูลรายละเอียดกองทุน</span>
          </button>
          <button type="button" class="surf brd w-9 h-9 rounded-lg flex items-center justify-center" title="สลับโหมด" @click="toggleTheme">
            {{ isDark ? '☀️' : '🌙' }}
          </button>
        </div>
      </header>

      <div v-if="!fund" class="max-w-[1120px] mx-auto px-4 py-16 text-center sub">
        ไม่พบข้อมูลกองทุน
      </div>

      <div v-else class="max-w-[1120px] mx-auto px-4 py-7 md:py-8 space-y-6">

        <!-- Fund Title Bar -->
        <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl text-white font-extrabold flex items-center justify-center text-sm shrink-0 shadow-sm" :style="{ backgroundColor: accent }">
              {{ fund.amcCode }}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap mb-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold text-white" :style="{ backgroundColor: accent }">{{ typeMeta?.label }}</span>
                <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">ความเสี่ยงระดับ {{ fund.risk }}</span>
                <span class="text-[11px] font-bold text-slate-400 font-['Inter']">{{ fund.id }}</span>
              </div>
              <h1 class="text-lg font-bold text-slate-900">{{ fund.name }}</h1>
              <p class="text-[11px] text-slate-500">
                {{ fund.amc }}
                <template v-if="fund.master"> · Master: {{ fund.master }}</template>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-5 flex-wrap">
            <div>
              <span class="text-[10px] text-slate-400 uppercase block">NAV</span>
              <strong class="text-sm font-extrabold font-['Inter'] text-slate-900">{{ fund.nav.toFixed(4) }}</strong>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 uppercase block">1Y Return</span>
              <strong class="text-sm font-extrabold font-['Inter']" :class="fund.perf >= 0 ? 'text-emerald-500' : 'text-rose-500'">{{ fmtPct(fund.perf) }}</strong>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 uppercase block">ขนาดกองทุน (AUM)</span>
              <strong class="text-sm font-extrabold font-['Inter'] text-slate-900">{{ fund.aum.toLocaleString('th-TH') }} ล้านบาท</strong>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 uppercase block">จดทะเบียน</span>
              <strong class="text-sm font-extrabold font-['Inter'] text-slate-900">{{ inceptionDate }}</strong>
            </div>
          </div>
        </div>

        <!-- Main 2-column grid -->
        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">

          <!-- Left column -->
          <div class="lg:col-span-3 space-y-6">

            <!-- ภาพรวมกองทุน -->
            <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 class="text-base font-bold text-slate-900">ภาพรวมกองทุน</h2>

              <div>
                <span class="text-[11px] font-bold text-slate-500 uppercase block mb-1">นโยบายการลงทุน</span>
                <p class="text-sm text-slate-700 leading-relaxed">{{ insight?.narr || 'ไม่มีข้อมูลนโยบายการลงทุน' }}</p>
                <div class="flex flex-wrap gap-1.5 pt-2">
                  <span v-for="tag in (fund.themes || [])" :key="tag" class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">#{{ tag }}</span>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div>
                  <span class="text-[11px] font-bold text-slate-500 uppercase block mb-1">นโยบายการจ่ายปันผล</span>
                  <p class="text-sm font-semibold" :class="fund.div ? 'text-emerald-600' : 'text-rose-500'">{{ dividendPolicy.text }}</p>
                  <p class="text-[11px] text-slate-500">{{ dividendPolicy.sub }}</p>
                </div>
                <div>
                  <span class="text-[11px] font-bold text-slate-500 uppercase block mb-1">การป้องกันความเสี่ยงอัตราแลกเปลี่ยน (FX Hedging)</span>
                  <p class="text-sm font-semibold text-slate-700">{{ fund.fx || '-' }}</p>
                </div>
                <div>
                  <span class="text-[11px] font-bold text-slate-500 uppercase block mb-1">วันที่จดทะเบียนจัดตั้งกองทุน</span>
                  <p class="text-sm font-semibold text-slate-700">{{ inceptionDate }}</p>
                </div>
                <div>
                  <span class="text-[11px] font-bold text-slate-500 uppercase block mb-1">มูลค่าทรัพย์สินสุทธิ (AUM)</span>
                  <p class="text-sm font-semibold text-slate-700">{{ aumText }}</p>
                </div>
              </div>
            </div>

            <!-- ผลการดำเนินงานและความเสี่ยง -->
            <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 class="text-base font-bold text-slate-900">ผลการดำเนินงานและความเสี่ยง</h2>

              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[11px] font-bold text-slate-500 uppercase">กราฟ NAV ย้อนหลัง</span>
                  <div class="flex items-center gap-1">
                    <button
                      v-for="r in timeRanges" :key="r" type="button"
                      class="px-2 py-1 rounded-md text-[11px] font-bold"
                      :class="selectedRange === r ? 'text-white' : 'text-slate-500 hover:bg-slate-100'"
                      :style="selectedRange === r ? { backgroundColor: accent } : {}"
                      @click="selectedRange = r"
                    >{{ r }}</button>
                  </div>
                </div>
                <div class="h-52 relative"><canvas ref="navChartRef"></canvas></div>
              </div>

              <div class="overflow-x-auto pt-2 border-t border-slate-100">
                <span class="text-[11px] font-bold text-slate-500 uppercase block mb-2">ตารางเปรียบเทียบผลตอบแทนย้อนหลัง</span>
                <table class="w-full text-left text-sm">
                  <thead>
                    <tr class="text-[11px] text-slate-400">
                      <th class="py-1 font-semibold">ช่วงเวลา</th>
                      <th class="py-1 font-semibold text-right">กองทุน</th>
                      <th class="py-1 font-semibold text-right">เกณฑ์มาตรฐาน</th>
                      <th class="py-1 font-semibold text-right">ส่วนต่าง</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(p, idx) in periods" :key="p.key" class="border-t border-slate-100">
                      <td class="py-1.5 text-slate-600">{{ p.label }}</td>
                      <td class="py-1.5 text-right font-bold font-['Inter']" :class="fundReturn(p.key) >= 0 ? 'text-emerald-600' : 'text-rose-500'">{{ fmtPct(fundReturn(p.key)) }}</td>
                      <td class="py-1.5 text-right font-['Inter'] text-slate-500">{{ fmtPct(benchReturn(p.key, idx)) }}</td>
                      <td class="py-1.5 text-right font-['Inter'] font-semibold" :class="diffReturn(p.key, idx) >= 0 ? 'text-emerald-600' : 'text-rose-500'">{{ fmtPct(diffReturn(p.key, idx)) }}</td>
                    </tr>
                  </tbody>
                </table>
                <p class="text-[10px] text-slate-400 pt-1">เกณฑ์มาตรฐานอ้างอิง: {{ insight?.bench || '-' }}</p>
              </div>

              <div class="pt-2 border-t border-slate-100">
                <span class="text-[11px] font-bold text-slate-500 uppercase block mb-2">ผลตอบแทนรายปี (Calendar Year Returns)</span>
                <div class="h-40 relative"><canvas ref="cyrChartRef"></canvas></div>
              </div>

              <div class="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
                <div class="bg-slate-50 p-2.5 rounded-xl text-center">
                  <span class="text-[10px] text-slate-400 block">Sharpe Ratio</span>
                  <strong class="text-sm font-bold text-slate-800 font-['Inter']">{{ fund.sharpe }}</strong>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl text-center">
                  <span class="text-[10px] text-slate-400 block">Max Drawdown</span>
                  <strong class="text-sm font-bold text-rose-500 font-['Inter']">{{ fund.drawdown }}</strong>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl text-center">
                  <span class="text-[10px] text-slate-400 block">Recovery Period</span>
                  <strong class="text-sm font-bold text-slate-800 font-['Inter']">{{ fund.stats.recover }} เดือน</strong>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl text-center">
                  <span class="text-[10px] text-slate-400 block">Standard Deviation</span>
                  <strong class="text-sm font-bold text-slate-800 font-['Inter']">{{ fund.stats.sd }}%</strong>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl text-center">
                  <span class="text-[10px] text-slate-400 block">Beta</span>
                  <strong class="text-sm font-bold text-slate-800 font-['Inter']">{{ fund.stats.beta }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- Right column -->
          <div class="lg:col-span-2 space-y-6">

            <!-- สัดส่วนการลงทุน -->
            <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 class="text-base font-bold text-slate-900">สัดส่วนการลงทุน</h2>

              <div>
                <span class="text-[11px] font-bold text-slate-500 uppercase block mb-1">สัดส่วนประเภทสินทรัพย์ (Asset Allocation)</span>
                <div class="h-40 relative"><canvas ref="assetChartRef"></canvas></div>
              </div>

              <div v-if="sectorAllocation.length" class="pt-2 border-t border-slate-100 space-y-1.5">
                <span class="text-[11px] font-bold text-slate-500 uppercase block">สัดส่วนกลุ่มอุตสาหกรรม (Sector Allocation)</span>
                <div v-for="sec in sectorAllocation" :key="sec.name" class="flex items-center justify-between text-[12px]">
                  <span class="text-slate-600 truncate max-w-[120px]">{{ sec.name }}</span>
                  <div class="flex items-center gap-2 flex-1 ml-3">
                    <div class="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div class="h-full rounded-full" :style="{ width: `${sec.percent}%`, backgroundColor: accent }"></div>
                    </div>
                    <span class="font-bold text-slate-700 w-9 text-right font-['Inter']">{{ sec.percent }}%</span>
                  </div>
                </div>
              </div>

              <div v-if="countryAllocation.length" class="pt-2 border-t border-slate-100 space-y-1.5">
                <span class="text-[11px] font-bold text-slate-500 uppercase block">สัดส่วนประเทศที่ลงทุน (Country Allocation)</span>
                <div v-for="c in countryAllocation" :key="c.name" class="flex items-center justify-between text-[12px]">
                  <span class="text-slate-600 truncate max-w-[120px]">{{ c.name }}</span>
                  <div class="flex items-center gap-2 flex-1 ml-3">
                    <div class="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div class="h-full rounded-full" :style="{ width: `${c.percent}%`, backgroundColor: accent }"></div>
                    </div>
                    <span class="font-bold text-slate-700 w-9 text-right font-['Inter']">{{ c.percent }}%</span>
                  </div>
                </div>
              </div>

              <div class="pt-2 border-t border-slate-100 space-y-1.5">
                <span class="text-[11px] font-bold text-slate-500 uppercase block">หลักทรัพย์ที่ถือครองสูงสุด</span>
                <div v-for="hold in topHoldings" :key="hold.name" class="flex items-center justify-between text-[12px]">
                  <span class="text-slate-700 font-medium truncate max-w-[130px]">{{ hold.name }}</span>
                  <div class="flex items-center gap-2 flex-1 ml-3">
                    <div class="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div class="h-full rounded-full" :style="{ width: `${(hold.percent / holdingMax) * 100}%`, backgroundColor: accent }"></div>
                    </div>
                    <span class="font-bold text-slate-800 w-10 text-right font-['Inter']">{{ hold.percent }}%</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- ค่าธรรมเนียมและเงื่อนไขการซื้อขาย -->
            <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h2 class="text-base font-bold text-slate-900">ค่าธรรมเนียมและเงื่อนไขการซื้อขาย</h2>

              <div class="grid grid-cols-2 gap-2">
                <div class="bg-slate-50 p-2.5 rounded-xl">
                  <span class="text-[10px] text-slate-400 block">Front-end Fee (ซื้อ)</span>
                  <strong class="text-sm font-bold text-slate-800 font-['Inter']">1.00%</strong>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl">
                  <span class="text-[10px] text-slate-400 block">Back-end Fee (ขาย)</span>
                  <strong class="text-sm font-bold text-slate-800">ไม่มีเรียกเก็บ</strong>
                </div>
              </div>

              <div class="space-y-1.5 text-sm pt-2 border-t border-slate-100">
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Management Fee (ค่าการจัดการ)</span>
                  <strong class="font-['Inter'] text-slate-800">{{ feeBreakdown.management }}%</strong>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Trustee / Custody</span>
                  <strong class="font-['Inter'] text-slate-800">{{ feeBreakdown.trustee }}%</strong>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-slate-500">Registrar Fee</span>
                  <strong class="font-['Inter'] text-slate-800">{{ feeBreakdown.registrar }}%</strong>
                </div>
                <div class="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span class="text-slate-700 font-bold">Total Expense Ratio (TER)</span>
                  <strong class="font-['Inter']" :style="{ color: accent }">{{ feeBreakdown.ter }}%</strong>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div class="bg-slate-50 p-2.5 rounded-xl">
                  <span class="text-[10px] text-slate-400 block">มูลค่าขั้นต่ำในการซื้อ / ครั้งถัดไป</span>
                  <strong class="text-sm font-bold text-slate-800 font-['Inter']">{{ minInvestmentText }}</strong>
                </div>
                <div class="bg-slate-50 p-2.5 rounded-xl">
                  <span class="text-[10px] text-slate-400 block">ระยะเวลารับเงินค่าขายคืน (Settlement)</span>
                  <strong class="text-sm font-bold text-slate-800 font-['Inter']">T+4 วันทำการ</strong>
                </div>
              </div>
            </div>

            <!-- เอกสารดาวน์โหลดเพิ่มเติม -->
            <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
              <h2 class="text-base font-bold text-slate-900 mb-1">เอกสารดาวน์โหลดเพิ่มเติม</h2>
              <a href="#" class="flex items-center justify-between text-sm font-medium py-1.5" :style="{ color: accent }">
                <span>📄 รายงานข้อมูลสำคัญ (Fund Factsheet)</span><span class="text-[10px] font-bold sub">PDF</span>
              </a>
              <a href="#" class="flex items-center justify-between text-sm font-medium py-1.5" :style="{ color: accent }">
                <span>📘 หนังสือชี้ชวนเสนอขายหน่วยลงทุน</span><span class="text-[10px] font-bold sub">PDF</span>
              </a>
              <a href="#" class="flex items-center justify-between text-sm font-medium py-1.5" :style="{ color: accent }">
                <span>📊 รายงานประจำปี / รายงานครึ่งปี</span><span class="text-[10px] font-bold sub">PDF</span>
              </a>
            </div>

          </div>
        </div>
      </div>
    </main>
  </div>
</template>