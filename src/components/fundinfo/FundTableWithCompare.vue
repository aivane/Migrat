<!-- FundTableWithCompare.vue -->
<script setup>
import { computed, ref } from 'vue'
import { useFundinfoScreener } from '../../composables/useFundinfoScreener'
import { useFundinfoWatchlist } from '../../composables/useFundinfoWatchlist'
import { STOCK_META } from '../../data/fundinfoData'
import { formatPercent } from '../../utils/fundinfoFormat'
import FundCompareTable from './FundCompareTable.vue'
import FundDetailRow from '../../views/fundinfo/FundDetailRow.vue'

const props = defineProps({ type: { type: String, default: 'offshore' } })
const { sortedScreenedFunds, setSort, toggleCompare, compareFunds, compareOrderOf } = useFundinfoScreener(props.type)
const { isWatched, toggleWatch } = useFundinfoWatchlist()
const expandedFundId = ref(null)
const selectedFundsList = computed(() => compareFunds.value)

const displayFunds = computed(() => sortedScreenedFunds.value)

// จำนวนคอลัมน์จริงของตาราง เปลี่ยนตาม type เพื่อให้ colspan ของแถวรายละเอียด/แถวว่าง ตรงกับหัวตารางเสมอ
const columnCount = computed(() => (props.type === 'offshore' || props.type === 'thai' ? 13 : 11))

function taxBenefitLabel(value) {
  if (!value) return '-'
  const val = String(value).toLowerCase()
  return { ssf: 'SSF', rmf: 'RMF', thaiesg: 'Thai ESG', none: '-' }[val] || value
}
function formattedInvestment(value) { return value ? `${Number(value).toLocaleString('en-US')} บาท` : '-' }
function holdingTickers(fund) { return (fund.top5 || []).slice(0, 4).map((holding) => STOCK_META[holding.name]?.ticker || holding.name).join(', ') || '-' }
function totalHoldingWeight(fund) {
  const weight = (fund.top5 || []).slice(0, 5).reduce((sum, holding) => sum + (Number(holding.percent) || 0), 0)
  return weight ? formatPercent(weight, 1) : '-'
}
function badgeLabel(fund) { return ({ KASIKORN: 'KA', KKP: 'KKP', SCB: 'SCB', BBLAM: 'B', BCAP: 'BC', ABRDN: 'AB' })[fund.amcShort] || fund.amcShort?.slice(0, 3) || 'FI' }
function badgeTone(fund) { return ({ KASIKORN: 'kasikorn', KKP: 'kkp', SCB: 'scb', BBLAM: 'bblam', BCAP: 'bcap', ABRDN: 'abrdn' })[fund.amcShort] || 'default' }
function toggleDetails(fundId) { expandedFundId.value = expandedFundId.value === fundId ? null : fundId }
function clearAllCompare() { selectedFundsList.value.forEach((fund) => toggleCompare(fund.id)) }
</script>

