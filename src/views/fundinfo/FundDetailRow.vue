<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  fund: { type: Object, required: true },
  colspan: { type: Number, default: 6 },
})

const cyChartRef = ref(null)
const assetChartRef = ref(null)

let cyChartInstance = null
let assetChartInstance = null

function renderCharts() {
  if (cyChartInstance) cyChartInstance.destroy()
  if (assetChartInstance) assetChartInstance.destroy()

  // 1. Calendar Year Return Chart
  if (cyChartRef.value) {
    const cyrData = props.fund.cyr || { '2020': 18.5, '2021': 12.4, '2022': -15.2, '2023': 22.1, '2024': 14.8 }
    const labels = Object.keys(cyrData)
    const data = Object.values(cyrData)
    const backgroundColors = data.map((v) => (v >= 0 ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)'))

    cyChartInstance = new Chart(cyChartRef.value, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'ผลตอบแทน (%)',
          data,
          backgroundColor: backgroundColors,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw >= 0 ? '+' : ''}${ctx.raw}%` } },
        },
        scales: {
          y: {
            ticks: { callback: (v) => `${v}%`, font: { family: 'Inter', size: 10 } },
            grid: { color: 'rgba(150, 150, 150, 0.15)' }, // ปรับสีเส้นกริดให้เข้าได้กับทั้ง 2 Mode
          },
          x: {
            ticks: { font: { family: 'Inter', size: 10 } },
            grid: { display: false },
          },
        },
      },
    })
  }

  // 2. Asset Allocation Chart
  const mixData = props.fund.mix || props.fund.asset || []
  if (assetChartRef.value && mixData.length) {
    assetChartInstance = new Chart(assetChartRef.value, {
      type: 'doughnut',
      data: {
        labels: mixData.map((i) => i.name),
        datasets: [{
          data: mixData.map((i) => i.percent),
          backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'],
          borderWidth: 0, // ลบ border สีขาวออกเพื่อให้ไม่ลอยใน Dark Mode
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { font: { family: 'Prompt', size: 11 }, boxWidth: 12 },
          },
          tooltip: {
            callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}%` },
          },
        },
        cutout: '65%',
      },
    })
  }
}

onMounted(() => renderCharts())
watch(() => props.fund, () => renderCharts(), { deep: true })
onUnmounted(() => {
  if (cyChartInstance) cyChartInstance.destroy()
  if (assetChartInstance) assetChartInstance.destroy()
})
</script>

<template>
  <tr class="surf2 border-b-2 border-[var(--border)]">
    <td :colspan="colspan" class="p-4 md:p-6">
      <div class="space-y-6 txt font-['Prompt']">
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="surf brd p-4 rounded-2xl shadow-sm">
            <div class="flex items-center justify-between mb-3 border-b brdb pb-2">
              <span class="text-xs font-bold sub uppercase tracking-wider">ผลตอบแทนรายปี (Calendar Year Return)</span>
              <span class="text-[11px] sub font-['Inter']">ย้อนหลัง 5 ปี</span>
            </div>
            <div class="h-44 relative">
              <canvas ref="cyChartRef"></canvas>
            </div>
          </div>

          <div class="surf brd p-4 rounded-2xl shadow-sm">
            <div class="flex items-center justify-between mb-3 border-b brdb pb-2">
              <span class="text-xs font-bold sub uppercase tracking-wider">สัดส่วนสินทรัพย์ / โครงสร้างพอร์ต</span>
            </div>
            <div class="h-44 relative">
              <canvas ref="assetChartRef"></canvas>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div class="surf brd p-4 rounded-2xl shadow-sm">
            <h3 class="text-xs font-bold sub uppercase tracking-wider mb-3 border-b brdb pb-2">
              Top 5 Holdings
            </h3>
            <ul class="space-y-2.5">
              <li v-for="item in fund.top5" :key="item.name" class="flex items-center justify-between text-xs">
                <span class="txt truncate max-w-[160px]">{{ item.name }}</span>
                <div class="flex items-center gap-2">
                  <div class="w-16 surf2 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-[var(--brand)] h-full rounded-full" :style="{ width: `${Math.min(item.percent * 3, 100)}%` }"></div>
                  </div>
                  <strong class="font-['Inter'] txt w-10 text-right">{{ item.percent.toFixed(1) }}%</strong>
                </div>
              </li>
            </ul>
          </div>

          <div class="surf brd p-4 rounded-2xl shadow-sm">
            <h3 class="text-xs font-bold sub uppercase tracking-wider mb-3 border-b brdb pb-2">
              ข้อมูลสำคัญ (Key Metrics)
            </h3>
            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span class="sub block text-[11px]">Sharpe Ratio</span>
                <strong class="font-['Inter'] txt text-sm">{{ fund.sharpe || '1.12' }}</strong>
              </div>
              <div>
                <span class="sub block text-[11px]">Max Drawdown</span>
                <strong class="font-['Inter'] text-neg text-sm">{{ fund.drawdown || '-14.2%' }}</strong>
              </div>
              <div>
                <span class="sub block text-[11px]">นโยบายปันผล</span>
                <span class="txt font-semibold">{{ fund.div > 0 ? `จ่าย (${fund.div}%)` : 'ไม่จ่าย' }}</span>
              </div>
              <div>
                <span class="sub block text-[11px]">FX Hedging</span>
                <span class="txt font-semibold">{{ fund.fx || 'ตามดุลยพินิจ' }}</span>
              </div>
            </div>
          </div>

          <div class="surf brd p-4 rounded-2xl shadow-sm flex flex-col justify-between">
            <div>
              <h3 class="text-xs font-bold sub uppercase tracking-wider mb-3 border-b brdb pb-2">
                ธีมการลงทุน & ข้อมูลเพิ่มเติม
              </h3>
              <div class="flex flex-wrap gap-1.5 mb-4">
                <span v-for="theme in fund.themes" :key="theme" class="px-2.5 py-1 bg-[var(--brand-light)] text-[var(--brand)] border border-[var(--brand)]/20 rounded-full text-[11px] font-medium">
                  #{{ theme }}
                </span>
              </div>
            </div>
            <div v-if="fund.master" class="text-xs pt-3 border-t brdt">
              <span class="sub block">Master Fund:</span>
              <span class="font-semibold txt">{{ fund.master }} ({{ fund.country }})</span>
            </div>
          </div>

        </div>

      </div>
    </td>
  </tr>
</template>