<!-- FundDetailCard.vue -->
<script setup>
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  fund: { type: Object, required: true },
  isSelected: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-compare', 'toggle-star'])

const cyChartRef = ref(null)
const assetChartRef = ref(null)
let cyChartInstance = null
let assetChartInstance = null

const AMC_META = {
  KASIKORN: { label: 'KA', color: '#079ab4' },
  KBANK: { label: 'KA', color: '#079ab4' },
  KASSET: { label: 'KA', color: '#079ab4' },
  KKP: { label: 'KKP', color: '#1671ca' },
  KKPAM: { label: 'KKP', color: '#1671ca' },
  SCB: { label: 'SCB', color: '#e5a800' },
  SCBAM: { label: 'SCB', color: '#e5a800' },
  BBLAM: { label: 'BBL', color: '#2369b1' },
  BBL: { label: 'BBL', color: '#2369b1' },
  BUALUANG: { label: 'BBL', color: '#2369b1' },
  BCAP: { label: 'BC', color: '#7b4eaf' },
  KTBCAP: { label: 'BC', color: '#7b4eaf' },
  ABRDN: { label: 'AB', color: '#3d8577' },
  ABERDEEN: { label: 'AB', color: '#3d8577' },
}
const DEFAULT_META = { label: null, color: '#0e91c8' }

function amcMeta(fund) {
  const key = fund?.amcShort?.toString().trim().toUpperCase()
  const meta = AMC_META[key]
  if (meta) return meta
  return { label: key?.slice(0, 3) || 'FI', color: DEFAULT_META.color }
}

const accent = computed(() => amcMeta(props.fund).color)
const badgeText = computed(() => props.fund.amcShort || amcMeta(props.fund).label || 'FI')

function renderCharts() {
  if (cyChartInstance) cyChartInstance.destroy()
  if (assetChartInstance) assetChartInstance.destroy()

  // 1. Calendar Year Returns Bar Chart (2564 - 2568)
  if (cyChartRef.value) {
    const cyrData = props.fund.cyr || { '2564': 18.5, '2565': 12.4, '2566': 22.1, '2567': 11.2, '2568': 14.8 }
    const backgroundColors = Object.values(cyrData).map((v) => (v >= 0 ? '#10b981' : '#f43f5e'))

    cyChartInstance = new Chart(cyChartRef.value, {
      type: 'bar',
      data: {
        labels: Object.keys(cyrData),
        datasets: [{ data: Object.values(cyrData), backgroundColor: backgroundColors, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { font: { size: 9 } }, grid: { color: 'rgba(226, 232, 240, 0.6)' } },
          x: { ticks: { font: { size: 9 } }, grid: { display: false } }
        }
      }
    })
  }

  // 2. Asset Allocation Doughnut Chart
  if (assetChartRef.value) {
    const assetData = props.fund.mix || [
      { name: 'หน่วยลงทุน (Master Fund)', percent: 95 },
      { name: 'เงินฝาก/อื่นๆ', percent: 5 }
    ]
    assetChartInstance = new Chart(assetChartRef.value, {
      type: 'doughnut',
      data: {
        labels: assetData.map((i) => i.name),
        datasets: [{ data: assetData.map((i) => i.percent), backgroundColor: [accent.value, '#64748b'], borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { boxWidth: 8, font: { size: 9 } } } },
        cutout: '68%'
      }
    })
  }
}

onMounted(() => renderCharts())
watch(() => props.fund, () => renderCharts(), { deep: true })
onUnmounted(() => {
  if (cyChartInstance) cyChartInstance.destroy()
  if (assetChartInstance) assetChartInstance.destroy()
})
</script>

