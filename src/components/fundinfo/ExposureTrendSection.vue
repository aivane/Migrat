<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { useFundinfoExposureTrend, holdingIcon, trendSeries } from '../../composables/useFundinfoExposureTrend'
import { performanceSeries, CMP_LABELS, COMPARE_COLORS, COMPARE_DASH } from '../../composables/useFundinfoThemeTrend'

const props = defineProps({ type: { type: String, default: 'offshore' } })

const {
  foreign,
  bench,
  label,
  method,
  example,
  state,
  scopes,
  maxExposure,
  mostHeld,
  topExposure,
  leaderPerf,
  outperformCount,
  selectedStats,
  maxSelected,
  orderOf,
  toggle,
  clear,
  setScopeMode,
} = useFundinfoExposureTrend(props.type)

const detailCanvas = ref(null)
const chartGroupsOpen = ref(true)
const scopePickerOpen = ref(false)
const availableScopes = computed(() => scopes.value.filter((scope) => orderOf(scope.id) === -1))
let detailChart = null

function scopeColor(index) {
  return COMPARE_COLORS[index % COMPARE_COLORS.length]
}

function selectionColor(scope) {
  const order = orderOf(scope.id)
  return scopeColor(order > -1 ? order : scope.idx)
}

function signed(value) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function performanceClass(value) {
  return value >= 0 ? 'is-positive' : 'is-negative'
}

function addScope(id) {
  toggle(id)
  if (selectedStats.value.length >= maxSelected) scopePickerOpen.value = false
}

function buildDetailChart() {
  if (detailChart) {
    detailChart.destroy()
    detailChart = null
  }
  if (!detailCanvas.value || !selectedStats.value.length) return

  const datasets = selectedStats.value.map((scope, index) => ({
    label: `${index + 1}. ${scope.title}`,
    data: trendSeries(scope),
    borderColor: scopeColor(index),
    backgroundColor: scopeColor(index),
    borderWidth: 2.2,
    borderDash: COMPARE_DASH[index] || [],
    pointRadius: 0,
    pointHoverRadius: 3,
    tension: 0.35,
    fill: false,
  }))

  datasets.push({
    label: `${bench.name} · จุดอ้างอิง`,
    data: performanceSeries(731, bench.ret, CMP_LABELS.length),
    borderColor: '#9aa9bd',
    backgroundColor: '#9aa9bd',
    borderWidth: 1.6,
    borderDash: [4, 3],
    pointRadius: 0,
    tension: 0.35,
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
          labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 17, padding: 10, font: { size: 8, weight: '600' } },
        },
        tooltip: {
          callbacks: { label: (item) => ` ${item.dataset.label}: ${(item.parsed.y - 100).toFixed(1)}%` },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7c8da5', font: { size: 8 } } },
        y: {
          grid: { color: 'rgba(148, 163, 184, .14)' },
          ticks: { color: '#7c8da5', font: { size: 8 }, callback: (value) => `${value - 100}%` },
        },
      },
    },
  })
}

watch(
  () => `${state.scopeMode}:${selectedStats.value.map((scope) => scope.id).join(',')}`,
  async () => {
    await nextTick()
    buildDetailChart()
  },
)

onMounted(async () => {
  await nextTick()
  buildDetailChart()
})

onUnmounted(() => detailChart?.destroy())
</script>

