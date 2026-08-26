<!-- InsightCompareSection.vue -->
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { COMPARE_COLORS, COMPARE_DASH, useFundinfoInsight } from '../../composables/useFundinfoInsight'
import { useFundinfoRanking } from '../../composables/useFundinfoRanking'
import { CMP_LABELS, performanceSeries } from '../../composables/useFundinfoThemeTrend'
import { formatPercent } from '../../utils/fundinfoFormat'
import { fundinfoApiMode } from '../../services/fundinfoApi'
import InfoTooltip from '../common/InfoTooltip.vue'

const props = defineProps({
  type: { type: String, default: 'offshore' },
})

const { bench, cardsData, itemLabel, maxSelected, stock } = useFundinfoInsight(props.type)
const { clearSelection } = useFundinfoRanking(props.type)

const combinedCanvas = ref(null)
let combinedChart = null

// เรียงตารางแบบคลิกหัวคอลัมน์ เหมือนตาราง "กองทุนที่ตรงเงื่อนไข" ด้านบน —
// '' = ยังไม่เลือก sort (เรียงตามลำดับที่เลือกจาก Ranking Card)
const localSortKey = ref('')
const localSortDir = ref('desc') // 'desc' = มากไปน้อย, 'asc' = น้อยไปมาก

function parseAumValue(raw) {
  if (typeof raw === 'number') return raw
  if (typeof raw !== 'string') return 0
  const match = raw.replace(/US\$|\$|฿/g, '').match(/([\d,]+(?:\.\d+)?)\s*(ล้าน|[MBK])?/i)
  if (!match) return 0
  const num = parseFloat(match[1].replace(/,/g, ''))
  const unit = (match[2] || '').toUpperCase()
  const mult = unit === 'B' ? 1e9 : unit === 'M' || unit === 'ล้าน' ? 1e6 : unit === 'K' ? 1e3 : 1
  return num * mult
}

// คืนค่า null เมื่อการ์ดนั้นไม่มีข้อมูลคอลัมน์นี้จริง ๆ (เช่น P/E ของกองทุนตราสารหนี้/ทองคำ)
// เพื่อให้แถวที่ไม่มีข้อมูลถูกจัดไปท้ายตารางเสมอ แทนที่จะถูกนับเป็น 0 แล้วปนกับค่าจริง
function sortValue(card, field) {
  switch (field) {
    case 'perf':
      return card.perf ?? null
    case 'aum': {
      const raw = card.aum ?? card.cap
      return raw != null ? parseAumValue(raw) : null
    }
    case 'maxDrawdown':
      return card.maxDrawdown ?? null
    case 'pe':
      return card.pe ?? null
    case 'pb':
      return card.pb ?? null
    case 'gap':
      return card.gap ?? null
    default:
      return null
  }
}

const sortedCardsData = computed(() => {
  const list = [...cardsData.value]
  if (!localSortKey.value) return list
  const dir = localSortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const av = sortValue(a, localSortKey.value)
    const bv = sortValue(b, localSortKey.value)
    if (av == null && bv == null) return 0
    if (av == null) return 1 // ไม่มีข้อมูล -> ไปท้ายตารางเสมอ ไม่ว่าจะ sort ทิศไหน
    if (bv == null) return -1
    return (av - bv) * dir
  })
})

const selectionSignature = computed(() => cardsData.value.map((card) => `${card.kind}:${card.id}`).join('|'))
const hasHistoricalSeries = computed(() =>
  cardsData.value.some((card) => Array.isArray(card.series) && card.series.length === CMP_LABELS.length),
)

function setSortLocal(key) {
  if (localSortKey.value === key) {
    localSortDir.value = localSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    localSortKey.value = key
    localSortDir.value = 'desc'
  }
}

// คว่ำลง (▼) = มากไปน้อย, หงายขึ้น (▲) = น้อยไปมาก, ↕ = คอลัมน์นี้ยังไม่ได้ sort
function sortIcon(key) {
  if (localSortKey.value !== key) return '↕'
  return localSortDir.value === 'asc' ? '▲' : '▼'
}

