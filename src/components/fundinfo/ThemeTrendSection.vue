<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import {
  useFundinfoThemeTrend,
  themeStatus,
  formatFlow,
  performanceSeries,
  CMP_LABELS,
  COMPARE_COLORS,
  COMPARE_DASH,
} from '../../composables/useFundinfoThemeTrend'
import { formatPercent } from '../../utils/fundinfoFormat'

const props = defineProps({
  type: { type: String, default: 'feeder' },
})

const {
  stats,
  state,
  visibleStats,
  selectedStats,
  positiveCount,
  acceleratingCount,
  outperformCount,
  maxReached,
  maxSelected,
  orderOf,
  toggle,
  clear,
  setView,
} = useFundinfoThemeTrend(props.type)

// จุดอ้างอิงของกราฟเปรียบเทียบ (ตรงกับ trendBenchmark() ในต้นแบบสำหรับ Feeder/Offshore)
const GLOBAL_RETURN = 12.8
const BENCH_LABEL = 'MSCI ACWI'

/* ---------- Sparkline chart ต่อการ์ดธีมที่มองเห็น ---------- */
const sparkEls = {}
const sparkCharts = {}

function setSparkRef(id, el) {
  if (el) sparkEls[id] = el
  else delete sparkEls[id]
}

function destroySpark(id) {
  if (sparkCharts[id]) {
    sparkCharts[id].destroy()
    delete sparkCharts[id]
  }
}

function buildSparkCharts() {
  const visibleIds = new Set(visibleStats.value.map((s) => s.scope.id))
  Object.keys(sparkCharts).forEach((id) => {
    if (!visibleIds.has(id)) destroySpark(id)
  })
  visibleStats.value.forEach((s) => {
    const el = sparkEls[s.scope.id]
    if (!el) return
    destroySpark(s.scope.id)
    sparkCharts[s.scope.id] = new Chart(el, {
      type: 'line',
      data: {
        labels: CMP_LABELS,
        datasets: [
          {
            data: s.series,
            borderColor: s.sparkColor,
            backgroundColor: `${s.sparkColor}18`,
            borderWidth: 2.2,
            pointRadius: 0,
            tension: 0.32,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } },
      },
    })
  })
}

/* ---------- กราฟเปรียบเทียบธีมที่เลือกกับ MSCI ACWI ---------- */
const detailCanvas = ref(null)
let detailChart = null

