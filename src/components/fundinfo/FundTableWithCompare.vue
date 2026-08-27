<!-- FundTableWithCompare.vue -->
<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useFundinfoScreener } from '../../composables/useFundinfoScreener'
import { useFundinfoWishlist } from '../../composables/useFundinfoWishlist'
import { useFundinfoStore } from '../../stores/fundinfoStore'
import { STOCK_META } from '../../data/fundinfoData'
import { formatPercent } from '../../utils/fundinfoFormat'
import FundCompareTable from './FundCompareTable.vue'
import FundDetailRow from '../../views/fundinfo/FundDetailRow.vue'
import InfoTooltip from '../common/InfoTooltip.vue'

const props = defineProps({ type: { type: String, default: 'offshore' } })

const { screenedFunds, toggleCompare, compareFunds, compareOrderOf } = useFundinfoScreener(props.type)
const { isWished, toggleWish } = useFundinfoWishlist()
// API Compatibility — /funds/list never returns a fund's own holdings/
// allocations (only /funds/{code} does, one fund at a time — there's no bulk
// variant), so every row starts with an empty top5/asset/sectorMix. Clicking
// a row's expand chevron always fetches it (see toggleDetails below); rows
// showing the "หุ้นที่ถือเยอะ"/"น้ำหนักรวม" columns (offshore/thai) also get
// their detail prefetched automatically as they scroll into view — see the
// IntersectionObserver setup further down. Either path lands in
// fundinfoStore.mergeFundIntoCachedLists, so this row's own columns update
// reactively regardless of which one fired.
const fundinfoStore = useFundinfoStore()
const expandedFundId = ref(null)
const selectedFundsList = computed(() => compareFunds.value)
const showsHoldingsColumns = props.type === 'offshore' || props.type === 'thai'

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

// Perf: badge/ticker/weight/tax-label are pure functions of `fund` alone, so
// derive them once per displayFunds change instead of re-running them for
// every visible row on every render (expand toggle, star toggle, compare
// toggle previously re-evaluated all of these for all rows every click).
const tableRows = computed(() =>
  displayFunds.value.map((fund) => ({
    fund,
    badge: badgeLabel(fund),
    badgeCls: badgeTone(fund),
    tickers: holdingTickers(fund),
    weight: totalHoldingWeight(fund),
    taxBenefit: taxBenefitLabel(fund.taxBenefit),
    minInvestment: formattedInvestment(fund.minInvestment ?? fund.minInvest),
  })),
)

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
function toggleDetails(fundId) {
  const opening = expandedFundId.value !== fundId
  expandedFundId.value = opening ? fundId : null
  if (opening && !fundinfoStore.hasFundDetail(fundId)) fundinfoStore.loadFundById(fundId)
}
function clearAllCompare() { selectedFundsList.value.forEach((fund) => toggleCompare(fund.id)) }

// Lazy-load holdings for offshore/thai rows as they scroll into the table's
// own scroll container — bounded, on-demand version of the eager fetch that
// clicking a row's chevron already does, so "หุ้นที่ถือเยอะ"/"น้ำหนักรวม" fill
// in without the user having to click every one of e.g. 239 rows, but also
// without firing 239 detail requests at once on table mount.
const scrollContainerRef = ref(null)
const rowEls = new Map()
let rowObserver = null

function handleRowIntersect(entries) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return
    const fundId = entry.target.dataset.fundId
    if (fundId && !fundinfoStore.hasFundDetail(fundId)) fundinfoStore.loadFundById(fundId)
    rowObserver?.unobserve(entry.target)
  })
}

function setRowRef(fundId, el) {
  if (!showsHoldingsColumns) return
  const prevEl = rowEls.get(fundId)
  if (prevEl && prevEl !== el) rowObserver?.unobserve(prevEl)

  if (el) {
    rowEls.set(fundId, el)
    if (!fundinfoStore.hasFundDetail(fundId)) rowObserver?.observe(el)
  } else {
    rowEls.delete(fundId)
  }
}

onMounted(() => {
  if (!showsHoldingsColumns || typeof IntersectionObserver === 'undefined') return
  rowObserver = new IntersectionObserver(handleRowIntersect, {
    root: scrollContainerRef.value,
    rootMargin: '200px 0px', // prefetch a bit before the row is actually visible
    threshold: 0.01,
  })
  rowEls.forEach((el) => rowObserver.observe(el))
})

