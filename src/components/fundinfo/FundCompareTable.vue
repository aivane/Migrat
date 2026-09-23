<script setup>
import { ref } from 'vue'
import { COMPARE_COLORS } from '../../composables/useFundinfoInsight'
import { formatAumMThb, formatPercent } from '../../utils/fundinfoFormat'

const props = defineProps({
  selectedFunds: { type: Array, default: () => [] },
})

defineEmits(['clear-all', 'remove-fund'])

const collapsed = ref(false)

// สีประจำแต่ละกองทุนที่เลือก (ตามลำดับที่เลือก) — ให้แยกคอลัมน์ในตารางเปรียบเทียบ
// ออกจากกันชัดเจนด้วยสี ไม่ใช่แค่เส้นแบ่งบางๆ เหมือนเดิม
function colorFor(fund) {
  const index = props.selectedFunds.findIndex((f) => f.id === fund.id)
  return COMPARE_COLORS[index % COMPARE_COLORS.length]
}
function headerStyle(fund) {
  return {
    width: `calc((100% - 130px) / ${props.selectedFunds.length})`,
    borderTop: `3px solid ${colorFor(fund)}`,
    background: `${colorFor(fund)}14`,
  }
}
function cellStyle(fund) {
  return { background: `${colorFor(fund)}0d` }
}

function fundType(fund) {
  return { thai: 'Thai Fund', offshore: 'Offshore Fund', feeder: 'Feeder Fund', mixed: 'Mixed Fund' }[fund.type] || 'Fund'
}

// dividend_yield (fund.div) is always 0 from the API, even for funds that do pay — fall back
// to the real policy text (fund.dividendPolicy: "จ่าย"/"ไม่จ่าย") when the numeric yield is unusable.
function dividendDisplay(fund) {
  if (fund.div > 0) return { text: `${fund.div.toFixed(1)}%`, cls: 'positive' }
  if (fund.dividendPolicy === 'จ่าย') return { text: 'จ่ายปันผล', cls: 'positive' }
  if (fund.dividendPolicy === 'ไม่จ่าย') return { text: 'ไม่จ่าย', cls: '' }
  return { text: '0.0%', cls: 'positive' }
}
</script>

<template>
  <section v-if="selectedFunds.length" class="fund-matrix">
    <header class="fund-matrix-heading">
      <button type="button" class="fund-matrix-title" @click="collapsed = !collapsed">
        <span :class="{ collapsed }">⌄</span> เปรียบเทียบกองทุนที่เลือก ({{ selectedFunds.length }})
      </button>
      <button type="button" class="fund-matrix-clear" @click="$emit('clear-all')">ล้าง ×</button>
    </header>

    <div v-if="!collapsed" class="overflow-x-auto">
      <!-- table-fixed: column widths come from the header row only, not row content —
           keeps widths stable as selectedFunds changes (varying name/drawdown lengths). -->
      <table class="fund-matrix-table table-fixed w-full">
        <thead>
          <tr>
            <th class="w-[130px]">ข้อมูล</th>
            <!-- remaining width split evenly across selected funds — avoids layout shift on add/remove -->
            <th
              v-for="fund in selectedFunds"
              :key="fund.id"
              class="relative"
              :style="headerStyle(fund)"
            >
              <!-- Anti-XSS: text interpolation only, no v-html — Vue auto-escapes -->
              <b :style="{ color: colorFor(fund) }">{{ fund.id }}</b>
              <small>{{ fund.amc }}</small>
              <button type="button" :aria-label="`นำ ${fund.id} ออก`" @click="$emit('remove-fund', fund.id)">×</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr><th>ประเภท</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)">{{ fundType(fund) }}</td></tr>
          <tr><th>ขนาดกองทุน (AUM)</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)">{{ formatAumMThb(fund.aum) || '-' }}</td></tr>
          <tr><th>1Y Return</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)" :class="fund.perf >= 0 ? 'positive' : 'negative'">{{ formatPercent(fund.perf, 1) }}</td></tr>
          <tr><th>Sharpe Ratio</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)">{{ fund.sharpe?.toFixed(2) || '-' }}</td></tr>
          <tr><th>Max Drawdown</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)" class="negative">{{ fund.drawdown || '-' }}</td></tr>
          <tr><th>เงินปันผล</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)" :class="dividendDisplay(fund).cls">{{ dividendDisplay(fund).text }}</td></tr>
          <tr><th>TER (ค่าธรรมเนียม)</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)">{{ fund.fee?.toFixed(2) || '-' }}%</td></tr>
          <tr><th>Master Fund</th><td v-for="fund in selectedFunds" :key="fund.id" :style="cellStyle(fund)">{{ fund.master || '-' }}</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>