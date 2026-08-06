<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Chart from 'chart.js/auto'
import { useFundinfoMarketLens } from '../../composables/useFundinfoMarketLens'
import { performanceSeries, CMP_LABELS, COMPARE_COLORS } from '../../composables/useFundinfoThemeTrend'

const props = defineProps({
  type: { type: String, default: 'mixed' },
})

const { scopes, state, leader, laggard, momentumTop, positiveCount, chartLines, chartTitle, bench, setScope, clearScope } =
  useFundinfoMarketLens(props.type)

/* ---------- กราฟภาพตลาด: 3 กลุ่มนำ + 2 กลุ่มตาม (หรือเจาะดูหมวดเดียว) ---------- */
const chartCanvas = ref(null)
let chartInstance = null

function buildChart() {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  if (!chartCanvas.value) return

  const lines = chartLines.value
  const sets = lines.map((s, i) => ({
    label: s.scope.title,
    scopeId: s.scope.id,
    data: s.data,
    borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
    backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
    borderWidth: state.scope ? 3 : 2.3,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.28,
    fill: false,
  }))
  sets.push({
    label: `${bench.name} · จุดอ้างอิง`,
    scopeId: null,
    data: performanceSeries(731, bench.ret, CMP_LABELS.length),
    borderColor: '#7b879d',
    backgroundColor: '#7b879d',
    borderWidth: 2,
    borderDash: [6, 4],
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.28,
    fill: false,
  })

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: { labels: CMP_LABELS, datasets: sets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      onClick: (ev) => {
        const pts = chartInstance.getElementsAtEventForMode(ev, 'nearest', { intersect: false }, true)
        const ds = pts.length && sets[pts[0].datasetIndex]
        if (ds && ds.scopeId) setScope(ds.scopeId)
      },
      plugins: {
        legend: {
          position: 'bottom',
          onClick: (ev, item) => {
            const ds = sets[item.datasetIndex]
            if (ds && ds.scopeId) setScope(ds.scopeId)
          },
          labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 20, font: { size: 9 }, padding: 10 },
        },
        tooltip: {
          callbacks: {
            title: (c) => c[0]?.label || '',
            label: (c) => ` ${c.dataset.label}: ${(c.parsed.y - 100).toFixed(1)}%`,
            afterBody: (c) => (c[0]?.dataset.scopeId ? 'คลิกกราฟเพื่อเจาะดูกลุ่มนี้' : ''),
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0, maxTicksLimit: 7 } },
        y: {
          ticks: { font: { size: 9 }, callback: (v) => `${v - 100}%` },
          grid: { color: 'rgba(148, 163, 184, .15)' },
        },
      },
    },
  })
}

watch(
  () => `${chartLines.value.map((s) => s.scope.id).join(',')}|${state.scope}`,
  async () => {
    await nextTick()
    buildChart()
  },
)

onMounted(async () => {
  await nextTick()
  buildChart()
})

onUnmounted(() => {
  if (chartInstance) chartInstance.destroy()
})
</script>

