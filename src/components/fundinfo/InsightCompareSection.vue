<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { COMPARE_COLORS, COMPARE_DASH, useFundinfoInsight } from '../../composables/useFundinfoInsight'
import { useFundinfoRanking } from '../../composables/useFundinfoRanking'
import { CMP_LABELS, performanceSeries } from '../../composables/useFundinfoThemeTrend'
import { formatPercent } from '../../utils/fundinfoFormat'

const props = defineProps({
  type: { type: String, default: 'offshore' },
})

const { bench, cardsData, itemLabel, maxSelected, stock } = useFundinfoInsight(props.type)
const { clearSelection, select } = useFundinfoRanking(props.type)

const stockOpen = ref(true)
const fundOpen = ref(props.type !== 'thai')
const stockCanvas = ref(null)
const fundCanvas = ref(null)
let stockChart = null
let fundChart = null

const stockCards = computed(() => cardsData.value.filter((card) => card.kind === 'stock'))
const fundCards = computed(() => cardsData.value.filter((card) => card.kind !== 'stock'))
const selectionSignature = computed(() => cardsData.value.map((card) => `${card.kind}:${card.id}`).join('|'))

function destroyChart(kind) {
  if (kind === 'stock' && stockChart) {
    stockChart.destroy()
    stockChart = null
  }
  if (kind === 'fund' && fundChart) {
    fundChart.destroy()
    fundChart = null
  }
}

function createChart(kind, canvas, entries) {
  destroyChart(kind)
  if (!canvas || !entries.length) return

  const datasets = entries.map((entry, index) => ({
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

  const instance = new Chart(canvas, {
    type: 'line',
    data: { labels: CMP_LABELS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { boxWidth: 20, usePointStyle: true, pointStyle: 'line', padding: 12, font: { size: 9 } },
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

  if (kind === 'stock') stockChart = instance
  else fundChart = instance
}

async function rebuildCharts() {
  await nextTick()
  if (stockOpen.value) createChart('stock', stockCanvas.value, stockCards.value)
  else destroyChart('stock')
  if (fundOpen.value) createChart('fund', fundCanvas.value, fundCards.value)
  else destroyChart('fund')
}

function togglePanel(kind) {
  if (kind === 'stock') stockOpen.value = !stockOpen.value
  else fundOpen.value = !fundOpen.value
}

watch([selectionSignature, stockOpen, fundOpen], rebuildCharts)
onMounted(rebuildCharts)
onUnmounted(() => {
  destroyChart('stock')
  destroyChart('fund')
})
</script>

<template>
  <section :id="`insight-${props.type}`" class="comparison-workspace">
    <div class="comparison-heading">
      <div>
        <h2>เปรียบเทียบผลตอบแทนบนกราฟเดียวกัน</h2>
        <p>เลือกจากรายการจัดอันดับด้านบนเพื่อดูการเคลื่อนไหวย้อนหลัง 12 เดือน</p>
      </div>
      <div class="comparison-actions">
        <span>เลือกแล้ว {{ cardsData.length }}/{{ maxSelected }}</span>
        <button v-if="cardsData.length" type="button" @click="clearSelection">ล้างทั้งหมด</button>
      </div>
    </div>

    <article class="comparison-panel">
      <button class="comparison-panel-title" type="button" @click="togglePanel('stock')">
        <span class="comparison-title-copy">
          <strong>1. เปรียบเทียบหุ้น{{ stock ? itemLabel.replace('หุ้น', '') : '' }}</strong>
          <small>หุ้นที่เลือก {{ stockCards.length }} รายการ · อ้างอิง {{ bench.name }}</small>
        </span>
        <span class="comparison-chevron" :class="{ open: stockOpen }">⌄</span>
      </button>

      <div v-if="stockOpen" class="comparison-panel-body">
        <div v-if="stockCards.length" class="comparison-grid">
          <div class="comparison-chart"><canvas ref="stockCanvas" /></div>
          <aside class="comparison-list">
            <div v-for="(card, index) in stockCards" :key="card.id" class="compare-selection" :style="{ borderLeftColor: COMPARE_COLORS[index % COMPARE_COLORS.length] }">
              <div>
                <b>{{ index + 1 }}. {{ card.title }}</b>
                <small>{{ card.subtitle }}</small>
              </div>
              <button type="button" aria-label="นำรายการออก" @click="select(card.id)">×</button>
              <div class="compare-selection-metrics">
                <span><i>1Y</i>{{ formatPercent(card.perf, 1) }}</span>
                <span><i>Max DD</i>{{ card.maxDrawdown }}%</span>
                <span><i>vs {{ bench.short }}</i>{{ card.gap > 0 ? '+' : '' }}{{ card.gap }}%</span>
              </div>
            </div>
          </aside>
        </div>
        <div v-else class="comparison-empty">เลือกรายการหุ้นจากการ์ดจัดอันดับเพื่อเริ่มเปรียบเทียบ</div>
      </div>
    </article>

    <article class="comparison-panel">
      <button class="comparison-panel-title" type="button" @click="togglePanel('fund')">
        <span class="comparison-title-copy">
          <strong>2. เปรียบเทียบกองทุน</strong>
          <small>กองทุนที่เลือก {{ fundCards.length }} รายการ · อ้างอิง {{ bench.name }}</small>
        </span>
        <span class="comparison-chevron" :class="{ open: fundOpen }">⌄</span>
      </button>

      <div v-if="fundOpen" class="comparison-panel-body">
        <div v-if="fundCards.length" class="comparison-grid">
          <div class="comparison-chart"><canvas ref="fundCanvas" /></div>
          <aside class="comparison-list">
            <div v-for="(card, index) in fundCards" :key="card.id" class="compare-selection" :style="{ borderLeftColor: COMPARE_COLORS[index % COMPARE_COLORS.length] }">
              <div>
                <b>{{ index + 1 }}. {{ card.title }}</b>
                <small>{{ card.subtitle }}</small>
              </div>
              <button type="button" aria-label="นำรายการออก" @click="select(card.id)">×</button>
              <div class="compare-selection-metrics">
                <span><i>1Y</i>{{ formatPercent(card.perf, 1) }}</span>
                <span><i>Max DD</i>{{ card.maxDrawdown }}%</span>
                <span><i>vs {{ bench.short }}</i>{{ card.gap > 0 ? '+' : '' }}{{ card.gap }}%</span>
              </div>
            </div>
          </aside>
        </div>
        <div v-else class="comparison-empty">เลือกรายการกองทุนจากการ์ดจัดอันดับเพื่อเริ่มเปรียบเทียบ</div>
      </div>
    </article>
  </section>
</template>
