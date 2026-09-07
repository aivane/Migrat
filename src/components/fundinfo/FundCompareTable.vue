<!-- FundCompareTable.vue -->
<script setup>
import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { formatPercent } from '../../utils/fundinfoFormat'

const props = defineProps({
  selectedFunds: { type: Array, default: () => [] },
})

defineEmits(['clear-all', 'remove-fund'])

const collapsed = ref(false)

// ---------- Fund colors (up to 3 funds) ----------
const FUND_COLORS = ['#2456d8', '#12b76a', '#e0a411']
const FUND_COLORS_ALPHA = ['rgba(36,86,216,0.15)', 'rgba(18,183,106,0.15)', 'rgba(224,164,17,0.15)']

// ---------- Chart refs ----------
const returnChartRef = ref(null)
const sharpeChartRef = ref(null)
const feeChartRef = ref(null)
const chartInstances = {}

function fundType(fund) {
  return { thai: 'Thai Fund', offshore: 'Offshore Fund', feeder: 'Feeder Fund', mixed: 'Mixed Fund' }[fund.type] || 'Fund'
}

// ---------- Bar chart builder ----------
function buildBar(key, canvas, labels, datasets) {
  chartInstances[key]?.destroy()
  chartInstances[key] = null
  if (!canvas) return

  chartInstances[key] = new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(148,163,184,.15)' },
          ticks: { font: { size: 11 }, callback: (v) => `${v}%` },
        },
      },
    },
  })
}

// ---------- Metric chart data ----------
const METRIC_LABELS = ['1Y Return', '3Y Return', '5Y Return']

const returnDatasets = computed(() =>
  props.selectedFunds.map((fund, i) => ({
    label: fund.id,
    data: [
      fund.perf ?? fund.retP?.y1 ?? 0,
      fund.retP?.y3 ?? 0,
      fund.retP?.y5 ?? 0,
    ],
    backgroundColor: FUND_COLORS_ALPHA[i],
    borderColor: FUND_COLORS[i],
    borderWidth: 2,
    borderRadius: 4,
  })),
)

const SHARPE_LABELS = ['Sharpe 1Y', 'Max Drawdown', 'SD (Risk)']

const sharpeDatasets = computed(() =>
  props.selectedFunds.map((fund, i) => ({
    label: fund.id,
    data: [
      fund.sharpe ?? fund.stats?.sharpe ?? 0,
      fund.stats?.maxdd ?? 0,
      fund.stats?.sd ?? 0,
    ],
    backgroundColor: FUND_COLORS_ALPHA[i],
    borderColor: FUND_COLORS[i],
    borderWidth: 2,
    borderRadius: 4,
  })),
)

const FEE_LABELS = ['TER (%)', 'Front-End (%)', 'Back-End (%)']

const feeDatasets = computed(() =>
  props.selectedFunds.map((fund, i) => ({
    label: fund.id,
    data: [
      fund.fee ?? 0,
      fund.frontEndFee ?? 0,
      fund.backEndFee ?? 0,
    ],
    backgroundColor: FUND_COLORS_ALPHA[i],
    borderColor: FUND_COLORS[i],
    borderWidth: 2,
    borderRadius: 4,
  })),
)

// ---------- Render / re-render on data change ----------
async function renderCharts() {
  if (collapsed.value || !props.selectedFunds.length) return
  await nextTick()
  buildBar('return', returnChartRef.value, METRIC_LABELS, returnDatasets.value)
  buildBar('sharpe', sharpeChartRef.value, SHARPE_LABELS, sharpeDatasets.value)
  buildBar('fee',    feeChartRef.value,    FEE_LABELS,    feeDatasets.value)
}

watch([() => props.selectedFunds, collapsed], renderCharts, { deep: true, immediate: true })
onUnmounted(() => Object.values(chartInstances).forEach((c) => c?.destroy()))
</script>