<template>
  <div>
    <div class="text-[11px] font-bold sub uppercase tracking-wide mb-1.5">① Market Lens · แนวโน้มสินทรัพย์</div>

    <div class="surf brd rounded-2xl cs p-4">
      <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 class="text-base font-extrabold txt">{{ chartTitle }}</h2>
          <p class="text-[11px] sub mt-0.5">
            แสดงทั้งด้านบวกและด้านลบของตลาดโดยจำกัดไม่เกิน 5 เส้น · คลิกสัญญาณ เส้น หรือปุ่ม เพื่อเจาะดูทีละกลุ่ม
          </p>
        </div>
        <span class="text-[10px] font-bold px-2.5 py-1 rounded-full surf2 brd whitespace-nowrap">
          ขอบเขต: {{ state.scope || 'ภาพรวมตลาด' }}
        </span>
      </div>

      <!-- Signal cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3">
        <button type="button" class="signal-card" :disabled="!leader" @click="leader && setScope(leader.scope.id)">
          <div class="text-[9px] sub font-bold">ผลตอบแทนสูงสุด 12 เดือน</div>
          <div class="text-xs font-extrabold truncate mt-0.5" style="color: #7a5af5" :title="leader?.scope.title">
            {{ leader?.scope.title || '—' }}
          </div>
          <div class="text-[8px] sub mt-0.5 truncate">
            {{ leader ? `${leader.scope.perf > 0 ? '+' : ''}${leader.scope.perf}% · คลิกเพื่อเจาะดู` : 'ไม่มีข้อมูล' }}
          </div>
        </button>
        <button type="button" class="signal-card" :disabled="!laggard" @click="laggard && setScope(laggard.scope.id)">
          <div class="text-[9px] sub font-bold">ผลตอบแทนต่ำสุด 12 เดือน</div>
          <div class="text-xs font-extrabold truncate mt-0.5 text-rose-500" :title="laggard?.scope.title">
            {{ laggard?.scope.title || '—' }}
          </div>
          <div class="text-[8px] sub mt-0.5 truncate">
            {{ laggard ? `${laggard.scope.perf > 0 ? '+' : ''}${laggard.scope.perf}% · ใช้เห็นอีกด้านของตลาด` : 'ไม่มีข้อมูล' }}
          </div>
        </button>
        <button type="button" class="signal-card" :disabled="!momentumTop" @click="momentumTop && setScope(momentumTop.scope.id)">
          <div class="text-[9px] sub font-bold">โมเมนตัม 3 เดือน</div>
          <div class="text-xs font-extrabold truncate mt-0.5" style="color: #7a5af5" :title="momentumTop?.scope.title">
            {{ momentumTop?.scope.title || '—' }}
          </div>
          <div class="text-[8px] sub mt-0.5 truncate">
            {{ momentumTop ? `${momentumTop.momentum > 0 ? '+' : ''}${momentumTop.momentum}% ใน 3 เดือนล่าสุด` : 'ไม่มีข้อมูล' }}
          </div>
        </button>
        <div class="signal-card">
          <div class="text-[9px] sub font-bold">กลุ่มที่เป็นบวก</div>
          <div class="text-xs font-extrabold truncate mt-0.5" style="color: #0e9f6e">{{ positiveCount }}/{{ scopes.length }} กลุ่ม</div>
          <div class="text-[8px] sub mt-0.5 truncate">ผลตอบแทน 12 เดือนมากกว่า 0%</div>
        </div>
      </div>

      <!-- จุดอ้างอิง -->
      <div class="chart-note rounded-lg px-3 py-2 mb-2 flex items-center gap-2 flex-wrap">
        <span class="w-6 border-t-2 border-dashed" style="border-color: #7b879d"></span>
        <b class="text-[10px] txt">จุดอ้างอิง: {{ bench.name }}</b>
        <span class="text-[9px] sub">ใช้ดูทิศทางโดยรวม ไม่ใช่ benchmark ทางการของทุกกองทุน</span>
      </div>

      <!-- กราฟ -->
      <div class="h-64 surf2 brd rounded-xl p-2 mb-2">
        <canvas ref="chartCanvas" :aria-label="`กราฟ${chartTitle}เทียบ${bench.name}`"></canvas>
      </div>

      <div class="flex items-center justify-between gap-2 mb-1">
        <span class="text-[9px] sub">เลือกสินทรัพย์อื่นเพื่อเจาะดูทีละกลุ่ม</span>
        <button v-if="state.scope" type="button" class="text-[9px] font-bold text-violet-600" @click="clearScope">
          กลับสู่ภาพรวมตลาด
        </button>
      </div>

      <!-- ชิปเลือกหมวด -->
      <div class="flex gap-1.5 overflow-x-auto pb-1">
        <button type="button" class="scope-chip" :class="{ on: !state.scope }" @click="clearScope">ภาพรวม</button>
        <button
          v-for="s in scopes"
          :key="s.id"
          type="button"
          class="scope-chip"
          :class="{ on: state.scope === s.id }"
          @click="setScope(s.id)"
        >
          {{ s.title }}
        </button>
      </div>
    </div>
  </div>
</template>