function shortBench(name) {
  return (name || '').replace(/ Index$/, '')
}
function formatAum(aum) {
  return typeof aum === 'string' ? aum.replace('US$', '$') : aum || '—'
}
function finiteNumber(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null }
function formatOptionalPercent(value) {
  const safeValue = finiteNumber(value)
  return safeValue === null ? '—' : formatPercent(safeValue, 1)
}
function formatOptionalDrawdown(value) {
  const safeValue = finiteNumber(value)
  return safeValue === null ? '—' : `${safeValue}%`
}
function valueTone(value) {
  const safeValue = finiteNumber(value)
  return safeValue === null ? '' : safeValue >= 0 ? 'text-pos' : 'text-neg'
}

function destroyChart() {
  if (combinedChart) {
    combinedChart.destroy()
    combinedChart = null
  }
}

function createChart(canvas, entries) {
  destroyChart()
  const chartEntries = entries.filter((entry) => Array.isArray(entry.series) && entry.series.length === CMP_LABELS.length)
  if (!canvas || !chartEntries.length) return

  const datasets = chartEntries.map((entry, index) => ({
    label: `${index + 1}. ${entry.title}`,
    data: entry.series,
    borderColor: COMPARE_COLORS[index % COMPARE_COLORS.length],
    backgroundColor: COMPARE_COLORS[index % COMPARE_COLORS.length],
    borderDash: COMPARE_DASH[index % COMPARE_DASH.length],
    borderWidth: 2.3,
    tension: 0.32,
    pointRadius: 0,
    pointHoverRadius: 4,
    fill: false,
  }))

  datasets.push({
    label: `${bench.name} · จุดอ้างอิง`,
    data: performanceSeries(731, bench.ret, CMP_LABELS.length),
    borderColor: '#94a3b8',
    backgroundColor: '#94a3b8',
    borderDash: [5, 4],
    borderWidth: 1.8,
    tension: 0.3,
    pointRadius: 0,
    pointHoverRadius: 4,
    fill: false,
  })

  combinedChart = new Chart(canvas, {
    type: 'line',
    data: { labels: CMP_LABELS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 28, usePointStyle: true, pointStyle: 'line', padding: 12, font: { size: 12 } },
        },
        tooltip: {
          callbacks: { label: (context) => ` ${context.dataset.label}: ${(context.parsed.y - 100).toFixed(1)}%` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#71809a', font: { size: 9 }, maxRotation: 0 } },
        y: {
          grid: { color: 'rgba(148, 163, 184, .18)' },
          ticks: { color: '#71809a', font: { size: 9 }, callback: (value) => `${value - 100}%` },
        },
      },
    },
  })
}

async function rebuildCharts() {
  await nextTick()
  createChart(combinedCanvas.value, cardsData.value)
}

watch([selectionSignature, hasHistoricalSeries], rebuildCharts)
onMounted(rebuildCharts)
onUnmounted(destroyChart)
</script>