function buildDetailChart() {
  if (detailChart) {
    detailChart.destroy()
    detailChart = null
  }
  if (!detailCanvas.value || !selectedStats.value.length) return

  const datasets = selectedStats.value.map((s, i) => ({
    label: `${i + 1}. ${s.scope.title}`,
    data: s.series,
    borderColor: COMPARE_COLORS[i],
    backgroundColor: COMPARE_COLORS[i],
    borderWidth: 2.7,
    borderDash: COMPARE_DASH[i],
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.3,
    fill: false,
  }))
  datasets.push({
    label: `${BENCH_LABEL} · จุดอ้างอิง`,
    data: performanceSeries(731, GLOBAL_RETURN, CMP_LABELS.length),
    borderColor: '#7b879d',
    backgroundColor: '#7b879d',
    borderWidth: 2,
    borderDash: [6, 4],
    pointRadius: 0,
    pointHoverRadius: 4,
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
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 22, font: { size: 9 } },
        },
        tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${(c.parsed.y - 100).toFixed(1)}%` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxTicksLimit: 7 } },
        y: {
          ticks: { font: { size: 9 }, callback: (v) => `${v - 100}%` },
          grid: { color: 'rgba(148, 163, 184, .15)' },
        },
      },
    },
  })
}

watch(
  () => visibleStats.value.map((s) => s.scope.id).join(','),
  async () => {
    await nextTick()
    buildSparkCharts()
  },
)
watch(
  () => selectedStats.value.map((s) => s.scope.id).join(','),
  async () => {
    await nextTick()
    buildDetailChart()
  },
)

onMounted(async () => {
  await nextTick()
  buildSparkCharts()
  buildDetailChart()
})

onUnmounted(() => {
  Object.keys(sparkCharts).forEach(destroySpark)
  if (detailChart) detailChart.destroy()
})
</script>

<template>
  <div>
    <div class="text-[11px] font-bold sub uppercase tracking-wide mb-1.5">① แนวโน้มธีมการลงทุน</div>

    <div class="surf brd rounded-2xl cs p-4">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 class="text-base font-extrabold txt">ภาพรวมแนวโน้มธีมการลงทุน</h2>
          <p class="text-[11px] sub mt-0.5">
            ติดตามทิศทางและผลตอบแทนของธีมเด่น ก่อนเลือกเปรียบเทียบ Master Fund ในมุมมองเดียว
          </p>
        </div>
        <div class="flex gap-1.5 flex-wrap text-[10px]">
          <span class="px-2.5 py-1 rounded-full surf2 brd txt">บวก 1Y <b class="num">{{ positiveCount }}/{{ stats.length }}</b></span>
          <span class="px-2.5 py-1 rounded-full surf2 brd txt">เร่งขึ้น <b class="num">{{ acceleratingCount }}/{{ stats.length }}</b></span>
          <span class="px-2.5 py-1 rounded-full surf2 brd txt">เหนือ Global <b class="num">{{ outperformCount }}/{{ stats.length }}</b></span>
        </div>
      </div>

      <!-- สลับมุมมอง: ธีมที่น่าจับตา (3 อันดับ) / เลือกธีมเอง (ค้นหาได้ทั้งหมด) -->
      <div class="inline-flex surf2 brd rounded-lg p-0.5 mb-3">
        <button
          type="button"
          class="px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors"
          :class="state.view === 'interesting' ? 'bg-blue-600 text-white' : 'sub'"
          @click="setView('interesting')"
        >
          ธีมที่น่าจับตา
        </button>
        <button
          type="button"
          class="px-3 py-1.5 rounded-md text-[11px] font-bold transition-colors"
          :class="state.view === 'all' ? 'bg-blue-600 text-white' : 'sub'"
          @click="setView('all')"
        >
          เลือกธีมเอง
        </button>
      </div>

      <div v-if="state.view === 'all'" class="flex items-center gap-2 mb-3">
        <div class="flex-1 flex items-center gap-2 surf2 brd rounded-lg px-3 py-2">
          <span class="sub text-sm">🔎</span>
          <input
            v-model="state.search"
            type="text"
            placeholder="ค้นหาธีมหรือ Master Fund ที่สนใจ"
            class="flex-1 bg-transparent outline-none text-xs txt"
          />
        </div>
        <span class="text-[10px] sub whitespace-nowrap">เลือกได้สูงสุด {{ maxSelected }} ธีม</span>
      </div>
      <p v-else class="text-[10px] sub mb-3">
        แสดง 3 ธีมที่มีโมเมนตัม 3 เดือนเด่นในข้อมูลตัวอย่าง ไม่ใช่คำแนะนำลงทุน
      </p>

      <!-- การ์ดธีม -->
      <div
        class="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5"
        :class="state.view === 'all' ? 'xl:grid-cols-5' : 'xl:grid-cols-3'"
      >
        <button
          v-for="s in visibleStats"
          :key="s.scope.id"
          type="button"
          class="theme-pulse-card"
          :class="[
            orderOf(s.scope.id) > -1 ? 'on' : '',
            maxReached && orderOf(s.scope.id) === -1 ? 'opacity-50' : '',
          ]"
          :aria-label="`${orderOf(s.scope.id) > -1 ? 'นำออก' : 'เลือก'}ธีม ${s.scope.title}`"
          @click="toggle(s.scope.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-[9px] sub font-bold">
                THEME<span v-if="orderOf(s.scope.id) > -1"> · เลือกลำดับ {{ orderOf(s.scope.id) + 1 }}</span>
              </div>
              <div class="text-xs font-extrabold txt truncate" :title="s.scope.title">{{ s.scope.title }}</div>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <span v-if="orderOf(s.scope.id) > -1" class="select-order">{{ orderOf(s.scope.id) + 1 }}</span>
              <span class="trend-status" :style="{ background: themeStatus(s).bg, color: themeStatus(s).color }">
                {{ themeStatus(s).label }}
              </span>
            </div>
          </div>

          <div class="h-16 mt-1">
            <canvas :ref="(el) => setSparkRef(s.scope.id, el)" :aria-label="`แนวโน้ม 1 ปี ${s.scope.title}`"></canvas>
          </div>
          <div class="text-[8px] font-bold mb-1" :style="{ color: s.sparkColor }">1YTD</div>

          <div class="grid grid-cols-3 gap-1.5 mb-2">
            <div class="metric-cell">
              <div class="text-[8px] sub">1M</div>
              <div class="text-[11px] font-bold" :class="s.m1 < 0 ? 'text-rose-500' : 'text-emerald-500'">
                {{ formatPercent(s.m1, 1) }}
              </div>
            </div>
            <div class="metric-cell">
              <div class="text-[8px] sub">3M</div>
              <div class="text-[11px] font-bold" :class="s.q1 < 0 ? 'text-rose-500' : 'text-emerald-500'">
                {{ formatPercent(s.q1, 1) }}
              </div>
            </div>
            <div class="metric-cell">
              <div class="text-[8px] sub">1Y</div>
              <div class="text-[11px] font-bold" :class="s.scope.perf < 0 ? 'text-rose-500' : 'text-emerald-500'">
                {{ formatPercent(s.scope.perf, 1) }}
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-2 text-[8px] sub text-left">
            <span>
              vs Global<br />
              <b class="num" :class="s.vsGlobal >= 0 ? 'text-emerald-500' : 'text-rose-500'">
                {{ s.vsGlobal > 0 ? '+' : '' }}{{ s.vsGlobal }}%
              </b>
            </span>
            <span>
              Fund Flow 1M<br />
              <b class="num txt">{{ s.flow > 0 ? '+' : '' }}฿{{ formatFlow(s.flow) }}</b>
            </span>
            <span>
              กองทุนไทย<br />
              <b class="num txt">{{ s.fundCount }} กอง</b>
            </span>
          </div>
        </button>
      </div>

      <!-- ชิปธีมที่เลือกไว้ -->
      <div v-if="selectedStats.length" class="flex items-center gap-1.5 flex-wrap mt-3">
        <span class="text-[9px] font-bold sub">ธีมที่เลือก {{ selectedStats.length }}/{{ maxSelected }}:</span>
        <button
          v-for="(s, i) in selectedStats"
          :key="s.scope.id"
          type="button"
          class="scope-chip on"
          :style="{ background: COMPARE_COLORS[i], borderColor: COMPARE_COLORS[i] }"
          @click="toggle(s.scope.id)"
        >
          {{ i + 1 }}. {{ s.scope.title }} ✕
        </button>
        <button type="button" class="text-[9px] font-bold px-2 py-1 sub" @click="clear">ล้างทั้งหมด</button>
      </div>

      <!-- กราฟเปรียบเทียบธีมที่เลือก -->
      <div v-if="selectedStats.length" class="mt-3 pt-3 brdt slide">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div>
            <b class="text-xs txt">เปรียบเทียบ {{ selectedStats.length }} ธีมบนกราฟเดียวกัน</b>
            <div class="text-[9px] sub">สีประจำธีมเริ่มใช้ในกราฟนี้ เพื่อแยกเส้นตามลำดับที่เลือก</div>
          </div>
          <button type="button" class="text-[9px] font-bold px-2.5 py-1 rounded-lg surf2 brd" @click="clear">
            ล้างกราฟ ✕
          </button>
        </div>
        <div class="grid lg:grid-cols-[minmax(0,2fr)_minmax(260px,.75fr)] gap-3">
          <div class="h-72 surf2 brd rounded-xl p-2">
            <canvas ref="detailCanvas" :aria-label="`กราฟเปรียบเทียบธีมที่เลือกกับ ${BENCH_LABEL}`"></canvas>
          </div>
          <div class="surf2 brd rounded-xl p-3">
            <div class="text-[10px] font-bold txt mb-2">ธีมในกราฟ</div>
            <div class="space-y-2">
              <div v-for="(s, i) in selectedStats" :key="s.scope.id" class="surf brd rounded-lg p-2">
                <div class="flex items-center gap-1.5">
                  <span class="w-3 h-1 rounded-full" :style="{ background: COMPARE_COLORS[i] }"></span>
                  <b class="text-[9px] txt truncate">{{ i + 1 }}. {{ s.scope.title }}</b>
                </div>
                <div class="grid grid-cols-3 gap-1 text-[8px] sub mt-1">
                  <span>3M <b class="num txt">{{ s.q1 > 0 ? '+' : '' }}{{ s.q1 }}%</b></span>
                  <span>1Y <b class="num txt">{{ s.scope.perf > 0 ? '+' : '' }}{{ s.scope.perf }}%</b></span>
                  <span>vs Global <b class="num txt">{{ s.vsGlobal > 0 ? '+' : '' }}{{ s.vsGlobal }}%</b></span>
                </div>
              </div>
            </div>
            <div class="text-[8px] sub mt-2 pt-2 brdt">เปรียบเทียบทิศทาง ไม่ใช่สัญญาณซื้อขาย</div>
          </div>
        </div>
      </div>
      <div v-else class="mt-3 rounded-lg surf2 brd px-3 py-2 text-[9px] sub">
        เลือกได้หลายธีมจากการ์ดด้านบน แล้วระบบจะแสดงทุกธีมบนกราฟเดียวกันพร้อม MSCI ACWI
      </div>
    </div>
  </div>
</template>