<template>
  <section class="fund-results">
    <div class="fund-results-heading">
      <div>
        <h2>กองทุนที่ตรงเงื่อนไข {{ displayFunds.length }} กอง</h2>
        <p>แสดงเฉพาะกองทุนไทยที่ถือหุ้นจากขอบเขตหรือรายการที่เลือก คลิกแถวเพื่อเปิดรายละเอียดกองทุน</p>
      </div>
      <button type="button" class="fund-sort-button" @click="setSort('risk')">ความเสี่ยงสูง → ต่ำ</button>
    </div>

    <div class="fund-results-table overflow-x-auto">
      <table class="w-full text-left">
        <thead>
          <tr>
            <th @click="setSort('id')">กองทุน</th>
            
            <!-- แสดงทั้ง Thai Fund และ Offshore Fund -->
            <th v-if="type === 'offshore' || type === 'thai'">หุ้นที่ถือเยอะ</th>
            <th v-if="type === 'offshore' || type === 'thai'" class="text-right">น้ำหนักรวม</th>
            
            <th @click="setSort('amc')">บลจ.</th>
            <th>สิทธิภาษี</th>
            <th>ขั้นต่ำ</th>
            <th class="text-center" @click="setSort('nav')">NAV/หน่วย</th>

            <th class="text-center" @click="setSort('risk')">ความเสี่ยง ↑</th>
            <th class="text-center" @click="setSort('perf')">ผลตอบแทนกองทุน 1 ปี</th>
            <th class="text-center">SD</th>
            <th class="text-right">Sharpe</th> <!-- หากต้องการให้ Sharpe ตรงกลางด้วย ให้เปลี่ยนเป็น text-center เช่นกันครับ -->
            <th class="text-center font-['Inter'] sub">TER</th>
            <th class="text-center"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="fund in displayFunds" :key="fund.id">
            <tr :id="`fund-row-${fund.id}`" class="fund-result-row" :class="{ selected: compareOrderOf(fund.id) > -1, expanded: expandedFundId === fund.id }" role="button" tabindex="0" :aria-expanded="expandedFundId === fund.id" @click="toggleDetails(fund.id)" @keydown.enter.prevent="toggleDetails(fund.id)" @keydown.space.prevent="toggleDetails(fund.id)">
              
              <!-- 1. กองทุน -->
              <td>
                <div class="flex items-center gap-2 min-w-0">
                  <button type="button" class="fund-row-plus" :class="{ active: compareOrderOf(fund.id) > -1 }" :aria-label="compareOrderOf(fund.id) > -1 ? `นำ ${fund.name} ออกจากการเปรียบเทียบ` : `เพิ่ม ${fund.name} เพื่อเปรียบเทียบ`" @click.stop="toggleCompare(fund.id)">{{ compareOrderOf(fund.id) > -1 ? '✓' : '+' }}</button>
                  <span class="fund-amc-mark" :class="badgeTone(fund)">{{ badgeLabel(fund) }}</span>
                  <div class="min-w-0">
                    <strong class="txt block truncate max-w-[190px]">{{ fund.name }}</strong>
                    <span class="block sub font-['Inter']">
                      {{ fund.id }}
                      <template v-if="type === 'feeder' && fund.masterFund"> · {{ fund.masterFund }}</template>
                    </span>
                  </div>
                  <button type="button" class="star ml-auto" :class="{ on: isWatched(fund.id) }" :aria-label="isWatched(fund.id) ? `นำ ${fund.name} ออกจาก wishlist` : `เพิ่ม ${fund.name} ไปยัง wishlist`" :aria-pressed="isWatched(fund.id)" @click.stop="toggleWatch(fund.id)">{{ isWatched(fund.id) ? '★' : '☆' }}</button>
                </div>
              </td>
              
              <!-- 2. หุ้นที่ถือเยอะ (แสดงสำหรับ Thai และ Offshore) -->
              <td v-if="type === 'offshore' || type === 'thai'" class="sub max-w-[170px] truncate font-['Inter']" :title="holdingTickers(fund)">{{ holdingTickers(fund) }}</td>
              
              <!-- 3. น้ำหนักรวม (แสดงสำหรับ Thai และ Offshore) -->
              <td v-if="type === 'offshore' || type === 'thai'" class="text-right font-['Inter'] sub">{{ totalHoldingWeight(fund) }}</td>
              
              <!-- 4. บลจ. -->
              <td class="sub">{{ fund.amcShort || fund.amc || '-' }}</td>
              
              <!-- 5. สิทธิภาษี -->
              <td class="sub">{{ taxBenefitLabel(fund.taxBenefit) }}</td>
              
              <!-- 6. ขั้นต่ำ -->
              <td class="sub">{{ formattedInvestment(fund.minInvestment ?? fund.minInvest) }}</td>
              
              <!-- 7. NAV/หน่วย -->
              <td class="text-right font-['Inter'] sub">{{ fund.nav ? fund.nav.toFixed(4) : '-' }}</td>

              <!-- 8. ความเสี่ยง -->
              <td class="text-center font-bold whitespace-nowrap" style="color: #475569;">
                {{ fund.risk ? `ความเสี่ยง ${fund.risk}/8` : '-' }}
              </td>
              
              <!-- 9. ผลตอบแทนกองทุน 1 ปี -->
              <td class="text-center font-['Inter']" :class="(fund.perf ?? fund.return1y ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ (fund.perf ?? fund.return1y) !== undefined ? ((fund.perf ?? fund.return1y) > 0 ? '+' : '') + (fund.perf ?? fund.return1y) + '%' : '-' }}
              </td>

              <!-- 10. SD -->
              <td class="text-center font-['Inter'] sub">
                {{ (fund.sd ?? fund.stats?.sd) ? (fund.sd ?? fund.stats?.sd) + '%' : '-' }}
              </td>

              <!-- 11. Sharpe -->
              <td class="text-right font-['Inter'] sub">{{ fund.sharpe || '-' }}</td>

              <!-- 12. TER -->
              <td class="text-center font-['Inter'] sub">{{ fund.fee?.toFixed(2) || '-' }}%</td>
              
              <!-- 13. Chevron -->
              <td class="text-center">
                <button type="button" class="fund-row-chevron" :class="{ open: expandedFundId === fund.id }" :aria-expanded="expandedFundId === fund.id" :aria-label="expandedFundId === fund.id ? `ย่อรายละเอียด ${fund.name}` : `แสดงรายละเอียด ${fund.name}`" @click.stop="toggleDetails(fund.id)">⌄</button>
              </td>

            </tr>
            <FundDetailRow v-if="expandedFundId === fund.id" :fund="fund" :colspan="columnCount" :in-compare="compareOrderOf(fund.id) > -1" @compare="toggleCompare(fund.id)" />
          </template>

          <tr v-if="!displayFunds.length">
            <td :colspan="columnCount" class="fund-results-empty">ไม่พบกองทุนที่ตรงกับเงื่อนไข</td>
          </tr>
        </tbody>
      </table>
    </div>
    <FundCompareTable :id="`fund-compare-${props.type}`" :selected-funds="selectedFundsList" @clear-all="clearAllCompare" @remove-fund="toggleCompare" />
    <p class="fund-results-footnote">Fundinfo v3.2.1 · Master Fund Comparison Workspace · ข้อมูลเพื่อการออกแบบ ไม่ใช่คำแนะนำการลงทุน</p>
  </section>
</template>