onUnmounted(() => {
  rowObserver?.disconnect()
  rowObserver = null
})

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
    <div ref="scrollContainerRef" class="fund-results-table overflow-x-auto max-h-[250px] overflow-y-auto relative ">
      <!-- Layout Fix: table-fixed กันคอลัมน์ "สั่น"/ไม่ตรงกับ sticky thead ทุกครั้งที่ sort/filter
           เปลี่ยน displayFunds (เดิม auto width คำนวณจากความยาว content ทุกแถว ทำให้ truncate
           max-w ใน <td> "กองทุน" ทำงานไม่ตรงกับความกว้างจริงของคอลัมน์) -->
      <table class="w-full text-left table-fixed">
        <!-- เพิ่ม sticky top-0 และพื้นหลังสีขาว (bg-white หรือสีที่ใช้) เพื่อให้หัวตารางติดขอบเวลาเลื่อน -->
        <thead class="sticky top-0 bg-[#f8fafc] z-10 shadow-sm">
          <tr>
            <th :class="type === 'offshore' || type === 'thai' ? 'w-[20%]' : 'w-[40%]'">กองทุน</th>

            <!-- แสดงทั้ง Thai Fund และ Offshore Fund -->
            <th v-if="type === 'offshore' || type === 'thai'" class="w-[13%]">หุ้นที่ถือเยอะ</th>
            <th v-if="type === 'offshore' || type === 'thai'" class="text-right w-[7%]">น้ำหนักรวม</th>

            <!-- นำ <th>บลจ.</th> ออกไปแล้ว -->

            <th class="w-[7%]">สิทธิภาษี</th>
            <th class="text-center sortable w-[8%]" @click="setSortLocal('minInvestment')">ขั้นต่ำ <span class="sort-arrow" :class="{ active: localSortKey === 'minInvestment' }">{{ sortIcon('minInvestment') }}</span></th>
            <th class="text-center sortable w-[8%]" @click="setSortLocal('nav')">NAV/หน่วย <span class="sort-arrow" :class="{ active: localSortKey === 'nav' }">{{ sortIcon('nav') }}</span></th>

            <th class="text-center sortable w-[7%]" @click="setSortLocal('risk')">ความเสี่ยง <span class="sort-arrow" :class="{ active: localSortKey === 'risk' }">{{ sortIcon('risk') }}</span></th>
            <th class="text-center sortable w-[8%]" @click="setSortLocal('perf')">ผลตอบแทน 1 ปี <span class="sort-arrow" :class="{ active: localSortKey === 'perf' }">{{ sortIcon('perf') }}</span></th>
            <th class="text-center sortable w-[6%]" @click="setSortLocal('sd')">SD <span class="sort-arrow" :class="{ active: localSortKey === 'sd' }">{{ sortIcon('sd') }}</span></th>
            <th class="text-center sortable w-[6%]" @click="setSortLocal('sharpe')">Sharpe <span class="sort-arrow" :class="{ active: localSortKey === 'sharpe' }">{{ sortIcon('sharpe') }}</span></th>
            <th class="text-center font-['Inter'] sub sortable w-[6%]" @click="setSortLocal('fee')">TER <span class="sort-arrow" :class="{ active: localSortKey === 'fee' }">{{ sortIcon('fee') }}</span></th>
            <th class="text-center w-[4%]"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="{ fund, badge, badgeCls, tickers, weight, taxBenefit, minInvestment } in tableRows" :key="fund.id">
            <tr :id="`fund-row-${fund.id}`" :ref="(el) => setRowRef(fund.id, el)" :data-fund-id="fund.id" class="fund-result-row" :class="{ selected: compareOrderOf(fund.id) > -1, expanded: expandedFundId === fund.id }" role="button" tabindex="0" :aria-expanded="expandedFundId === fund.id" @click="toggleDetails(fund.id)" @keydown.enter.prevent="toggleDetails(fund.id)" @keydown.space.prevent="toggleDetails(fund.id)">
              
              <!-- 1. กองทุน -->
              <td>
                <div class="flex items-center gap-2 min-w-0">
                  <!-- เปลี่ยนจาก toggleCompare เป็น handleToggleCompare -->
                  <button type="button" class="fund-row-plus" :class="{ active: compareOrderOf(fund.id) > -1 }" :aria-label="compareOrderOf(fund.id) > -1 ? `นำ ${fund.name} ออกจากการเปรียบเทียบ` : `เพิ่ม ${fund.name} เพื่อเปรียบเทียบ`" @click.stop="handleToggleCompare(fund.id)">{{ compareOrderOf(fund.id) > -1 ? '✓' : '+' }}</button>
                  <span class="fund-amc-mark" :class="badgeCls">{{ badge }}</span>
                  <div class="min-w-0">
                    <strong class="txt block truncate max-w-[190px]">{{ fund.name }}</strong>
                    <span class="block sub font-['Inter']" style="text-align: left; font-size:11px;">
                      {{ fund.id }}
                      <template v-if="type === 'feeder' && fund.masterFund"> · {{ fund.masterFund }}</template>
                    </span>
                  </div>
                  <button type="button" class="star ml-auto" :class="{ on: isWished(fund.id) }" :aria-label="isWished(fund.id) ? `นำ ${fund.name} ออกจาก wishlist` : `เพิ่ม ${fund.name} ไปยัง wishlist`" :aria-pressed="isWished(fund.id)" @click.stop="toggleWish(fund.id)">{{ isWished(fund.id) ? '★' : '☆' }}</button>
                </div>
              </td>
              
              <!-- 2. หุ้นที่ถือเยอะ (แสดงสำหรับ Thai และ Offshore) -->
              <td v-if="type === 'offshore' || type === 'thai'" class="sub max-w-[170px] truncate font-['Inter']" :title="tickers">{{ tickers }}</td>

              <!-- 3. น้ำหนักรวม (แสดงสำหรับ Thai และ Offshore) -->
              <td v-if="type === 'offshore' || type === 'thai'" class="text-center font-['Inter'] sub">{{ weight }}</td>

              <!-- นำ <td> ของ บลจ. ออกไปแล้ว -->

              <!-- 4. สิทธิภาษี -->
              <td class="sub">{{ taxBenefit }}</td>

              <!-- 5. ขั้นต่ำ -->
              <td class="text-center sub">{{ minInvestment }}</td>
              
              <!-- 6. NAV/หน่วย -->
              <td class="text-center font-['Inter'] sub">{{ fund.nav ? fund.nav.toFixed(4) : '-' }}</td>

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
              <td class="text-center font-['Inter'] sub">{{ fund.sharpe || '-' }}</td>

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
