<script setup>
import { computed } from 'vue'
import { useFundinfoRanking } from '../../composables/useFundinfoRanking'
import { formatPercent } from '../../utils/fundinfoFormat'
import { formatFlow } from '../../composables/useFundinfoThemeTrend'
import { COMPARE_COLORS } from '../../composables/useFundinfoInsight'

const props = defineProps({
  type: { type: String, default: 'offshore' },
})

const {
  accent,
  heading,
  itemLabel,
  stock,
  state,
  cards,
  stockCards,
  fundCards,
  selectedEntities,
  maxSelected,
  orderOf,
  select,
  clearSelection,
  setRank,
} = useFundinfoRanking(props.type)

const RANK_COLORS = ['#f0b429', '#94a3b8', '#c2793a']

const rankSections = computed(() => {
  if (!stock) {
    return [{ key: 'all', title: itemLabel.value, description: '', kind: 'fund', cards: cards.value }]
  }

  return [
    {
      key: 'stocks',
      title: props.type === 'thai' ? 'หุ้นไทย' : 'หุ้นต่างประเทศ',
      description: 'จัดอันดับหุ้นที่อยู่ใน Top Holdings ของกองทุนที่เลือก',
      kind: 'stock',
      cards: stockCards.value,
    },
    {
      key: 'funds',
      title: 'กองทุนที่เกี่ยวข้อง',
      description: 'จัดอันดับกองทุนจากข้อมูลผลตอบแทน กระแสเงิน และเงินปันผล',
      kind: 'fund',
      cards: fundCards.value,
    },
  ]
})

function countLabel(entity, section) {
  if (section.kind === 'stock') return `${entity.fundCount} กอง`
  return `${entity.fundCount} หุ้น`
}

function scrollToInsight() {
  document.getElementById(`insight-${props.type}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="ranking-workspace">
    <div class="ranking-heading">
      <h2>{{ heading }}</h2>
      <p>เลือกหุ้นและกองทุนจากแต่ละกลุ่มเพื่อเปรียบเทียบต่อในกราฟด้านล่าง</p>
    </div>

    <div v-for="section in rankSections" :key="section.key" class="ranking-section">
      <div class="ranking-section-heading">
        <div>
          <h3 :style="{ color: accent }">{{ section.title }}</h3>
          <p v-if="section.description">{{ section.description }}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <article v-for="card in section.cards" :key="card.key" class="ranking-card">
          <div class="ranking-card-header">
            <div class="ranking-card-title"><span>{{ card.emoji }}</span>{{ card.title }}</div>
            <p>{{ card.desc }}</p>
            <div v-if="card.pillKind" class="ranking-periods">
              <button
                v-for="[key, label] in card.pillOptions"
                :key="key"
                type="button"
                :class="{ active: state.rk[card.pillKind] === key }"
                :style="state.rk[card.pillKind] === key ? { background: accent } : {}"
                @click="setRank(card.pillKind, key)"
              >
                {{ label }}
              </button>
            </div>
          </div>

          <div class="ranking-card-list">
            <button
              v-for="(entity, index) in card.list.slice(0, 5)"
              :key="entity.id"
              type="button"
              class="ranking-row"
              :class="{ selected: orderOf(entity.id) > -1 }"
              @click="select(entity.id)"
            >
              <span class="ranking-number" :class="{ medal: index < 3 }" :style="index < 3 ? { background: RANK_COLORS[index] } : {}">{{ index + 1 }}</span>
              <span class="ranking-row-name" :title="entity.title">{{ entity.title }}</span>
              <strong v-if="card.valueType === 'count'">{{ countLabel(entity, section) }}</strong>
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
      <span>เลือกเพื่อเปรียบเทียบ <b :style="{ color: accent }">{{ selectedEntities.length }}/{{ maxSelected }}</b></span>
      <span class="ranking-summary-note">หุ้นจะอยู่ในกราฟหุ้น และกองทุนจะอยู่ในกราฟกองทุน</span>
      <button v-if="selectedEntities.length" type="button" @click="clearSelection">ล้างทั้งหมด</button>
      <button v-if="selectedEntities.length" type="button" class="ranking-view-chart" :style="{ background: accent }" @click="scrollToInsight">ดูกราฟเปรียบเทียบ</button>
    </div>
  </section>
</template>
