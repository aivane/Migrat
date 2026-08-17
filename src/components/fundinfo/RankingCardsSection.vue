<!-- RankingCardsSection.vue -->
<script setup>
import { computed } from 'vue'
import { useFundinfoRanking } from '../../composables/useFundinfoRanking'
import { formatPercent } from '../../utils/fundinfoFormat'
import { formatFlow } from '../../composables/useFundinfoThemeTrend'
import { COMPARE_COLORS } from '../../composables/useFundinfoInsight'
import InfoTooltip from '../common/InfoTooltip.vue'

const props = defineProps({ type: { type: String, default: 'offshore' } })
const { accent, heading, itemLabel, stock, state, cards, stockCards, fundCards, selectedEntities, maxSelected, orderOf, select, clearSelection, setRank } = useFundinfoRanking(props.type)
const RANK_COLORS = ['#f0b429', '#94a3b8', '#c2793a']

// มุมมอง "หุ้น" vs "กองทุนไทยที่ถือหุ้น" — เฉพาะแท็บที่เป็นหุ้น (Offshore/Thai)
// เก็บไว้บน state ตัวเดียวกับที่ useFundinfoRanking(type) cache ไว้ (singleton ต่อ type) เพื่อให้
// InsightCompareSection.vue ที่เรียก composable เดียวกันอ่านค่านี้ต่อได้ทันที โดยไม่ต้องแก้ composable
if (stock && state.rankView === undefined) state.rankView = 'stock'

const rankView = computed({
  get: () => state.rankView || 'stock',
  set: (value) => { state.rankView = value },
})

const stockViewLabel = computed(() => itemLabel.value)
const fundViewLabel = computed(() => (props.type === 'thai' ? 'กองทุนไทย' : 'กองทุนไทยถือหุ้นต่างประเทศ'))

// ชื่อการ์ดฝั่ง "กองทุน" ให้ตรงกับ mock (ตัดคำว่า "กองทุน" ที่ซ้ำซ้อนออกจากหัวการ์ดที่ composable ตั้งไว้)
const FUND_CARD_TITLES = {
  'fund-flow': 'เงินไหลเข้าสูงสุด',
  'fund-return': 'ผลตอบแทนสูงสุด',
  'fund-dividend': 'จ่ายปันผลสูงสุด',
}
function cardTitle(card) {
  return FUND_CARD_TITLES[card.key] || card.title
}

// แสดงทีละมุมมอง (หุ้น หรือ กองทุนไทยถือหุ้น) แทนการซ้อนสอง section เหมือนเดิม
const activeSection = computed(() => {
  if (!stock) return { key: 'all', title: itemLabel.value, description: '', kind: 'fund', cards: cards.value }
  if (rankView.value === 'fund') {
    return {
      key: 'funds',
      title: fundViewLabel.value,
      description: 'จัดอันดับกองทุนจากข้อมูลผลตอบแทน กระแสเงิน และเงินปันผล',
      kind: 'fund',
      cards: fundCards.value,
    }
  }
  return {
    key: 'stocks',
    title: stockViewLabel.value,
    description: 'จัดอันดับหุ้นที่อยู่ใน Top Holdings ของกองทุนที่เลือก',
    kind: 'stock',
    cards: stockCards.value,
  }
})

function setRankView(view) {
  rankView.value = view
}

