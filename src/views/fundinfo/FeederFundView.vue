<script setup>
import { computed } from 'vue'
import { FUND_TYPES } from '../../data/fundinfoData'
import { useFundinfoCategory } from '../../composables/useFundinfoCategory'
import { formatCompact, formatNumber, formatPercent, riskClass } from '../../utils/fundinfoFormat'
import FundDetailRow from './FundDetailRow.vue'

const meta = FUND_TYPES.feeder
const { funds, state, amcOptions, filteredFunds, sortedFunds, summary, topHoldings, setSort, toggleExpand } =
  useFundinfoCategory('feeder')

// Breakdown by the Master Fund's country/region — the defining trait of a feeder fund.
const countryBreakdown = computed(() => {
  const totals = new Map()
  filteredFunds.value.forEach((fund) => {
    totals.set(fund.country, (totals.get(fund.country) || 0) + Math.max(fund.netbuy, 0))
  })
  const rows = [...totals.entries()].map(([name, value]) => ({ name, value }))
  const max = Math.max(...rows.map((row) => row.value), 1)
  return rows.sort((a, b) => b.value - a.value).map((row) => ({ ...row, percent: (row.value / max) * 100 }))
})
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
        <div class="panel-title"><span>กระจายตาม Master Fund ตามภูมิภาค/ประเทศ</span></div>
        <div class="bar-list">
          <div v-for="row in countryBreakdown" :key="row.name" class="bar-row">
            <span>{{ row.name }}</span>
            <div><i :style="{ width: `${Math.max(row.percent, 3)}%` }"></i></div>
            <strong>฿{{ formatCompact(row.value) }}</strong>
          </div>
        </div>
      </article>

      <article class="summary-panel">
        <div class="panel-title"><span>Top Holdings รวม (Master Fund)</span></div>
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
        <input v-model="state.search" placeholder="ค้นหาชื่อกองทุน, Master Fund, ประเทศ..." />
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
          <h2>รายชื่อ Feeder Fund</h2>
          <p>{{ formatNumber(sortedFunds.length) }} / {{ formatNumber(funds.length) }} กองทุน</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th class="left" @click="setSort('name')">กองทุน</th>
              <th @click="setSort('country')">Master Fund / ประเทศ</th>
              <th @click="setSort('perf')">ผลตอบแทน 1Y</th>
              <th @click="setSort('fee')">ค่าธรรมเนียม</th>
              <th @click="setSort('risk')">Risk</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!sortedFunds.length">
              <td colspan="5">ไม่พบกองทุนที่ตรงกับเงื่อนไข</td>
            </tr>
            <template v-for="fund in sortedFunds" :key="fund.id">
              <tr class="clickable" @click="toggleExpand(fund.id)">
                <td class="left">
                  <strong>{{ fund.id }}</strong>
                  <span>{{ fund.name }}</span>
                </td>
                <td>
                  <strong>{{ fund.master }}</strong>
                  <div class="muted">{{ fund.country }}</div>
                </td>
                <td :class="{ positive: fund.perf >= 0, negative: fund.perf < 0 }">
                  {{ formatPercent(fund.perf) }}
                </td>
                <td>{{ fund.fee.toFixed(2) }}%</td>
                <td><span class="badge" :class="riskClass(fund.risk)">{{ fund.risk }}</span></td>
              </tr>
              <FundDetailRow v-if="state.expandedId === fund.id" :fund="fund" :colspan="5" />
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

td .muted {
  margin-top: 2px;
  font-size: 12px;
}
</style>