<template>
  <section v-if="selectedFunds.length" class="fund-matrix">
    <header class="fund-matrix-heading">
      <button type="button" class="fund-matrix-title" @click="collapsed = !collapsed">
        <span :class="{ collapsed }">⌄</span> เปรียบเทียบกองทุนที่เลือก ({{ selectedFunds.length }})
      </button>
      <button type="button" class="fund-matrix-clear" @click="$emit('clear-all')">ล้าง ×</button>
    </header>

    <div v-if="!collapsed">

      <!-- ===== Bar Charts ===== -->
      <div class="fund-compare-charts">
        <!-- 1. Return chart -->
        <div class="fund-compare-chart-card">
          <p class="fund-compare-chart-title">📈 ผลตอบแทน (%)</p>
          <div class="fund-compare-chart-wrap">
            <canvas ref="returnChartRef" />
          </div>
        </div>

        <!-- 2. Risk/Quality chart -->
        <div class="fund-compare-chart-card">
          <p class="fund-compare-chart-title">⚖️ Risk &amp; Quality</p>
          <div class="fund-compare-chart-wrap">
            <canvas ref="sharpeChartRef" />
          </div>
        </div>

        <!-- 3. Fee chart -->
        <div class="fund-compare-chart-card">
          <p class="fund-compare-chart-title">💸 ค่าธรรมเนียม (%)</p>
          <div class="fund-compare-chart-wrap">
            <canvas ref="feeChartRef" />
          </div>
        </div>
      </div>

      <!-- ===== Data Table ===== -->
      <div class="overflow-x-auto">
        <!--
          Layout Fix: table-fixed บังคับให้ browser ใช้ความกว้างคอลัมน์จาก <th> แถวแรกเท่านั้น
          ไม่คำนวณจากความยาว content ในแต่ละแถว (เดิมไม่มี table-fixed ทำให้ความกว้างคอลัมน์
          สั่นไหว/ไม่ตรงกันทุกครั้งที่ selectedFunds เปลี่ยน เช่น ชื่อกอง/ตัวเลข drawdown ยาวไม่เท่ากัน)
        -->
        <table class="fund-matrix-table table-fixed w-full">
          <thead>
            <tr>
              <!-- คอลัมน์ label ตรึงความกว้างคงที่ -->
              <th class="w-[130px]">ข้อมูล</th>
              <!--
                คอลัมน์กองทุนหารความกว้างที่เหลือเท่า ๆ กันตามจำนวนกองที่เลือก (1-3 กอง)
                กัน layout shift ตอนเพิ่ม/ลบกองทุนออกจากตารางเปรียบเทียบ
              -->
              <th
                v-for="(fund, i) in selectedFunds"
                :key="fund.id"
                class="relative"
                :style="{ width: `calc((100% - 130px) / ${selectedFunds.length})` }"
              >
                <!-- Color dot matching chart series -->
                <span
                  class="fund-compare-dot"
                  :style="{ background: FUND_COLORS[i] }"
                />
                <!-- Anti-XSS: ใช้ text interpolation ({{ }}) เท่านั้น ไม่มี v-html ในไฟล์นี้ Vue auto-escape ให้อยู่แล้ว -->
                <b>{{ fund.id }}</b>
                <small>{{ fund.amc }}</small>
                <button type="button" :aria-label="`นำ ${fund.id} ออก`" @click="$emit('remove-fund', fund.id)">×</button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr><th>ประเภท</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fundType(fund) }}</td></tr>
            <tr><th>1Y Return</th><td v-for="fund in selectedFunds" :key="fund.id" :class="fund.perf >= 0 ? 'positive' : 'negative'">{{ formatPercent(fund.perf, 1) }}</td></tr>
            <tr><th>3Y Return</th><td v-for="fund in selectedFunds" :key="fund.id" :class="(fund.retP?.y3 ?? 0) >= 0 ? 'positive' : 'negative'">{{ fund.retP?.y3 != null ? formatPercent(fund.retP.y3, 1) : '-' }}</td></tr>
            <tr><th>5Y Return</th><td v-for="fund in selectedFunds" :key="fund.id" :class="(fund.retP?.y5 ?? 0) >= 0 ? 'positive' : 'negative'">{{ fund.retP?.y5 != null ? formatPercent(fund.retP.y5, 1) : '-' }}</td></tr>
            <tr><th>Sharpe Ratio</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.sharpe?.toFixed(2) || '-' }}</td></tr>
            <tr><th>Max Drawdown</th><td v-for="fund in selectedFunds" :key="fund.id" class="negative">{{ fund.drawdown || '-' }}</td></tr>
            <tr><th>SD (Risk)</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.stats?.sd != null ? fund.stats.sd + '%' : '-' }}</td></tr>
            <tr><th>เงินปันผล</th><td v-for="fund in selectedFunds" :key="fund.id" class="positive">{{ fund.div?.toFixed(1) || '0.0' }}%</td></tr>
            <tr><th>TER (ค่าธรรมเนียม)</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.fee?.toFixed(2) || '-' }}%</td></tr>
            <tr><th>Master Fund</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.master || '-' }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>