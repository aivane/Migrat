<!-- MarketLensSection.vue -->
<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { useFundinfoMarketLens } from '../../composables/useFundinfoMarketLens'
import { performanceSeries, CMP_LABELS, COMPARE_COLORS } from '../../composables/useFundinfoThemeTrend'
import InfoTooltip from '../common/InfoTooltip.vue'

const props = defineProps({ type: { type: String, default: 'mixed' } })
const {
  scopes,
  state,
  leader,
  laggard,
  momentumTop,
  positiveCount,
  chartLines,
  chartTitle,
  bench,
  setScope,
  clearScope,
} = useFundinfoMarketLens(props.type)

const chartCanvas = ref(null)
let chartInstance = null

function signed(value) {
  return `${value > 0 ? '+' : ''}${value}%`
}

function buildChart() {
  chartInstance?.destroy()
  if (!chartCanvas.value) return

  const sets = chartLines.value.map((item, index) => ({
    label: item.scope.title,
    scopeId: item.scope.id,
    data: item.data,
    borderColor: COMPARE_COLORS[index % COMPARE_COLORS.length],
    backgroundColor: COMPARE_COLORS[index % COMPARE_COLORS.length],
    borderWidth: state.scope ? 2.8 : 2.1,
    pointRadius: 0,
    pointHoverRadius: 3,
    tension: .28,
    fill: false,
  }))

  sets.push({
    label: `${bench.name} · จุดอ้างอิง`,
    scopeId: null,
    data: performanceSeries(731, bench.ret, CMP_LABELS.length),
    borderColor: '#9aa9bd',
    backgroundColor: '#9aa9bd',
    borderWidth: 1.5,
    borderDash: [5, 3],
    pointRadius: 0,
    tension: .28,
    fill: false,
  })

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: { labels: CMP_LABELS, datasets: sets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (event) => {
        const points = chartInstance.getElementsAtEventForMode(event, 'nearest', { intersect: false }, true)
        const dataset = points.length && sets[points[0].datasetIndex]
        if (dataset?.scopeId) setScope(dataset.scopeId)
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 28, padding: 9, font: { size: 12, weight: '600' } },
        },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${(ctx.parsed.y - 100).toFixed(1)}%` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7c8da5', font: { size: 8 }, maxTicksLimit: 7 } },
        y: {
          grid: { color: 'rgba(148, 163, 184, .16)' },
          ticks: { color: '#7c8da5', font: { size: 8 }, callback: (value) => `${value - 100}%` },
        },
      },
    },
  })
}

watch(
  () => `${chartLines.value.map((item) => item.scope.id).join(',')}|${state.scope}`,
  async () => { await nextTick(); buildChart() },
)

onMounted(async () => { await nextTick(); buildChart() })
onUnmounted(() => chartInstance?.destroy())
</script>

<template>
  <section class="market-lens industry-analysis">
    <h2 class="industry-main-title">MARKET LENS · แนวโน้มสินทรัพย์</h2>

    <div class="industry-workspace">
      <header class="industry-header">
        <div>
          <h2>{{ chartTitle }} <InfoTooltip text="แสดงทั้งด้านบวกและด้านลบของตลาดโดยจำกัดไม่เกิน 5 กลุ่ม · คลิกสัญญาณ เส้น หรือปุ่ม เพื่อกรองข้อมูลส่วนถัดลงมา" /></h2>
        </div>
        <span class="market-lens-scope-badge">ขอบเขต: {{ state.scope || 'ภาพรวมตลาด' }}</span>
      </header>

      <div class="industry-kpis">
        <button type="button" :disabled="!leader" @click="leader && setScope(leader.scope.id)">
          <span>ผลตอบแทนสูงสุด 12 เดือน</span>
          <strong class="kpi-violet">{{ leader?.scope.title || '—' }}</strong>
          <small>{{ leader ? `${signed(leader.scope.perf)} · คลิกเพื่อเจาะดู` : 'ไม่มีข้อมูล' }}</small>
        </button>
        <button type="button" :disabled="!laggard" @click="laggard && setScope(laggard.scope.id)">
          <span>ผลตอบแทนต่ำสุด 12 เดือน</span>
          <strong class="is-negative">{{ laggard?.scope.title || '—' }}</strong>
          <small>{{ laggard ? `${signed(laggard.scope.perf)} · อีกด้านของตลาด` : 'ไม่มีข้อมูล' }}</small>
        </button>
        <button type="button" :disabled="!momentumTop" @click="momentumTop && setScope(momentumTop.scope.id)">
          <span>โมเมนตัม 3 เดือน</span>
          <strong class="kpi-violet">{{ momentumTop?.scope.title || '—' }}</strong>
          <small>{{ momentumTop ? `${signed(momentumTop.momentum)} ใน 3 เดือนล่าสุด` : 'ไม่มีข้อมูล' }}</small>
        </button>
        <div>
          <span>กลุ่มที่เป็นบวก</span>
          <strong class="is-positive">{{ positiveCount }}/{{ scopes.length }} กลุ่ม</strong>
          <small>ผลตอบแทน 12 เดือนมากกว่า 0%</small>
        </div>
      </div>

      <div class="industry-chart-title" style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start; margin-top: 20px;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <b style="font-size: 14px; font-weight: 800; color: #64748b;">เปรียบเทียบ Performance บนกราฟเดียวกัน</b>
          <InfoTooltip :text="`ผลตอบแทนแบบฐาน 100 ย้อนหลัง 12 เดือน · เส้นประคือ ${bench.name}`" />
        </div>
      </div>

      <div class="industry-benchmark" style="width: 100%; max-width: 800px; display: flex; justify-content: center; margin: 12px auto 0 auto; margin-bottom: 12px;">
        <span class="dashed-line">------</span>
        <b>จุดอ้างอิง: {{ bench.name }}</b>
        <span>Performance คำนวณจากตะกร้าหุ้นที่พบใน Top Holdings ไม่ได้อ้างอิงดัชนีอย่างเป็นทางการ</span>
      </div>

      <div class="industry-chart">
        <canvas ref="chartCanvas" :aria-label="`กราฟ ${chartTitle} เทียบ ${bench.name}`"></canvas>
      </div>

      <span style="font-size: 13px; color: var(--sub);">เลือกสินทรัพย์เพื่อดูเฉพาะกลุ่ม</span>
      <div class="industry-scope-options market-lens-scope-row">
        <button
          type="button"
          class="industry-scope-toggle"
          :class="{ selected: !state.scope }"
          style="--scope-color: #7557e8;"
          @click="clearScope"
        >
          ภาพรวม
        </button>
        <button
          v-for="scope in scopes"
          :key="scope.id"
          type="button"
          class="industry-scope-toggle"
          :class="{ selected: state.scope === scope.id }"
          style="--scope-color: #7557e8;"
          @click="setScope(scope.id)"
        >
          {{ scope.title }}
        </button>
      </div>
    </div>
  </section>
</template>