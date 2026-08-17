<!-- ThemeTrendSection.vue -->
<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import {
  useFundinfoThemeTrend,
  performanceSeries,
  formatFlow,
  CMP_LABELS,
  COMPARE_COLORS,
  COMPARE_DASH,
} from '../../composables/useFundinfoThemeTrend'
import InfoTooltip from '../common/InfoTooltip.vue'

const props = defineProps({ type: { type: String, default: 'feeder' } })

const {
  stats,
  state,
  visibleStats,
  selectedStats,
  positiveCount,
  acceleratingCount,
  outperformCount,
  maxReached,
  orderOf,
  toggle,
  clear,
  setView,
} = useFundinfoThemeTrend(props.type)

const BENCH_LABEL = 'MSCI ACWI'
const GLOBAL_RETURN = 12.8
const detailCanvas = ref(null)
const chartGroupsOpen = ref(true)
let detailChart = null

function buildDetailChart() {
  detailChart?.destroy()
  if (!detailCanvas.value || !selectedStats.value.length) return

  const datasets = selectedStats.value.map((s, index) => ({
    label: `${index + 1}. ${s.scope.title}`,
    data: s.series,
    borderColor: COMPARE_COLORS[index],
    backgroundColor: COMPARE_COLORS[index],
    borderWidth: 2.4,
    borderDash: COMPARE_DASH[index],
    pointRadius: 0,
    pointHoverRadius: 3,
    tension: 0.3,
    fill: false,
  }))
  datasets.push({
    label: `${BENCH_LABEL} · จุดอ้างอิง`,
    data: performanceSeries(731, GLOBAL_RETURN, CMP_LABELS.length),
    borderColor: '#9aa9bd',
    backgroundColor: '#9aa9bd',
    borderWidth: 1.6,
    borderDash: [5, 3],
    pointRadius: 0,
    tension: 0.3,
    fill: false,
  })

  detailChart = new Chart(detailCanvas.value, {
    type: 'line',
    data: { labels: CMP_LABELS, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 16, padding: 9, font: { size: 8, weight: '600' } } },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${(c.parsed.y - 100).toFixed(1)}%` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7c8da5', font: { size: 8 }, maxTicksLimit: 7 } },
        y: { grid: { color: 'rgba(148, 163, 184, .16)' }, ticks: { color: '#7c8da5', font: { size: 8 }, callback: (value) => `${value - 100}%` } },
      },
    },
  })
}

watch(() => selectedStats.value.map((s) => s.scope.id).join(','), async () => {
  await nextTick()
  buildDetailChart()
})

onMounted(async () => {
  await nextTick()
  buildDetailChart()
})
onUnmounted(() => detailChart?.destroy())
</script>

<template>
  <section class="theme-analysis">
    <!-- กลุ่มที่ 1: หัวข้อหลัก (ซ้าย) + ปุ่มสรุป (ขวา) -->
    <header class="theme-analysis-heading-wrapper">
      <div class="theme-analysis-heading">
        <h2>ภาพรวมแนวโน้มธีมการลงทุน</h2>
        <p>ติดตามทิศทางและผลตอบแทนของธีมเด่น ก่อนเลือกเปรียบเทียบ Master Fund ในมุมมองเดียว</p>
      </div>
      
      <div class="theme-summary" aria-label="สรุปแนวโน้มธีม">
        <span>บวก 1Y <b>{{ positiveCount }}/{{ stats.length }}</b></span>
        <span>เร่งขึ้น <b>{{ acceleratingCount }}/{{ stats.length }}</b></span>
        <span>เหนือ Global <b>{{ outperformCount }}/{{ stats.length }}</b></span>
      </div>
    </header>

    <div class="theme-analysis-instruction">
      <div class="theme-instruction-text">
        <h2>ติดตามทิศทางและผลตอบแทนของธีมเด่น ก่อนเลือกเปรียบเทียบ Master Fund ในมุมมองเดียว <InfoTooltip text="เลือกได้สูงสุด 5 กลุ่มเพื่อเปรียบเทียบผลตอบแทนบนกราฟเดียวกัน จากนั้น Ranking หุ้นและรายชื่อกองทุนด้านล่างจะปรับตาม" /></h2>
      </div>

      <!-- 2. กลุ่มปุ่มสลับมุมมอง (รวมถึงคำว่า มุมมอง:) จะอยู่ฝั่งขวา -->
      <div class="theme-view-switch-container">
        <span class="theme-view-label">มุมมอง:</span>
        <div class="theme-view-switch">
          <button type="button" :class="{ active: state.view === 'interesting' }" @click="setView('interesting')">ธีมที่น่าจับตา</button>
          <button type="button" :class="{ active: state.view === 'all' }" @click="setView('all')">เลือกธีมเอง</button>
        </div>
      </div>
    </div>

<div class="theme-toolbar">
      <div>
        <b>เปรียบเทียบ Performance บนกราฟเดียวกัน <InfoTooltip text="ผลตอบแทนแบบฐาน 100 ย้อนหลัง 12 เดือน · เส้นประคือ MSCI ACWI" /></b>
      </div>
      
      <!-- ย้ายช่องค้นหามาไว้ที่นี่ จะแสดงและถูกดันชิดขวาเฉพาะในโหมดเลือกธีมเอง (state.view === 'all') -->
      <label v-if="state.view === 'all'" class="theme-search">
        <span>⌕</span>
        <input v-model="state.search" type="text" placeholder="ค้นหาธีม หรือ Master Fund ที่สนใจ" />
      </label>
    </div>

    <div class="theme-selector" :class="[state.view === 'all' ? 'mode-custom' : 'mode-interesting']">
      <!-- ส่วนแสดง Chips + ปุ่มล้างทั้งหมด (ในโหมดเลือกธีมเอง) -->
      <div class="theme-selection-wrapper">
        <div class="theme-chips-container">
          <span v-if="selectedStats.length" class="theme-selected-label">ธีมที่เลือก {{ selectedStats.length }}/5:</span>
          
          <div class="theme-chips">
            <button
              v-for="s in visibleStats"
              :key="s.scope.id"
              type="button"
              class="theme-chip"
              :class="{ selected: orderOf(s.scope.id) > -1 }"
              :style="orderOf(s.scope.id) > -1 ? { '--theme-color': COMPARE_COLORS[orderOf(s.scope.id) % COMPARE_COLORS.length] } : {}"
              :disabled="maxReached && orderOf(s.scope.id) === -1"
              @click="toggle(s.scope.id)"
            >
              <i v-if="orderOf(s.scope.id) > -1">{{ orderOf(s.scope.id) + 1 }}</i>
              {{ s.scope.title }}
              <span v-if="orderOf(s.scope.id) > -1">×</span>
            </button>
          </div>
          
          <!-- ปุ่มล้างทั้งหมด -->
          <button v-if="selectedStats.length" type="button" class="theme-clear-btn" @click="clear">ล้างทั้งหมด</button>
        </div>

        <!-- จุดอ้างอิง Benchmark -->
        <div v-if="selectedStats.length" class="theme-benchmark-text">
          <span class="dashed-line">------</span> <b>จุดอ้างอิง: {{ BENCH_LABEL }}</b> <span>Performance คำนวณจากตะกร้าหุ้นที่พบใน Top Holdings ไม่ใช่ดัชนีหมวดอย่างเป็นทางการ</span>
        </div>
      </div>
    </div>

    <div v-if="selectedStats.length" class="theme-chart-grid">
      <div class="theme-chart-panel"><canvas ref="detailCanvas" aria-label="กราฟเปรียบเทียบธีมกับ MSCI ACWI"></canvas></div>
      <aside class="industry-chart-list" :class="{ collapsed: !chartGroupsOpen }">
        <button type="button" class="industry-chart-list-toggle" :aria-expanded="chartGroupsOpen" @click="chartGroupsOpen = !chartGroupsOpen">
          <span><b>ธีมในกราฟ</b><small>เลือกเฉพาะธีมที่สนใจก่อนเจาะดู Master Fund</small></span>
          <i :class="{ open: chartGroupsOpen }">⌄</i>
        </button>
        <div v-show="chartGroupsOpen" class="industry-chart-list-scroll">
          <article v-for="(s, index) in selectedStats" :key="s.scope.id" :style="{ '--scope-color': COMPARE_COLORS[index % COMPARE_COLORS.length] }">
            <b><i></i>{{ index + 1 }}. {{ s.scope.title }}</b>
            <small>{{ s.fundCount }} กองทุน</small>
            <div>
              <span>1Y <strong :class="s.scope.perf >= 0 ? 'text-pos' : 'text-neg'">{{ s.scope.perf > 0 ? '+' : '' }}{{ s.scope.perf }}%</strong></span>
              <span>vs Global <strong :class="s.vsGlobal >= 0 ? 'text-pos' : 'text-neg'">{{ s.vsGlobal > 0 ? '+' : '' }}{{ s.vsGlobal }}%</strong></span>
              <span>เงินไหลเข้า <strong :class="s.flow >= 0 ? 'text-pos' : 'text-neg'">{{ s.flow > 0 ? '+' : '' }}฿{{ formatFlow(s.flow) }}</strong></span>
            </div>
          </article>
        </div>
      </aside>
    </div>
  </section>
</template>