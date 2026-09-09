<script setup>
import { computed, ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import Chart from 'chart.js/auto'
import { STOCK_META } from '../../data/fundinfoData'

const props = defineProps({
  fund: { type: Object, required: true },
  colspan: { type: Number, default: 12 },
  inCompare: { type: Boolean, default: false },
})
const emit = defineEmits(['compare'])
const router = useRouter()

const cyChartRef = ref(null)
const assetChartRef = ref(null)
const top5PieRef = ref(null)

let cyChartInstance = null
let assetChartInstance = null
let top5ChartInstance = null

const HOLDING_COLORS = ['#4B543B', '#DCE2AA', '#B57F50', '#8ED081', '#B4D2BA']
const ASSET_COLORS = ['#2456d8', '#0e7ac0', '#12b76a', '#e0a411', '#7a5af5', '#64748b']

const allocation = computed(() => {
  const mix = props.fund.sectorMix || props.fund.sectors || props.fund.mix || []
  if (Array.isArray(mix)) {
    return mix.map((item) => {
      if (Array.isArray(item)) return { name: item[0], percent: item[1] }
      return item
    })
  }
  return []
})

const allocationMax = computed(() => Math.max(...allocation.value.map((item) => Number(item.percent) || 0), 1))

const assetList = computed(() => {
  const assets = props.fund.asset || []
  if (Array.isArray(assets)) {
    return assets.map((item) => {
      if (Array.isArray(item)) return { name: item[0], percent: item[1] }
      return item
    })
  }
  return []
})

const topHoldings = computed(() => {
  const list = props.fund.top5 || []
  return list.slice(0, 5).map((item) => {
    if (Array.isArray(item)) return { name: item[0], percent: item[1] }
    return item
  })
})

const sharpeVal = computed(() => props.fund.st?.sharpe ?? props.fund.stats?.sharpe ?? props.fund.sharpe ?? '-')
const maxddVal = computed(() => {
  const v = props.fund.st?.maxdd ?? props.fund.stats?.maxdd
  if (v != null) return `${v}%`
  return props.fund.drawdown || '-'
})
const recoverVal = computed(() => {
  const v = props.fund.st?.recover ?? props.fund.stats?.recover ?? 12
  return `${v} ด.`
})

const fxValue = computed(() => props.fund.st?.fxhedge ?? props.fund.stats?.fxhedge)
const fxBadge = computed(() => {
  const v = fxValue.value
  if (v == null) return { text: 'FX: ไม่มี FX (กองในประเทศ)', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
  if (v === 100) return { text: 'FX: Fully Hedged · ป้องกัน 100%', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' }
  if (v === 0) return { text: 'FX: Unhedged · ไม่ป้องกัน', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' }
  return { text: `FX: ตามดุลยพินิจ · ปัจจุบัน ${v}%`, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' }
})

function getStockName(name) {
  return STOCK_META[name]?.ticker || name
}

function goToDetail() {
  router.push({ name: 'fundinfo-detail', params: { id: props.fund.id } })
}

function renderCyrChart() {
  cyChartInstance?.destroy()
  cyChartInstance = null
  const data = props.fund.cyr
  if (!cyChartRef.value || !data) return

  let labels = []
  let values = []
  if (Array.isArray(data)) {
    labels = data.map((item) => (Array.isArray(item) ? item[0] : item.year))
    values = data.map((item) => (Array.isArray(item) ? item[1] : item.return))
  } else {
    labels = Object.keys(data)
    values = Object.values(data)
  }

  cyChartInstance = new Chart(cyChartRef.value, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: values.map((v) => (v >= 0 ? '#12b76a' : '#f04438')),
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.raw >= 0 ? '+' : ''}${ctx.raw}%`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7c8da5', font: { size: 10 } } },
        y: {
          grid: { color: 'rgba(148, 163, 184, .16)' },
          ticks: { color: '#7c8da5', font: { size: 9 }, callback: (v) => `${v}%` },
        },
      },
    },
  })
}

function renderAssetChart() {
  assetChartInstance?.destroy()
  assetChartInstance = null
  if (!assetChartRef.value || !assetList.value.length) return

  assetChartInstance = new Chart(assetChartRef.value, {
    type: 'doughnut',
    data: {
      labels: assetList.value.map((a) => a.name),
      datasets: [
        {
          data: assetList.value.map((a) => a.percent),
          backgroundColor: ASSET_COLORS.slice(0, assetList.value.length),
          borderColor: 'rgba(255,255,255,.6)',
          borderWidth: 1.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          position: 'right',
          labels: { boxWidth: 8, font: { size: 9 }, padding: 4 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${ctx.parsed}%`,
          },
        },
      },
    },
  })
}