<template>
  <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 font-['Prompt'] text-slate-800" :style="{ '--fund-accent': accent }">
    <!-- Header Bar -->
    <div class="flex items-center justify-between border-b border-slate-100 pb-3">
      <div class="flex items-center gap-3">
        <!-- AMC Logo / Badge -->
        <div class="w-10 h-10 rounded-xl bg-[var(--fund-accent)] text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-sm">
          {{ badgeText }}
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-bold text-slate-900">{{ fund.name }}</h3>
            <button class="text-amber-400 hover:scale-110 transition-transform" @click="$emit('toggle-star', fund.id)">
              ★
            </button>
          </div>
          <p class="text-[11px] text-slate-500">
            {{ fund.id }} - {{ fund.amc || 'ไทยพาณิชย์' }} | Master: {{ fund.master || 'Invesco NASDAQ-100 ETF' }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-4 text-right">
        <div>
          <span class="text-[10px] text-slate-400 uppercase block">NAV</span>
          <strong class="text-sm font-extrabold font-['Inter'] text-slate-900">{{ fund.nav || '28.3000' }}</strong>
        </div>
        <div>
          <span class="text-[10px] text-slate-400 uppercase block">1Y Return</span>
          <strong class="text-sm font-extrabold font-['Inter']" :class="(fund.perf || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'">
            +{{ fund.perf || '24.1' }}%
          </strong>
        </div>
        <span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-semibold">
          ความเสี่ยง {{ fund.risk || 6 }}/8
        </span>
      </div>
    </div>

    <!-- Main Content 3-Column Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-1">

      <!-- Col 1: Calendar Year Return Chart & Metrics -->
      <div class="space-y-3">
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          Calendar Year Returns (ผลตอบแทนรายปี)
        </span>
        <div class="h-36 relative">
          <canvas ref="cyChartRef"></canvas>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-100">
          <div class="bg-slate-50 p-2 rounded-xl">
            <span class="text-[10px] text-slate-400 block">Sharpe</span>
            <strong class="text-xs font-bold text-slate-800 font-['Inter']">{{ fund.sharpe || '0.76' }}</strong>
          </div>
          <div class="bg-slate-50 p-2 rounded-xl">
            <span class="text-[10px] text-slate-400 block">Max Drawdown</span>
            <strong class="text-xs font-bold text-rose-500 font-['Inter']">{{ fund.drawdown || '-25.95%' }}</strong>
          </div>
          <div class="bg-slate-50 p-2 rounded-xl">
            <span class="text-[10px] text-slate-400 block">Recovery</span>
            <strong class="text-xs font-bold text-slate-800 font-['Inter']">{{ fund.recovery || '4 เดือน' }}</strong>
          </div>
        </div>
      </div>

      <!-- Col 2: Asset Allocation & Sector Progress Bars -->
      <div class="space-y-3">
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
          น้ำหนักสินทรัพย์ (Asset Allocation)
        </span>
        <div class="h-28 relative">
          <canvas ref="assetChartRef"></canvas>
        </div>

        <div class="space-y-1.5 pt-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase block">สัดส่วนกลุ่มอุตสาหกรรม (Sector)</span>
          <div v-for="sec in (fund.sectors || [
            { name: 'Technology', percent: 48 },
            { name: 'Consumer Disc.', percent: 18 },
            { name: 'Communication', percent: 16 }
          ])" :key="sec.name" class="flex items-center justify-between text-[11px]">
            <span class="text-slate-600 truncate max-w-[110px]">{{ sec.name }}</span>
            <div class="flex items-center gap-2 flex-1 ml-3">
              <div class="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-[var(--fund-accent)] h-full rounded-full" :style="{ width: `${sec.percent}%` }"></div>
              </div>
              <span class="font-bold text-slate-700 w-7 text-right font-['Inter']">{{ sec.percent }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Col 3: Top 5 Holdings & Action Buttons -->
      <div class="flex flex-col justify-between space-y-4">
        <div class="space-y-2">
          <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Top 5 Holdings (กองทุนที่ลงทุนมากที่สุด)
          </span>
          <div class="space-y-1.5">
            <div v-for="hold in (fund.top5 || [
              { name: 'NVIDIA', percent: 9.1 },
              { name: 'Apple', percent: 8.8 },
              { name: 'Microsoft', percent: 8.0 },
              { name: 'Broadcom', percent: 4.8 },
              { name: 'Amazon', percent: 4.6 }
            ])" :key="hold.name" class="flex items-center justify-between text-[11px]">
              <span class="text-slate-700 font-medium truncate max-w-[120px]">{{ hold.name }}</span>
              <div class="flex items-center gap-2 flex-1 ml-3">
                <div class="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-[var(--fund-accent)] h-full rounded-full" :style="{ width: `${hold.percent * 8}%` }"></div>
                </div>
                <span class="font-bold text-slate-800 w-8 text-right font-['Inter']">{{ hold.percent }}%</span>
              </div>
            </div>
          </div>

          <!-- Tags / Badges -->
          <div class="flex flex-wrap gap-1.5 pt-2">
            <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
              TER: {{ fund.fee?.toFixed(2) || '1.28' }}%
            </span>
            <span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/60 rounded text-[10px] font-semibold">
              FX: {{ fund.fx || 'ตามดุลยพินิจ - ปัจจุบัน 55%' }}
            </span>
          </div>

          <!-- Links -->
          <div class="flex items-center gap-3 text-[11px] font-medium pt-1" :style="{ color: 'var(--fund-accent)' }">
            <a href="#" class="flex items-center gap-1 hover:underline">📄 หนังสือชี้ชวน</a>
            <a href="#" class="flex items-center gap-1 hover:underline">📊 Factsheet</a>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
          <button
            class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
            :class="isSelected ? 'text-white shadow-sm bg-[var(--fund-accent)]' : 'border bg-white hover:bg-slate-50'"
            :style="!isSelected ? { borderColor: 'var(--fund-accent)', color: 'var(--fund-accent)' } : {}"
            @click="$emit('toggle-compare', fund.id)"
          >
            <span v-if="isSelected">✓ อยู่ในเปรียบเทียบ</span>
            <span v-else>+ เพิ่มไปเปรียบเทียบ</span>
          </button>
          <button class="flex-1 py-2 px-3 text-white rounded-xl text-xs font-bold shadow-sm transition-colors bg-[var(--fund-accent)] hover:brightness-90">
            ข้อมูลเพิ่มเติม
          </button>
        </div>
      </div>

    </div>
  </div>
</template>