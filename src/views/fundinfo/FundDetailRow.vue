<script setup>
import { computed, ref, onMounted, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import Chart from 'chart.js/auto'

const props = defineProps({
  fund: { type: Object, required: true },
  colspan: { type: Number, default: 12 },
  inCompare: { type: Boolean, default: false },
})
const emit = defineEmits(['compare'])
const router = useRouter()
const cyChartRef = ref(null)
let cyChartInstance = null

const allocation = computed(() => props.fund.sectorMix || props.fund.mix || props.fund.asset || [])
const allocationMax = computed(() => Math.max(...allocation.value.map((item) => Number(item.percent) || 0), 1))
const topHoldings = computed(() => (props.fund.top5 || []).slice(0, 5))
const holdingMax = computed(() => Math.max(...topHoldings.value.map((item) => Number(item.percent) || 0), 1))

function goToDetail() {
  router.push({ name: 'fundinfo-detail', params: { id: props.fund.id } })
}

function renderChart() {
  cyChartInstance?.destroy()
  if (!cyChartRef.value) return
  const data = props.fund.cyr || { '2564': 18.5, '2565': 12.4, '2566': -15.2, '2567': 22.1, '2568': 14.8 }
  const values = Object.values(data)
  cyChartInstance = new Chart(cyChartRef.value, {
    type: 'bar',
    data: { labels: Object.keys(data), datasets: [{ data: values, backgroundColor: values.map((value) => value >= 0 ? '#12b76a' : '#f04438'), borderRadius: 3, borderSkipped: false }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw >= 0 ? '+' : ''}${ctx.raw}%` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#7c8da5', font: { size: 11 } } },
        y: { grid: { color: 'rgba(148, 163, 184, .16)' }, ticks: { color: '#7c8da5', font: { size: 11 }, callback: (value) => `${value}%` } },
      },
    },
  })
}

onMounted(renderChart)
watch(() => props.fund, renderChart, { deep: true })
onUnmounted(() => cyChartInstance?.destroy())
</script>

<template>
  <tr class="fund-detail-row">
    <td :colspan="colspan">
      <div class="fund-detail-grid">
        <section class="fund-detail-panel">
          <h3>Calendar Year Returns <small>(ผลตอบแทนรายปี)</small></h3>
          <div class="fund-detail-chart"><canvas ref="cyChartRef"></canvas></div>
        </section>
        <section class="fund-detail-panel">
          <h3>สัดส่วนอุตสาหกรรม <small>(Sector)</small></h3>
          <div class="fund-detail-bars">
            <div v-for="item in allocation.slice(0, 5)" :key="item.name" class="fund-detail-bar"><span>{{ item.name }}</span><i><b :style="{ width: `${(item.percent / allocationMax) * 100}%` }"></b></i><strong>{{ item.percent }}%</strong></div>
          </div>
        </section>
        <section class="fund-detail-panel fund-detail-holdings">
          <h3>Top 5 Holdings <small>(ที่ถือมากที่สุด)</small></h3>
          <div class="fund-detail-bars">
            <div v-for="item in topHoldings" :key="item.name" class="fund-detail-bar"><span>{{ item.name }}</span><i><b :style="{ width: `${(item.percent / holdingMax) * 100}%` }"></b></i><strong>{{ item.percent.toFixed(1) }}%</strong></div>
          </div>
          <div class="fund-detail-actions">
  <button type="button" class="fund-detail-compare" :class="{ active: inCompare }" @click="emit('compare')">{{ inCompare ? '✓ อยู่ในเปรียบเทียบ' : '+ เพิ่มเปรียบเทียบ' }}</button>
  <button type="button" class="fund-detail-more" @click="goToDetail">ดูข้อมูลเพิ่มเติม</button>
</div>
        </section>
      </div>
    </td>
  </tr>
</template>