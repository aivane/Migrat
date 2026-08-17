<!-- FundTableWithCompare.vue -->
<script setup>
import { computed, ref } from 'vue'
import { useFundinfoScreener } from '../../composables/useFundinfoScreener'
import { useFundinfoWatchlist } from '../../composables/useFundinfoWatchlist'
import { STOCK_META } from '../../data/fundinfoData'
import { formatPercent } from '../../utils/fundinfoFormat'
import FundCompareTable from './FundCompareTable.vue'
import FundDetailRow from '../../views/fundinfo/FundDetailRow.vue'
import InfoTooltip from '../common/InfoTooltip.vue'

const props = defineProps({ type: { type: String, default: 'offshore' } })

const { screenedFunds, toggleCompare, compareFunds, compareOrderOf } = useFundinfoScreener(props.type)
const { isWatched, toggleWatch } = useFundinfoWatchlist()
const expandedFundId = ref(null)
const selectedFundsList = computed(() => compareFunds.value)

// ลด columnCount ลง 1 เพราะเอาคอลัมน์ บลจ. ออก
const columnCount = computed(() => (props.type === 'offshore' || props.type === 'thai' ? 12 : 10))

const localSortKey = ref('')
const localSortDir = ref('asc') 

function sortValue(fund, key) {
  switch (key) {
    case 'minInvestment': return Number(fund.minInvestment ?? fund.minInvest ?? 0)
    case 'nav': return Number(fund.nav ?? 0)
    case 'risk': return Number(fund.risk ?? 0)
    case 'perf': return Number(fund.perf ?? fund.return1y ?? 0)
    case 'sd': return Number(fund.sd ?? fund.stats?.sd ?? 0)
    case 'sharpe': return Number(fund.sharpe ?? 0)
    case 'fee': return Number(fund.fee ?? 0)
    default: return 0
  }
}

function setSortLocal(key) {
  if (localSortKey.value === key) {
    localSortDir.value = localSortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    localSortKey.value = key
    localSortDir.value = 'asc'
  }
}

function sortRiskHighToLow() {
  localSortKey.value = 'risk'
  localSortDir.value = 'desc'
}

function sortIcon(key) {
  if (localSortKey.value !== key) return '↕'
  return localSortDir.value === 'asc' ? '▲' : '▼'
}

const displayFunds = computed(() => {
  const funds = [...screenedFunds.value]
  if (!localSortKey.value) return funds
  const dir = localSortDir.value === 'asc' ? 1 : -1
  return funds.sort((a, b) => (sortValue(a, localSortKey.value) - sortValue(b, localSortKey.value)) * dir)
})

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

// ฟังก์ชันสำหรับจำกัดการเพิ่มลงตารางเปรียบเทียบแค่ 3 ตัว
function handleToggleCompare(fundId) {
  // หากยังไม่เคยถูกเลือก และตารางมีครบ 3 ตัวแล้ว ให้แจ้งเตือนและยกเลิก
  if (compareOrderOf(fundId) === -1 && selectedFundsList.value.length >= 3) {
    alert('คุณสามารถเปรียบเทียบกองทุนได้สูงสุด 3 กองทุนพร้อมกัน');
    return;
  }
  toggleCompare(fundId);
}
</script>