<template>
  <section :id="`insight-${props.type}`" class="comparison-workspace">
    <div class="comparison-heading">
      <div>
        <h2>เปรียบเทียบผลตอบแทนหุ้นต่างประเทศบนกราฟเดียวกัน <InfoTooltip text="ผลตอบแทนราคาแบบฐาน 100 · 12 เดือน · กองทุนที่ถือหุ้นเหล่านี้จะแสดงต่อในตารางด้านล่าง" /></h2>
      </div>
      <div class="comparison-actions">
        <span>เลือกแล้ว {{ cardsData.length }}/{{ maxSelected }}</span>
        <button v-if="cardsData.length" type="button" @click="clearSelection">ล้างทั้งหมด</button>
      </div>
    </div>

    <article class="comparison-panel">
      <div class="comparison-panel-body">
        <template v-if="cardsData.length && hasHistoricalSeries">
          <!-- จุดอ้างอิง -->
          <div class="industry-benchmark">
            <span class="dashed-line">------</span>
            <b>จุดอ้างอิง: {{ bench.name }}</b>
            <span>ใช้เป็นเส้นกลางเพื่ออ่านทิศทาง ไม่ใช่ benchmark ทางการของ{{ itemLabel }}ทุกตัว</span>
          </div>
          <p v-if="fundinfoApiMode !== 'mock'" class="text-[10px] sub text-right">
            * หมายเหตุ: เส้นกราฟลากเชื่อมผลตอบแทนสะสมจริงตามช่วงเวลาที่ API เปิดเผย (1M/3M/1Y/3Y/5Y/10Y) ด้วยเส้นตรง ไม่ใช่ราคาปิดรายวันจริง
          </p>
          <div class="comparison-chart-full">
            <canvas ref="combinedCanvas" />
          </div>
        </template>
        <div v-else-if="cardsData.length" class="comparison-empty">API ยังไม่มีข้อมูลผลตอบแทนรายช่วงเวลาสำหรับสร้างกราฟเปรียบเทียบ</div>
        <div v-else class="comparison-empty">เลือกรายการจากการ์ดจัดอันดับด้านบนเพื่อเริ่มเปรียบเทียบ</div>

        <!-- แยก Heading ออกมาจาก Table Wrap เพื่อไม่ให้เลื่อนตามตาราง -->
        <template v-if="cardsData.length">
          <div class="compare-table-heading">
            <h3>{{ stock ? `${itemLabel}ที่กำลังเปรียบเทียบ` : 'กองทุนที่กำลังเปรียบเทียบ' }}</h3>
          </div>
          
          <div class="compare-table-wrap">
            <table class="compare-fund-table">
              <thead>
                <tr>
                  <th>{{ stock ? itemLabel : 'กองทุน' }}</th>
                  <th class="text-right sortable" @click="setSortLocal('perf')">
                    {{ stock ? 'ผลตอบแทน 1 ปี' : 'ผลตอบแทนกองทุน 1 ปี' }}
                    <span class="sort-arrow" :class="{ active: localSortKey === 'perf' }">{{ sortIcon('perf') }}</span>
                  </th>
                  <th class="text-right sortable" @click="setSortLocal('aum')">
                    {{ stock ? 'AUM / Market Cap' : 'AUM' }}
                    <span class="sort-arrow" :class="{ active: localSortKey === 'aum' }">{{ sortIcon('aum') }}</span>
                  </th>
                  <th class="text-right sortable" @click="setSortLocal('maxDrawdown')">
                    Max Drawdown
                    <span class="sort-arrow" :class="{ active: localSortKey === 'maxDrawdown' }">{{ sortIcon('maxDrawdown') }}</span>
                  </th>
                  <th class="text-right sortable" @click="setSortLocal('pe')">
                    P/E Ratio
                    <span class="sort-arrow" :class="{ active: localSortKey === 'pe' }">{{ sortIcon('pe') }}</span>
                  </th>
                  <th class="text-right sortable" @click="setSortLocal('pb')">
                    P/B Ratio
                    <span class="sort-arrow" :class="{ active: localSortKey === 'pb' }">{{ sortIcon('pb') }}</span>
                  </th>
                  <th class="text-right sortable" @click="setSortLocal('gap')">
                    เทียบจุดอ้างอิง
                    <span class="sort-arrow" :class="{ active: localSortKey === 'gap' }">{{ sortIcon('gap') }}</span>
                  </th>
                  <th>ดัชนีประจำกอง</th>
                  <th>Top exposure</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(card, index) in sortedCardsData" :key="card.id">
                  <td class="compare-fund-name">
                    <span class="compare-fund-avatar" :style="{ background: COMPARE_COLORS[index % COMPARE_COLORS.length] }">{{ (card.title || '').slice(0, 2).toUpperCase() }}</span>
                    <span class="compare-fund-text min-w-0"><strong class="block truncate" :title="card.title">{{ card.title }}</strong><small>{{ card.subtitle }}</small></span>
                  </td>
                  <!-- Output Defense — API-derived values render as escaped text only. -->
                  <td class="text-right" :class="valueTone(card.perf)">{{ formatOptionalPercent(card.perf) }}</td>
                  <td class="text-right">{{ formatAum(card.aum ?? card.cap) }}</td>
                  <td class="text-right" :class="valueTone(card.maxDrawdown)">{{ formatOptionalDrawdown(card.maxDrawdown) }}</td>
                  <td class="text-right">{{ card.pe != null ? `${card.pe}x` : '-' }}</td>
                  <td class="text-right">{{ card.pb != null ? `${card.pb}x` : '-' }}</td>
                  <td class="text-right" :class="valueTone(card.gap)">{{ formatOptionalPercent(card.gap) }}</td>
                  <td>{{ card.benchName ? shortBench(card.benchName) : '-' }}</td>
                  <td>{{ card.topTickers || card.holdings || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        
      </div>
    </article>
  </section>
</template>
