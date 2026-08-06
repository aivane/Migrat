<script setup>
import { computed, ref } from 'vue'
import { useFundinfoScreener } from '../../composables/useFundinfoScreener'
import { STOCK_META } from '../../data/fundinfoData'
import { formatPercent } from '../../utils/fundinfoFormat'
import FundCompareTable from './FundCompareTable.vue'

const props = defineProps({
  type: { type: String, default: 'offshore' },
})

const { sortedScreenedFunds, setSort, toggleCompare, compareFunds, compareOrderOf } = useFundinfoScreener(props.type)
const starredFunds = ref(new Set())
const selectedFundsList = computed(() => compareFunds.value)

// The reference shows the three direct-equity offshore funds only.  Keep this
// scoped to Offshore while preserving every row that the Thai screener returns.
const displayFunds = computed(() => {
  if (props.type !== 'offshore') return sortedScreenedFunds.value
  return sortedScreenedFunds.value.filter((fund) => fund.top5?.some((holding) => STOCK_META[holding.name]))
})

function toggleStar(id) {
  const next = new Set(starredFunds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  starredFunds.value = next
}

function taxBenefitLabel(value) {
  return { ssf: 'SSF', rmf: 'RMF', thaiesg: 'Thai ESG', none: '-' }[value] || '-'
}

function formattedInvestment(value) {
  return value ? `${Number(value).toLocaleString('en-US')} บาท` : '-'
}

function holdingTickers(fund) {
  return (fund.top5 || []).slice(0, 4).map((holding) => STOCK_META[holding.name]?.ticker || holding.name).join(', ') || '-'
}

function totalHoldingWeight(fund) {
  const weight = (fund.top5 || []).slice(0, 5).reduce((sum, holding) => sum + (Number(holding.percent) || 0), 0)
  return weight ? formatPercent(weight, 1) : '-'
}

function badgeLabel(fund) {
  const labels = { KASIKORN: 'KA', KKP: 'KKP', SCB: 'SCB', BBLAM: 'B', BCAP: 'BC', ABRDN: 'AB' }
  return labels[fund.amcShort] || fund.amcShort?.slice(0, 3) || 'FI'
}

function badgeTone(fund) {
  const tones = { KASIKORN: 'kasikorn', KKP: 'kkp', SCB: 'scb', BBLAM: 'bblam', BCAP: 'bcap', ABRDN: 'abrdn' }
  return tones[fund.amcShort] || 'default'
}

function riskClass(value) {
  if (value <= 3) return 'risk-low'
  if (value <= 5) return 'risk-medium'
  return 'risk-high'
}

function clearAllCompare() {
  selectedFundsList.value.forEach((fund) => toggleCompare(fund.id))
}
</script>

<template>
  <section class="fund-results">
    <div class="fund-results-heading">
      <div>
        <h2>กองทุนที่ตรงเงื่อนไข {{ displayFunds.length }} กอง</h2>
        <p>ผลลัพธ์ตามตัวกรองที่เลือก · คลิกไอคอนกองทุนเพื่อเพิ่มในการเปรียบเทียบ</p>
      </div>
      <button type="button" class="fund-sort-button" @click="setSort('pop')">ความนิยมสูง → มาก</button>
    </div>

    <div class="fund-results-table overflow-x-auto">
      <table class="w-full table-fixed text-left">
        <thead>
          <tr>
            <th @click="setSort('id')">กองทุน</th>
            <th>หุ้นที่ถือเยอะ</th>
            <th class="text-right">น้ำหนักรวม</th>
            <th @click="setSort('amc')">บลจ.</th>
            <th>สิทธิภาษี ⓘ</th>
            <th>ขั้นต่ำ</th>
            <th class="text-right" @click="setSort('nav')">NAV/หน่วย ⓘ</th>
            <th class="text-center" @click="setSort('risk')">ความเสี่ยง ↑</th>
            <th class="text-right" @click="setSort('perf')">ผลตอบแทนกองทุน 1 ปี</th>
            <th class="text-right">SD</th>
            <th class="text-right">Sharpe</th>
            <th class="text-right">TER</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="fund in displayFunds"
            :key="fund.id"
            class="fund-result-row"
            :class="{ selected: compareOrderOf(fund.id) > -1 }"
            role="button"
            tabindex="0"
            :aria-pressed="compareOrderOf(fund.id) > -1"
            @click="toggleCompare(fund.id)"
            @keydown.enter.prevent="toggleCompare(fund.id)"
            @keydown.space.prevent="toggleCompare(fund.id)"
          >
            <td>
              <div class="flex items-center gap-2 min-w-0">
                <span class="fund-amc-mark comparison-marker" :class="[badgeTone(fund), { active: compareOrderOf(fund.id) > -1 }]">{{ compareOrderOf(fund.id) > -1 ? compareOrderOf(fund.id) + 1 : badgeLabel(fund) }}</span>
                <div class="min-w-0">
                  <strong class="txt block truncate max-w-[220px]">{{ fund.name }}</strong>
                  <span class="block sub font-['Inter']">{{ fund.id }}</span>
                </div>
                <button type="button" class="star ml-auto" :class="{ on: starredFunds.has(fund.id) }" @click.stop="toggleStar(fund.id)">☆</button>
              </div>
            </td>
            <td class="sub max-w-[170px] truncate font-['Inter']" :title="holdingTickers(fund)">{{ holdingTickers(fund) }}</td>
            <td class="text-right font-bold font-['Inter'] text-brand">{{ totalHoldingWeight(fund) }}</td>
            <td class="txt whitespace-nowrap">{{ fund.amc }}</td>
            <td>{{ taxBenefitLabel(fund.taxBenefit) }}</td>
            <td class="whitespace-nowrap">{{ formattedInvestment(fund.minInvestment) }}</td>
            <td class="text-right font-['Inter']">{{ fund.nav?.toFixed(4) || '-' }}</td>
            <td class="text-center"><span class="badge" :class="riskClass(fund.risk)">ความเสี่ยง {{ fund.risk }}/8</span></td>
            <td class="text-right font-bold font-['Inter']" :class="fund.perf >= 0 ? 'text-pos' : 'text-neg'">{{ formatPercent(fund.perf, 1) }}</td>
            <td class="text-right font-['Inter'] sub">{{ (fund.csvStats?.sd || fund.stats?.sd || 0).toFixed(1) }}%</td>
            <td class="text-right font-['Inter']">{{ fund.sharpe?.toFixed(2) || '-' }}</td>
            <td class="text-right font-['Inter'] sub">{{ fund.fee?.toFixed(2) || '-' }}%</td>
          </tr>
          <tr v-if="!displayFunds.length"><td colspan="12" class="fund-results-empty">ไม่พบกองทุนที่ตรงกับเงื่อนไข</td></tr>
        </tbody>
      </table>
    </div>

    <FundCompareTable :id="`fund-compare-${props.type}`" :selected-funds="selectedFundsList" @clear-all="clearAllCompare" @remove-fund="toggleCompare" />
    <p class="fund-results-footnote">Fundinfo v3.2.1 · Master Fund Comparison Workspace · ข้อมูลเพื่อการออกแบบ ไม่ใช่คำแนะนำการลงทุน</p>
  </section>
</template>