function countLabel(entity, section) { return `${entity.fundCount} ${section.kind === 'stock' ? 'กอง' : 'หุ้น'}` }
function scrollToInsight() { document.getElementById(`insight-${props.type}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
</script>

<template>
  <section class="ranking-workspace">
    <div class="ranking-heading" :class="{ 'ranking-heading-switcher': stock }">
      <div>
        <h2>{{ heading }} <InfoTooltip :text="stock ? 'เลือกหุ้นหรือกองทุนเพื่อเปรียบเทียบผลตอบแทนแบบกราฟเดียวกัน จาก Ranking card' : 'เลือกกองทุนเพื่อเปรียบเทียบผลตอบแทนบนกราฟ จาก Ranking card'" /></h2>
      </div>
      <div v-if="stock" class="industry-switcher" aria-label="มุมมอง Ranking card">
        <span>มุมมอง:</span>
        <button type="button" :class="{ active: rankView === 'stock' }" @click="setRankView('stock')">{{ stockViewLabel }}</button>
        <button type="button" :class="{ active: rankView === 'fund' }" @click="setRankView('fund')">{{ fundViewLabel }}</button>
      </div>
    </div>

    <div class="ranking-section">
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 ml-4 md:ml-4">
        <article v-for="(card, cardIndex) in activeSection.cards" :key="card.key" class="ranking-card">
          <div class="ranking-card-header">
            <div class="ranking-card-title-button is-static">
              <span class="ranking-card-title"><span>{{ card.emoji }}</span>{{ cardTitle(card) }}</span>
            </div>
            <p>{{ card.desc }}</p>
            <small v-if="card.caption" class="ranking-card-caption">{{ card.caption }}</small>
            <div v-if="card.pillKind" class="ranking-periods">
              <button v-for="[key, label] in card.pillOptions" :key="key" type="button" :class="{ active: state.rk[card.pillKind] === key }" :style="state.rk[card.pillKind] === key ? { background: accent } : {}" @click="setRank(card.pillKind, key)">{{ label }}</button>
            </div>
          </div>
          <div class="ranking-card-list">
            <button v-for="(entity, index) in card.list.slice(0, 5)" :key="entity.id" type="button" class="ranking-row" :class="{ selected: orderOf(entity.id) > -1 }" @click="select(entity.id)">
              <span class="ranking-number" :class="{ medal: index < 3 }" :style="index < 3 ? { background: RANK_COLORS[index] } : {}">{{ index + 1 }}</span>
              <span class="ranking-row-name" :title="entity.title">{{ entity.title }}</span>
              <strong v-if="card.valueType === 'count'">{{ countLabel(entity, activeSection) }}</strong>
              <strong v-else-if="card.valueType === 'weight'">{{ entity.totalWeight.toFixed(1) }}%</strong>
              <strong v-else-if="card.valueType === 'percent'" :class="entity.retP[state.rk.ret] >= 0 ? 'text-pos' : 'text-neg'">{{ formatPercent(entity.retP[state.rk.ret], 1) }}</strong>
              <strong v-else-if="card.valueType === 'flow'" :class="entity.flowP[state.rk.flow] >= 0 ? 'text-pos' : 'text-neg'">{{ entity.flowP[state.rk.flow] > 0 ? '+' : '' }}฿{{ formatFlow(entity.flowP[state.rk.flow]) }}</strong>
              <strong v-else-if="card.valueType === 'dividend'" class="text-pos">{{ entity.div.toFixed(1) }}%</strong>
              <span v-if="orderOf(entity.id) > -1" class="select-order" :style="{ background: COMPARE_COLORS[orderOf(entity.id) % COMPARE_COLORS.length] }">{{ orderOf(entity.id) + 1 }}</span>
              <span v-else class="ranking-add">+</span>
            </button>
          </div>
        </article>
      </div>
    </div>

    <div class="ranking-summary">
  <!-- ฝั่งซ้าย: รวมข้อความกับปุ่มล้างทั้งหมดไว้ด้วยกัน -->
  <div class="ranking-summary-left">
    <span>เลือกเพื่อเปรียบเทียบ <b :style="{ color: accent }">{{ selectedEntities.length }}/{{ maxSelected }}</b></span>
    <span class="ranking-summary-note">จาก Ranking Card และลำดับเรียงตามที่เลือก</span>
    <button v-if="selectedEntities.length" type="button" class="btn-clear" @click="clearSelection">ล้างทั้งหมด</button>
  </div>

  <!-- ฝั่งขวา: ปุ่มดูกราฟ (เพิ่มลูกศรชี้ลง &darr;) -->
  <button v-if="selectedEntities.length" type="button" class="ranking-view-chart" :style="{ background: accent }" @click="scrollToInsight">
    ดูกราฟเปรียบเทียบ &darr;
  </button>
</div>
  </section>
</template>