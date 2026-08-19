<!-- ExposureTrendSection.vue -->
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import Chart from 'chart.js/auto'
import { useFundinfoExposureTrend, holdingIcon, trendSeries } from '../../composables/useFundinfoExposureTrend'
import { performanceSeries, CMP_LABELS, COMPARE_COLORS, COMPARE_DASH } from '../../composables/useFundinfoThemeTrend'
import InfoTooltip from '../common/InfoTooltip.vue'

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
let detailChart = null

const sortedScopes = computed(() => {
  return [...scopes.value].sort((a, b) => {
    const orderA = orderOf(a.id)
    const orderB = orderOf(b.id)
    if (orderA > -1 && orderB > -1) return orderA - orderB
    if (orderA > -1) return -1
    if (orderB > -1) return 1
    return 0
  })
})

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
          display: true,
          position: 'bottom',
          labels: { usePointStyle: true, pointStyle: 'line', boxWidth: 28, padding: 16, font: { size: 12, weight: '600' } },
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

watch(
  () => state.scopeMode,
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
    <h2 class="industry-main-title">
      วิเคราะห์กลุ่มจาก PERFORMANCE และการถือหุ้น · {{ label }}
    </h2>

    <div class="industry-workspace">
      <header class="industry-header">
        <div>
          <h2>เปรียบเทียบ {{ label }} ก่อนเจาะดูหุ้นที่กองทุนถือ <InfoTooltip :text="`เลือกได้สูงสุด ${maxSelected} กลุ่มเพื่อดู Performance บนกราฟเดียวกัน และเรียงผลการจัดอันดับด้านล่าง`" /></h2>
        </div>

        <div v-if="foreign" class="theme-view-switch-container" aria-label="มุมมองการวิเคราะห์">
          <span class="theme-view-label">มุมมอง:</span>
          <div class="theme-view-switch">
            <button type="button" :class="{ active: state.scopeMode === 'region' }" @click="setScopeMode('region')">ภูมิภาคและประเทศ</button>
            <button type="button" :class="{ active: state.scopeMode === 'theme' }" @click="setScopeMode('theme')">เทรนด์และอุตสาหกรรม</button>
          </div>
        </div>

        <span v-else class="market-lens-scope-badge">
          มาตรฐาน SET · {{ scopes.length }} Industry Groups
        </span>
      </header>

      <div class="industry-kpis">
        <button type="button" :disabled="!leaderPerf" @click="leaderPerf && toggle(leaderPerf.id)">
          <span>ผลตอบแทนสูงสุด 1 ปี</span>
          <strong class="kpi-blue">{{ leaderPerf?.title || '-' }}</strong>
          <small>{{ leaderPerf ? `${signed(leaderPerf.perf)} · คลิกเพื่อเพิ่มลงกราฟ` : `ยังไม่มีข้อมูลใน${label}` }}</small>
        </button>
        <div>
          <span>สูงกว่า Global</span>
          <strong class="kpi-green">{{ outperformCount }}/{{ scopes.length }} กลุ่ม</strong>
          <small>ผลตอบแทน 1 ปีมากกว่า {{ bench.name }}</small>
        </div>
        <button type="button" :disabled="!topExposure" @click="topExposure && toggle(topExposure.id)">
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

      <div class="industry-cards">
        <button
          v-for="scope in scopes"
          :key="`${state.scopeMode}-${scope.id}`"
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

      <!-- ส่วนแสดงผล Panel กราฟเปรียบเทียบ -->
      <div class="industry-compare">
        
        <div class="industry-chart-panel" style="display: flex; flex-direction: column; align-items: flex-start; width: 100%;">
          
          <!-- 1. หัวข้อกราฟ (ชิดซ้ายสุด) -->
          <div class="industry-chart-title" style="width: 100%; text-align: left; margin-bottom: 12px;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              <b style="font-size: 14px; font-weight: 800; color: #64748b;">เปรียบเทียบ Performance บนกราฟเดียวกัน</b>
              <InfoTooltip :text="`ผลตอบแทนแบบฐาน 100 ย้อนหลัง 12 เดือน · เส้นประคือ ${bench.name}`" />
            </div>
          </div>

          <!-- 2. แถบเลือกกลุ่ม Chips (ชิดซ้ายสุด เรียงบรรทัดเดียวกันแบบภาพ 2) -->
          <div class="industry-selection-row" style="width: 100%; display: flex; align-items: center; justify-content: flex-start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px;">
            <span style="font-size: 12px; font-weight: 700; color: var(--sub); white-space: nowrap;">กลุ่มที่เลือก {{ selectedStats.length }}/{{ maxSelected }}:</span>
            
            <div class="theme-chips" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
              <button
                v-for="scope in sortedScopes"
                :key="`${state.scopeMode}-opt-${scope.id}`"
                type="button"
                class="theme-chip"
                :class="{ selected: orderOf(scope.id) > -1 }"
                :style="orderOf(scope.id) > -1 ? { '--theme-color': scopeColor(orderOf(scope.id)) } : {}"
                :aria-pressed="orderOf(scope.id) > -1"
                :disabled="orderOf(scope.id) === -1 && selectedStats.length >= maxSelected"
                :title="orderOf(scope.id) > -1 ? 'เอาออกจากกราฟ' : selectedStats.length < maxSelected ? 'เพิ่มในกราฟ' : `เลือกได้สูงสุด ${maxSelected} กลุ่ม`"
                @click="toggle(scope.id)"
              >
                <i v-if="orderOf(scope.id) > -1">{{ orderOf(scope.id) + 1 }}. </i>
                {{ scope.title }}
                <span v-if="orderOf(scope.id) > -1" style="margin-left: 4px;">✕</span>
              </button>

              <button
                v-if="selectedStats.length"
                type="button"
                class="industry-clear"
                @click="clear"
                style="font-size: 12px; font-weight: 700; color: var(--txt); cursor: pointer; background: none; border: none; white-space: nowrap;"
                >
                ล้างทั้งหมด
              </button>
            </div>
          </div>

          <!-- 3. แถบจุดอ้างอิง Benchmark (ชิดซ้ายสุด) -->
          <div class="industry-benchmark" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px; font-size: 12px; text-align: center;">
            <span class="dashed-line" style="color: #9aa9bd; font-weight: bold;">------</span>
            <b>จุดอ้างอิง: {{ bench.name }}</b>
            <span style="color: var(--sub);">Performance คำนวณจากตะกร้าหุ้นที่พบใน Top Holdings ไม่ใช่ดัชนีหมวดอย่างเป็นทางการ</span>
          </div>

          <!-- 4. ส่วนกราฟ + รายชื่อกลุ่ม (วางขนานกันในบรรทัดนี้เพื่อให้อยู่ชิดกัน) -->
          <div class="industry-chart-with-list-wrapper">
            <!-- พื้นที่วาดกราฟ -->
            <div class="industry-chart" style="width: 100%; position: relative; min-height: 300px;">
              <canvas ref="detailCanvas" v-show="selectedStats.length"></canvas>
              <div v-if="!selectedStats.length" style="display: flex; align-items: center; justify-content: center; height: 190px; color: var(--sub); font-size: 13px; font-weight: 600;">
                กรุณาเลือกกลุ่มด้านบนอย่างน้อย 1 กลุ่มเพื่อแสดงกราฟเปรียบเทียบ
              </div>
            </div>

            <!-- ฝั่งขวา: Sidebar รายชื่อกลุ่มในกราฟ -->
            <aside v-if="selectedStats.length" class="industry-chart-list" :class="{ collapsed: !chartGroupsOpen }">
              <button type="button" class="industry-chart-list-toggle" :aria-expanded="chartGroupsOpen" @click="chartGroupsOpen = !chartGroupsOpen">
                <span><b>กลุ่มในกราฟ</b><small>เลือกเฉพาะกลุ่มที่สนใจก่อนเจาะดูหุ้นและกองทุน</small></span>
                <i :class="{ open: chartGroupsOpen }">⌄</i>
              </button>
              <div v-show="chartGroupsOpen" class="industry-chart-list-scroll">
                <article v-for="(scope, index) in selectedStats" :key="scope.id" :style="{ '--scope-color': scopeColor(index) }">
                  <b><i></i>{{ index + 1 }}. {{ scope.title }}</b>
                  <small>{{ scope.subtitle }}</small>
                  <div>
                    <span>1Y <strong :class="performanceClass(scope.perf)">{{ signed(scope.perf) }}</strong></span>
                    <span>vs Global <strong :class="performanceClass(scope.perf - bench.ret)">{{ signed(scope.perf - bench.ret) }}</strong></span>
                    <span>น้ำหนัก <strong>{{ scope.exposure.toFixed(1) }}%</strong></span>
                  </div>
                </article>
              </div>
            </aside>
          </div>

        </div>

      </div>
    </div>
  </section>
</template>