<template>
  <section class="fund-results">
    <div class="fund-results-heading">
      <div>
        <h2>กองทุนที่ตรงเงื่อนไข {{ displayFunds.length }} กอง <InfoTooltip text="แสดงเฉพาะกองทุนไทยที่ถือหุ้นจากขอบเขตหรือรายการที่เลือก คลิกแถวเพื่อเปิดรายละเอียดกองทุน" /></h2>
      </div>
      <button type="button" class="fund-sort-button" @click="sortRiskHighToLow">ความเสี่ยงสูง → ต่ำ</button>
    </div>

    <!-- เพิ่ม max-h-[300px] และ overflow-y-auto เพื่อให้แสดงประมาณ 3 กองแล้วที่เหลือให้เลื่อน -->
    <div class="fund-results-table overflow-x-auto max-h-[250px] overflow-y-auto relative ">
      <table class="w-full text-left">
        <!-- เพิ่ม sticky top-0 และพื้นหลังสีขาว (bg-white หรือสีที่ใช้) เพื่อให้หัวตารางติดขอบเวลาเลื่อน -->
        <thead class="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
          <tr>
            <th>กองทุน</th>
            
            <!-- แสดงทั้ง Thai Fund และ Offshore Fund -->
            <th v-if="type === 'offshore' || type === 'thai'">หุ้นที่ถือเยอะ</th>
            <th v-if="type === 'offshore' || type === 'thai'" class="text-right">น้ำหนักรวม</th>
            
            <!-- นำ <th>บลจ.</th> ออกไปแล้ว -->
            
            <th>สิทธิภาษี</th>
            <th class="text-center sortable" @click="setSortLocal('minInvestment')">ขั้นต่ำ <span class="sort-arrow" :class="{ active: localSortKey === 'minInvestment' }">{{ sortIcon('minInvestment') }}</span></th>
            <th class="text-center sortable" @click="setSortLocal('nav')">NAV/หน่วย <span class="sort-arrow" :class="{ active: localSortKey === 'nav' }">{{ sortIcon('nav') }}</span></th>

            <th class="text-center sortable" @click="setSortLocal('risk')">ความเสี่ยง <span class="sort-arrow" :class="{ active: localSortKey === 'risk' }">{{ sortIcon('risk') }}</span></th>
            <th class="text-center sortable" @click="setSortLocal('perf')">ผลตอบแทน 1 ปี <span class="sort-arrow" :class="{ active: localSortKey === 'perf' }">{{ sortIcon('perf') }}</span></th>
            <th class="text-center sortable" @click="setSortLocal('sd')">SD <span class="sort-arrow" :class="{ active: localSortKey === 'sd' }">{{ sortIcon('sd') }}</span></th>
            <th class="text-right sortable" @click="setSortLocal('sharpe')">Sharpe <span class="sort-arrow" :class="{ active: localSortKey === 'sharpe' }">{{ sortIcon('sharpe') }}</span></th>
            <th class="text-center font-['Inter'] sub sortable" @click="setSortLocal('fee')">TER <span class="sort-arrow" :class="{ active: localSortKey === 'fee' }">{{ sortIcon('fee') }}</span></th>
            <th class="text-center"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="fund in displayFunds" :key="fund.id">
            <tr :id="`fund-row-${fund.id}`" class="fund-result-row" :class="{ selected: compareOrderOf(fund.id) > -1, expanded: expandedFundId === fund.id }" role="button" tabindex="0" :aria-expanded="expandedFundId === fund.id" @click="toggleDetails(fund.id)" @keydown.enter.prevent="toggleDetails(fund.id)" @keydown.space.prevent="toggleDetails(fund.id)">
              
              <!-- 1. กองทุน -->
              <td>
                <div class="flex items-center gap-2 min-w-0">
                  <!-- เปลี่ยนจาก toggleCompare เป็น handleToggleCompare -->
                  <button type="button" class="fund-row-plus" :class="{ active: compareOrderOf(fund.id) > -1 }" :aria-label="compareOrderOf(fund.id) > -1 ? `นำ ${fund.name} ออกจากการเปรียบเทียบ` : `เพิ่ม ${fund.name} เพื่อเปรียบเทียบ`" @click.stop="handleToggleCompare(fund.id)">{{ compareOrderOf(fund.id) > -1 ? '✓' : '+' }}</button>
                  <span class="fund-amc-mark" :class="badgeTone(fund)">{{ badgeLabel(fund) }}</span>
                  <div class="min-w-0">
                    <strong class="txt block truncate max-w-[190px]">{{ fund.name }}</strong>
                    <span class="block sub font-['Inter']" style="text-align: left;">
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
              
              <!-- นำ <td> ของ บลจ. ออกไปแล้ว -->
              
              <!-- 4. สิทธิภาษี -->
              <td class="sub">{{ taxBenefitLabel(fund.taxBenefit) }}</td>
              
              <!-- 5. ขั้นต่ำ -->
              <td class="text-center sub">{{ formattedInvestment(fund.minInvestment ?? fund.minInvest) }}</td>
              
              <!-- 6. NAV/หน่วย -->
              <td class="text-right font-['Inter'] sub">{{ fund.nav ? fund.nav.toFixed(4) : '-' }}</td>

              <!-- 7. ความเสี่ยง -->
              <td class="text-center font-bold whitespace-nowrap" style="color: #475569;">
                {{ fund.risk ? ` ${fund.risk}/8` : '-' }}
              </td>
              
              <!-- 8. ผลตอบแทนกองทุน 1 ปี -->
              <td class="text-center font-['Inter']" :class="(fund.perf ?? fund.return1y ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'">
                {{ (fund.perf ?? fund.return1y) !== undefined ? ((fund.perf ?? fund.return1y) > 0 ? '+' : '') + (fund.perf ?? fund.return1y) + '%' : '-' }}
              </td>

              <!-- 9. SD -->
              <td class="text-center font-['Inter'] sub">
                {{ (fund.sd ?? fund.stats?.sd) ? (fund.sd ?? fund.stats?.sd) + '%' : '-' }}
              </td>

              <!-- 10. Sharpe -->
              <td class="text-right font-['Inter'] sub">{{ fund.sharpe || '-' }}</td>

              <!-- 11. TER -->
              <td class="text-center font-['Inter'] sub">{{ fund.fee?.toFixed(2) || '-' }}%</td>
              
              <!-- 12. Chevron -->
              <td class="text-center">
                <button type="button" class="fund-row-chevron" :class="{ open: expandedFundId === fund.id }" :aria-expanded="expandedFundId === fund.id" :aria-label="expandedFundId === fund.id ? `ย่อรายละเอียด ${fund.name}` : `แสดงรายละเอียด ${fund.name}`" @click.stop="toggleDetails(fund.id)">⌄</button>
              </td>

            </tr>
            <!-- เปลี่ยนจาก toggleCompare เป็น handleToggleCompare -->
            <FundDetailRow v-if="expandedFundId === fund.id" :fund="fund" :colspan="columnCount" :in-compare="compareOrderOf(fund.id) > -1" @compare="handleToggleCompare(fund.id)" />
          </template>

          <tr v-if="!displayFunds.length">
            <td :colspan="columnCount" class="fund-results-empty">ไม่พบกองทุนที่ตรงกับเงื่อนไข</td>
          </tr>
        </tbody>
      </table>
    </div>
    
    <!-- ไม่จำเป็นต้องแก้โค้ดคอมโพเนนต์เปรียบเทียบตาราง เพราะมันผูกกับ selectedFundsList อยู่แล้ว -->
    <FundCompareTable :id="`fund-compare-${props.type}`" :selected-funds="selectedFundsList" @clear-all="clearAllCompare" @remove-fund="toggleCompare" />
    <p class="fund-results-footnote">Fundinfo v3.2.1 · Master Fund Comparison Workspace · ข้อมูลเพื่อการออกแบบ ไม่ใช่คำแนะนำการลงทุน</p>
  </section>
</template>