<template>
  <section class="industry-analysis">
    <div class="industry-eyebrow">ⓘ วิเคราะห์กลุ่มจาก PERFORMANCE และการถือหุ้น · {{ label }}</div>

    <div class="industry-workspace">
      <header class="industry-header">
        <div>
          <h2>เปรียบเทียบ {{ label }} ก่อนเจาะดูหุ้นที่กองทุนถือ</h2>
          <p>เลือกได้สูงสุด {{ maxSelected }} กลุ่มเพื่อดู Performance บนกราฟเดียวกัน และเรียงผลการจัดอันดับด้านล่าง</p>
        </div>
        <div v-if="foreign" class="industry-switcher" aria-label="มุมมองการวิเคราะห์">
          <span>มุมมอง:</span>
          <button type="button" :class="{ active: state.scopeMode === 'region' }" @click="setScopeMode('region')">ภูมิภาคและประเทศ</button>
          <button type="button" :class="{ active: state.scopeMode === 'theme' }" @click="setScopeMode('theme')">เทรนด์และอุตสาหกรรม</button>
        </div>
      </header>

      <div class="industry-kpis">
        <button type="button" @click="leaderPerf && toggle(leaderPerf.id)">
          <span>ผลตอบแทนสูงสุด 1 ปี</span>
          <strong class="kpi-blue">{{ leaderPerf?.title || '-' }}</strong>
          <small>{{ leaderPerf ? signed(leaderPerf.perf) : '-' }} · คลิกเพื่อเพิ่มลงกราฟ</small>
        </button>
        <div>
          <span>สูงกว่า Global</span>
          <strong class="kpi-green">{{ outperformCount }}/{{ scopes.length }} กลุ่ม</strong>
          <small>ผลตอบแทน 1 ปีมากกว่า {{ bench.name }}</small>
        </div>
        <button type="button" @click="topExposure && toggle(topExposure.id)">
          <span>กลุ่มที่ให้น้ำหนักมากสุด</span>
          <strong class="kpi-violet">{{ topExposure?.title || '-' }}</strong>
          <small>{{ topExposure ? `${topExposure.exposure.toFixed(1)}% จากหุ้นหลัก` : '-' }}</small>
        </button>
        <div>
          <span>หุ้นที่หลายกองถือร่วมกัน</span>
          <strong class="kpi-amber">{{ mostHeld?.ticker || '-' }}</strong>
          <small>{{ mostHeld ? `พบ ${mostHeld.fundCount} กอง · น้ำหนักรวม ${mostHeld.totalWeight}%` : '-' }}</small>
        </div>
      </div>

      <div class="industry-method">
        <b>วิธีคำนวณ</b>
        <span>{{ method }} · {{ example }}</span>
      </div>

      <div class="industry-cards">
        <button
          v-for="scope in scopes"
          :key="scope.id"
          type="button"
          class="industry-card"
          :class="{ selected: orderOf(scope.id) > -1 }"
          :style="{ '--scope-color': selectionColor(scope) }"
          @click="toggle(scope.id)"
        >
          <div class="industry-card-title">
            <span class="industry-card-icon">{{ holdingIcon(scope.title) }}</span>
            <div>
              <small>{{ scope.subtitle }}</small>
              <h3>{{ scope.title }}</h3>
              <p>{{ scope.stockCount }} หุ้น · พบใน {{ scope.members.length }} กองทุน</p>
            </div>
            <span v-if="orderOf(scope.id) > -1" class="industry-order">{{ orderOf(scope.id) + 1 }}</span>
          </div>
          <div class="industry-card-metrics">
            <div><small>ผลตอบแทน 1Y</small><b :class="performanceClass(scope.perf)">{{ signed(scope.perf) }}</b></div>
            <div><small>เทียบ Global</small><b :class="performanceClass(scope.perf - bench.ret)">{{ signed(scope.perf - bench.ret) }}</b></div>
          </div>
          <div class="industry-weight"><span>น้ำหนักรวม</span><strong>{{ scope.exposure.toFixed(1) }}%</strong><em>เลือกแล้ว · กดเพื่อยกเลิก</em></div>
          <div class="industry-progress"><i :style="{ width: `${Math.min(100, Math.max(8, (scope.exposure / maxExposure) * 100))}%` }"></i></div>
        </button>
      </div>

      <div class="industry-taxonomy-note">⌄ หมวดใน taxonomy ที่ยังไม่มีข้อมูลจะไม่แสดงในรายการนี้</div>

      <div class="industry-selection-row">
        <span>กลุ่มที่เลือก {{ selectedStats.length }}/{{ maxSelected }}</span>
        <button
          v-for="(scope, index) in selectedStats"
          :key="scope.id"
          type="button"
          class="industry-chip"
          :style="{ '--chip-color': scopeColor(index) }"
          @click="toggle(scope.id)"
        >{{ index + 1 }}. {{ scope.title }} <b>×</b></button>
        <button v-if="selectedStats.length" type="button" class="industry-clear" @click="clear">ล้างทั้งหมด</button>
        <button
          v-if="availableScopes.length && selectedStats.length < maxSelected"
          type="button"
          class="industry-add-scope"
          :aria-expanded="scopePickerOpen"
          @click="scopePickerOpen = !scopePickerOpen"
        >+ เพิ่มกลุ่ม</button>
        <div v-if="scopePickerOpen" class="industry-scope-picker">
          <span>เลือกเพิ่มได้อีก {{ maxSelected - selectedStats.length }} กลุ่ม</span>
          <button
            v-for="scope in availableScopes"
            :key="scope.id"
            type="button"
            class="industry-scope-option"
            @click="addScope(scope.id)"
          >+ {{ scope.title }}</button>
        </div>
      </div>

      <div v-if="selectedStats.length" class="industry-compare">
        <div class="industry-chart-panel">
          <div class="industry-chart-title"><b>เปรียบเทียบ Performance 5 กลุ่มการลงทุนพร้อมกัน</b><span>ผลตอบแทนฐาน 100 ย้อนหลัง 12 เดือน · เทียบกับ {{ bench.name }}</span></div>
          <div class="industry-benchmark"><i></i><b>จุดอ้างอิง: {{ bench.name }}</b><span>Performance คำนวณจากหุ้น Top Holdings ไม่ใช่ผลตอบแทนกองทุนโดยตรง</span></div>
          <div class="industry-chart"><canvas ref="detailCanvas"></canvas></div>
        </div>
        <aside class="industry-chart-list" :class="{ collapsed: !chartGroupsOpen }">
          <button type="button" class="industry-chart-list-toggle" :aria-expanded="chartGroupsOpen" @click="chartGroupsOpen = !chartGroupsOpen">
            <span><b>กลุ่มในกราฟ</b><small>เลือกเฉพาะกลุ่มที่สนใจก่อนเจาะดูหุ้นและกองทุน</small></span>
            <i :class="{ open: chartGroupsOpen }">⌄</i>
          </button>
          <div v-show="chartGroupsOpen" class="industry-chart-list-scroll">
            <article v-for="(scope, index) in selectedStats" :key="scope.id" :style="{ '--scope-color': scopeColor(index) }">
              <b><i></i>{{ index + 1 }}. {{ scope.title }}</b>
              <small>{{ scope.subtitle }}</small>
              <div><span>1Y <strong :class="performanceClass(scope.perf)">{{ signed(scope.perf) }}</strong></span><span>vs Global <strong :class="performanceClass(scope.perf - bench.ret)">{{ signed(scope.perf - bench.ret) }}</strong></span><span>น้ำหนัก <strong>{{ scope.exposure.toFixed(1) }}%</strong></span></div>
            </article>
          </div>
        </aside>
      </div>
    </div>
  </section>
</template>
