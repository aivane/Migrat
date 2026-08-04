<script setup>
import { computed } from 'vue'
import { FUND_TYPES } from '../../data/fundinfoData'
import { useFundinfoCategory } from '../../composables/useFundinfoCategory'
import { formatCompact, formatNumber, formatPercent, riskClass } from '../../utils/fundinfoFormat'
import FundDetailRow from './FundDetailRow.vue'

const meta = FUND_TYPES.mixed
const { funds, state, amcOptions, filteredFunds, sortedFunds, summary, topHoldings, setSort, toggleExpand } =
  useFundinfoCategory('mixed')

// Average asset-mix allocation across the visible mixed funds — the most
// telling breakdown for a "mixed" category (equity vs bond vs gold vs cash).
const mixBreakdown = computed(() => {
  const totals = new Map()
  const count = filteredFunds.value.length || 1

  filteredFunds.value.forEach((fund) => {
    ;(fund.mix || []).forEach(({ name, percent }) => {
      totals.set(name, (totals.get(name) || 0) + percent)
    })
  })

  const rows = [...totals.entries()].map(([name, value]) => ({ name, value: value / count }))
  const max = Math.max(...rows.map((row) => row.value), 1)
  return rows.sort((a, b) => b.value - a.value).map((row) => ({ ...row, percent: (row.value / max) * 100 }))
})

function topMix(fund) {
  return [...(fund.mix || [])].sort((a, b) => b.percent - a.percent).slice(0, 2)
}
</script>

<template>
  <section>
    <p class="type-sub" :style="{ color: meta.accent }">{{ meta.emoji }} {{ meta.sub }}</p>

    <section class="summary-grid">
      <article class="summary-panel">
        <div class="panel-title">
          <span>{{ meta.label }}</span>
          <strong>{{ formatNumber(summary.count) }} กองทุน</strong>
        </div>
        <div class="stat-grid">
          <div>
            <span>ผลตอบแทนเฉลี่ย 1Y</span>
            <strong>{{ formatPercent(summary.avgPerf) }}</strong>
          </div>
          <div>
            <span>ค่าธรรมเนียมเฉลี่ย</span>
            <strong>{{ summary.avgFee.toFixed(2) }}%</strong>
          </div>
          <div>
            <span>ผลตอบแทนสูงสุด</span>
            <strong>{{ summary.best?.id || '-' }}</strong>
          </div>
          <div>
            <span>เงินไหลเข้าสุทธิรวม 1M</span>
            <strong>฿{{ formatCompact(summary.totalNetbuy) }}</strong>
          </div>
        </div>
      </article>

      <article class="summary-panel">
        <div class="panel-title"><span>สัดส่วนสินทรัพย์เฉลี่ยของกองทุนผสม</span></div>
        <div class="bar-list">
          <div v-for="row in mixBreakdown" :key="row.name" class="bar-row">
            <span>{{ row.name }}</span>
            <div><i :style="{ width: `${Math.max(row.percent, 3)}%` }"></i></div>
            <strong>{{ row.value.toFixed(1) }}%</strong>
          </div>
        </div>
      </article>

      <article class="summary-panel">
        <div class="panel-title"><span>Top Holdings รวม</span></div>
        <div v-if="topHoldings.length" class="bar-list">
          <div v-for="row in topHoldings" :key="row.name" class="bar-row">
            <span>{{ row.name }}</span>
            <div><i :style="{ width: `${Math.max(row.percent, 3)}%` }"></i></div>
            <strong>{{ row.value.toFixed(1) }}%</strong>
          </div>
        </div>
        <p v-else class="muted">ไม่มีข้อมูล</p>
      </article>
    </section>

    <section class="tool-row">
      <form class="search-box" @submit.prevent>
        <input v-model="state.search" placeholder="ค้นหาชื่อกองทุน, สินทรัพย์ที่ถือ..." />
      </form>
      <div class="filters">
        <select v-model="state.selectedAmc">
          <option value="">บลจ. ทั้งหมด</option>
          <option v-for="amc in amcOptions" :key="amc" :value="amc">{{ amc }}</option>
        </select>
        <select v-model="state.selectedRisk">
          <option value="">Risk ทั้งหมด</option>
          <option value="low">ต่ำ 1-3</option>
          <option value="medium">กลาง 4-5</option>
          <option value="high">สูง 6+</option>
        </select>
      </div>
    </section>

    <section class="table-section">
      <div class="table-head">
        <div>
          <h2>รายชื่อ Mixed Fund</h2>
          <p>{{ formatNumber(sortedFunds.length) }} / {{ formatNumber(funds.length) }} กองทุน</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="left" @click="setSort('name')">กองทุน</th>
              <th class="left">สัดส่วนสินทรัพย์หลัก</th>
              <th @click="setSort('perf')">ผลตอบแทน 1Y</th>
              <th @click="setSort('div')">Div Yield</th>
              <th @click="setSort('fee')">ค่าธรรมเนียม</th>
              <th @click="setSort('risk')">Risk</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!sortedFunds.length">
              <td colspan="6">ไม่พบกองทุนที่ตรงกับเงื่อนไข</td>
            </tr>
            <template v-for="fund in sortedFunds" :key="fund.id">
              <tr class="clickable" @click="toggleExpand(fund.id)">
                <td class="left">
                  <strong>{{ fund.id }}</strong>
                  <span>{{ fund.name }}</span>
                </td>
                <td class="left">
                  <span v-for="item in topMix(fund)" :key="item.name" class="mix-chip">
                    {{ item.name }} {{ item.percent.toFixed(0) }}%
                  </span>
                </td>
                <td :class="{ positive: fund.perf >= 0, negative: fund.perf < 0 }">
                  {{ formatPercent(fund.perf) }}
                </td>
                <td>{{ fund.div.toFixed(1) }}%</td>
                <td>{{ fund.fee.toFixed(2) }}%</td>
                <td><span class="badge" :class="riskClass(fund.risk)">{{ fund.risk }}</span></td>
              </tr>
              <FundDetailRow v-if="state.expandedId === fund.id" :fund="fund" :colspan="6" />
            </template>
          </tbody>
        </table>
      </div>
    </section>
  </section>
</template>

<style scoped>
.type-sub {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 700;
}

tr.clickable {
  cursor: pointer;
}

tr.clickable:hover td {
  background: var(--surface-soft);
}

.mix-chip {
  display: inline-block;
  margin: 0 6px 4px 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 2px 9px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}
</style>
