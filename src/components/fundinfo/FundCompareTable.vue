<script setup>
import { ref } from 'vue'
import { formatPercent } from '../../utils/fundinfoFormat'

defineProps({
  selectedFunds: { type: Array, default: () => [] },
})

defineEmits(['clear-all', 'remove-fund'])

const collapsed = ref(false)

function fundType(fund) {
  return { thai: 'Thai Fund', offshore: 'Offshore Fund', feeder: 'Feeder Fund', mixed: 'Mixed Fund' }[fund.type] || 'Fund'
}
</script>

<template>
  <section v-if="selectedFunds.length" class="fund-matrix">
    <header class="fund-matrix-heading">
      <button type="button" class="fund-matrix-title" @click="collapsed = !collapsed">
        <span :class="{ collapsed }">⌄</span> เปรียบเทียบกองที่เลือก ({{ selectedFunds.length }})
      </button>
      <button type="button" class="fund-matrix-clear" @click="$emit('clear-all')">ล้าง ×</button>
    </header>

    <div v-if="!collapsed" class="overflow-x-auto">
      <table class="fund-matrix-table">
        <thead>
          <tr>
            <th>ข้อมูล</th>
            <th v-for="fund in selectedFunds" :key="fund.id" class="relative">
              <b>{{ fund.id }}</b>
              <small>{{ fund.amc }}</small>
              <button type="button" :aria-label="`นำ ${fund.id} ออก`" @click="$emit('remove-fund', fund.id)">×</button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr><th>ประเภท</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fundType(fund) }}</td></tr>
          <tr><th>1Y Return</th><td v-for="fund in selectedFunds" :key="fund.id" :class="fund.perf >= 0 ? 'positive' : 'negative'">{{ formatPercent(fund.perf, 1) }}</td></tr>
          <tr><th>Sharpe Ratio</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.sharpe?.toFixed(2) || '-' }}</td></tr>
          <tr><th>Max Drawdown</th><td v-for="fund in selectedFunds" :key="fund.id" class="negative">{{ fund.drawdown || '-' }}</td></tr>
          <tr><th>เงินปันผล</th><td v-for="fund in selectedFunds" :key="fund.id" class="positive">{{ fund.div?.toFixed(1) || '0.0' }}%</td></tr>
          <tr><th>TER (ค่าธรรมเนียม)</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.fee?.toFixed(2) || '-' }}%</td></tr>
          <tr><th>Master Fund</th><td v-for="fund in selectedFunds" :key="fund.id">{{ fund.master || '-' }}</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