function renderTop5PieChart() {
  top5ChartInstance?.destroy()
  top5ChartInstance = null
  if (!top5PieRef.value || !topHoldings.value.length) return

  top5ChartInstance = new Chart(top5PieRef.value, {
    type: 'doughnut',
    data: {
      labels: topHoldings.value.map((h) => getStockName(h.name)),
      datasets: [
        {
          data: topHoldings.value.map((h) => Math.max(Number(h.percent) || 0, 4)),
          backgroundColor: HOLDING_COLORS.slice(0, topHoldings.value.length),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const orig = topHoldings.value[ctx.dataIndex]?.percent
              return ` ${ctx.label}: ${orig != null ? orig : 0}%`
            },
          },
        },
      },
    },
  })
}

function renderAllCharts() {
  nextTick(() => {
    renderCyrChart()
    renderAssetChart()
    renderTop5PieChart()
  })
}

onMounted(renderAllCharts)
watch(() => props.fund, renderAllCharts, { deep: true })
onUnmounted(() => {
  cyChartInstance?.destroy()
  assetChartInstance?.destroy()
  top5ChartInstance?.destroy()
})
</script>

<template>
  <tr class="fund-detail-row bg-slate-50/50 dark:bg-slate-900/40">
    <td :colspan="colspan" class="p-0">
      <div class="p-4 bg-white dark:bg-slate-850 border-t border-[var(--line)]">
        <div class="grid lg:grid-cols-3 gap-5">
          <!-- Col 1: Calendar Year Returns + Key Stats -->
          <div class="surf brd rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
            <div>
              <div class="text-[11px] font-bold sub mb-1.5">Calendar Year Returns (ผลตอบแทนรายปี)</div>
              <div class="h-32 surf2 brd rounded-lg p-2 mb-2.5">
                <canvas ref="cyChartRef"></canvas>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="surf2 rounded-lg px-2 py-2 text-center">
                <div class="text-[9px] sub">Sharpe</div>
                <div class="num text-[14px] font-extrabold txt">{{ sharpeVal }}</div>
              </div>
              <div class="surf2 rounded-lg px-2 py-2 text-center">
                <div class="text-[9px] sub">Max Drawdown</div>
                <div class="num text-[14px] font-extrabold text-rose-600 dark:text-rose-400">{{ maxddVal }}</div>
              </div>
              <div class="surf2 rounded-lg px-2 py-2 text-center">
                <div class="text-[9px] sub">Recovery</div>
                <div class="num text-[14px] font-extrabold txt">{{ recoverVal }}</div>
              </div>
            </div>
          </div>

          <!-- Col 2: Sector Allocation + Asset Weight -->
          <div class="surf brd rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
            <div>
              <div class="text-[11px] font-bold sub mb-1">สัดส่วนกลุ่มอุตสาหกรรม (Sector)</div>
              <div class="space-y-1 py-1">
                <div v-for="item in allocation.slice(0, 5)" :key="item.name" class="flex items-center gap-1.5">
                  <span class="w-24 shrink-0 text-[10px] sub truncate" :title="item.name">{{ item.name }}</span>
                  <span class="flex-1 h-2 rounded-full surf2 overflow-hidden">
                    <span
                      class="block h-full rounded-full bg-[var(--brand)]"
                      :style="{ width: `${Math.max(6, (item.percent / allocationMax) * 100)}%` }"
                    ></span>
                  </span>
                  <span class="num w-9 text-right text-[10px] font-bold txt">{{ item.percent }}%</span>
                </div>
                <div v-if="!allocation.length" class="text-xs sub text-center py-2">ไม่มีข้อมูล Sector</div>
              </div>
            </div>

            <div v-if="assetList.length" class="mt-2">
              <div class="text-[11px] font-bold sub mb-1">น้ำหนักพอร์ต (Asset Allocation)</div>
              <div class="h-24 surf2 brd rounded-lg p-1.5">
                <canvas ref="assetChartRef"></canvas>
              </div>
            </div>
          </div>

          <!-- Col 3: Top 5 Holdings + TER / FX + Actions -->
          <div class="surf brd rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
            <div>
              <div class="text-[11px] font-bold sub mb-2">Top 5 Holdings (ทรัพย์สินที่ถือ)</div>
              <div class="flex items-center gap-3 mb-2.5">
                <div class="w-[86px] h-[86px] shrink-0 relative flex items-center justify-center">
                  <canvas ref="top5PieRef" width="86" height="86"></canvas>
                </div>
                <div class="flex-1 min-w-0 space-y-1">
                  <div
                    v-for="(h, idx) in topHoldings"
                    :key="h.name"
                    class="flex items-center justify-between text-[11px]"
                  >
                    <div class="flex items-center gap-1.5 min-w-0 pr-1">
                      <span
                        class="w-2.5 h-2.5 rounded-xs shrink-0 shadow-2xs"
                        :style="{ background: HOLDING_COLORS[idx % HOLDING_COLORS.length] }"
                      ></span>
                      <strong class="font-bold txt truncate" :title="h.name">{{ getStockName(h.name) }}</strong>
                    </div>
                    <span class="num font-bold txt ml-1">{{ Number(h.percent).toFixed(1) }}%</span>
                  </div>
                  <div v-if="!topHoldings.length" class="text-xs sub">ไม่มีข้อมูล</div>
                </div>
              </div>

              <!-- TER & FX Badges -->
              <div class="flex items-center gap-2 mb-2.5 flex-wrap">
                <span class="num text-[11px] font-bold px-2.5 py-1 rounded-md surf2 brd">
                  TER: {{ fund.fee ? fund.fee.toFixed(2) : '-' }}%
                </span>
                <span class="num text-[11px] font-bold px-2.5 py-1 rounded-md" :class="fxBadge.cls">
                  {{ fxBadge.text }}
                </span>
              </div>

              <!-- PDF Documents -->
              <div class="flex items-center gap-4 mb-3 pb-3 border-b border-[var(--line)]">
                <a
                  href="#"
                  class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                  @click.prevent="alert('ตัวอย่าง: เปิดเอกสาร หนังสือชี้ชวน (PDF)')"
                >
                  <span class="w-5 h-4.5 bg-rose-600 text-white rounded text-[8px] font-bold flex items-center justify-center">PDF</span>
                  หนังสือชี้ชวน
                </a>
                <a
                  href="#"
                  class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--brand)] hover:underline"
                  @click.prevent="alert('ตัวอย่าง: เปิดเอกสาร Factsheet (PDF)')"
                >
                  <span class="w-5 h-4.5 bg-rose-600 text-white rounded text-[8px] font-bold flex items-center justify-center">PDF</span>
                  Factsheet
                </a>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex-1 py-2 rounded-xl text-xs font-bold border transition shadow-xs"
                :class="
                  inCompare
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                    : 'surf2 text-[var(--brand)] border-blue-200/80 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                "
                @click="emit('compare')"
              >
                {{ inCompare ? '✓ อยู่ในเปรียบเทียบ' : '+ เพิ่มเปรียบเทียบ' }}
              </button>

              <button
                type="button"
                class="flex-1 py-2 rounded-xl text-xs font-extrabold text-white text-center shadow-xs hover:brightness-110 transition flex items-center justify-center gap-1 bg-[var(--brand)]"
                @click="goToDetail"
              >
                <span>ดูข้อมูลเต็ม</span>
                <span>↗</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </td>
  </tr>
</template>

