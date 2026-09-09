<!-- SearchFilterSection.vue -->
<script setup>
import { computed } from 'vue'
import { FUND_TYPES } from '../../data/fundinfoData'
import { useFundinfoScreener } from '../../composables/useFundinfoScreener'
import InfoTooltip from '../common/InfoTooltip.vue'

const props = defineProps({
  type: { type: String, default: 'offshore' },
})

const {
  state,
  amcOptions,
  screener,
  resultCount,
  maxCompare,
  usesInvestmentStyleFilters,
  taxBenefitOptions,
  dividendPolicyOptions,
  minInvestmentOptions,
  fxHedgingOptions,
  geographyOptions,
  megatrendOptions,
  styleOptions,
  investmentStyleOptions,
  sizeOptions,
  extraMetricOptions,
  toggleAdvanced,
  closeAdvanced,
  toggleGeography,
  toggleMegatrend,
  toggleStyle,
  setFxHedging,
  toggleInvestmentStyle,
  toggleSize,
  toggleExtraMetric,
  resetFilters,
} = useFundinfoScreener(props.type)

const title = computed(() => {
  if (props.type === 'feeder') return 'ค้นหาและคัดกรองกองทุนไทย'
  if (props.type === 'thai') return 'ค้นหาและคัดกรองกองทุนไทย'
  if (props.type === 'offshore') return 'ค้นหาและคัดกรองกองทุนต่างประเทศ'
  return `ค้นหาและคัดกรอง${FUND_TYPES[props.type]?.label || 'กองทุน'}`
})

const isMixed = computed(() => props.type === 'mixed')

function metricOption(key) {
  return extraMetricOptions.find((option) => option.key === key)
}

function handleReset() {
  resetFilters()
  state.selectedAmc = ''
  state.selectedRisk = ''
}

function scrollToCompare() {
  if (!screener.compareSelected.length) return
  document.getElementById(`fund-compare-${props.type}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function handleToggleAdvanced() {
  if (isMixed.value) return
  toggleAdvanced()
}
</script>

<template>
  <section class="screener-workspace">
    <header class="screener-heading">
      <h2>{{ title }}</h2>
      <button type="button" class="screener-compare-button" :disabled="!screener.compareSelected.length" @click="scrollToCompare">
        เปรียบเทียบกองที่เลือก ({{ screener.compareSelected.length }}/{{ maxCompare }})
      </button>
    </header>

    <div class="screener-search-row">
      <label class="screener-search-input">
        <span>⌕</span>
        <input v-model="state.search" type="search" placeholder="ค้นหาชื่อกองทุน / หุ้นที่ถือ (NVIDIA, Microsoft, PTT, ADVANC)" />
      </label>
      <span class="screener-count">พบ {{ resultCount }} กองทุน</span>
      <button
        v-if="!isMixed"
        type="button"
        class="screener-filter-toggle"
        :class="{ active: screener.advancedOpen }"
        @click="handleToggleAdvanced"
      >
        ตัวกรองเพิ่มเติม
      </button>
    </div>

    <div class="screener-filter-block">
      <div class="screener-filter-title">คัดกรองกองทุนที่ซื้อได้ <InfoTooltip text="กรองเฉพาะกองทุนไทยที่ถือหุ้นที่เลือก — ตัวเลขผลตอบแทนส่วนนี้เป็นของกองทุน" /></div>
      <div class="screener-select-grid">
        <label>สิทธิประโยชน์ภาษี
          <select v-model="screener.taxBenefit" class="filter-select"><option value="">ทั้งหมด</option><option v-for="option in taxBenefitOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
        </label>
        <label>บริษัทจัดการ (บลจ.)
          <select v-model="state.selectedAmc" class="filter-select"><option value="">ทั้งหมด</option><option v-for="amc in amcOptions" :key="amc" :value="amc">{{ amc }}</option></select>
        </label>
        <label>นโยบายปันผล
          <select v-model="screener.dividendPolicy" class="filter-select"><option value="">ทั้งหมด</option><option v-for="option in dividendPolicyOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
        </label>
        <label>เงินลงทุนขั้นต่ำ
          <select v-model="screener.minInvestment" class="filter-select"><option value="">ทั้งหมด</option><option v-for="option in minInvestmentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select>
        </label>
        <button type="button" class="screener-reset" @click="handleReset">รีเซ็ต</button>
      </div>

      <div class="screener-metric-row flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--line)] mt-3">
        <span class="text-[11px] font-bold sub">เพิ่มตัวกรองเมื่อจำเป็น:</span>
        <div v-for="option in extraMetricOptions" :key="option.key" class="flex items-center gap-1.5">
          <button
            type="button"
            class="px-3 py-1 rounded-full text-xs font-bold transition border"
            :class="screener.activeExtraMetrics.includes(option.key) || (screener.extraMetricMin[option.key] != null && screener.extraMetricMin[option.key] !== '') ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-2xs' : 'surf2 sub border-slate-200 dark:border-slate-700 hover:txt'"
            @click="toggleExtraMetric(option.key)"
          >
            ＋ {{ option.label }}
          </button>
          <select
            v-if="screener.activeExtraMetrics.includes(option.key)"
            v-model="screener.extraMetricMin[option.key]"
            class="filter-select w-auto text-xs rounded-lg p-1 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 txt outline-none"
          >
            <template v-if="option.key === 'perf'">
              <option value="">ทั้งหมด</option>
              <option :value="0">อย่างน้อย 0%</option>
              <option :value="5">อย่างน้อย 5%</option>
              <option :value="10">อย่างน้อย 10%</option>
              <option :value="20">อย่างน้อย 20%</option>
            </template>
            <template v-else-if="option.key === 'sd'">
              <option value="">ทั้งหมด</option>
              <option :value="10">ไม่เกิน 10%</option>
              <option :value="15">ไม่เกิน 15%</option>
              <option :value="20">ไม่เกิน 20%</option>
            </template>
            <template v-else-if="option.key === 'sharpe'">
              <option value="">ทั้งหมด</option>
              <option :value="0.5">อย่างน้อย 0.5</option>
              <option :value="1">อย่างน้อย 1.0</option>
            </template>
            <template v-else-if="option.key === 'maxDrawdown'">
              <option value="">ทั้งหมด</option>
              <option :value="10">ไม่เกิน 10%</option>
              <option :value="20">ไม่เกิน 20%</option>
              <option :value="30">ไม่เกิน 30%</option>
            </template>
          </select>
        </div>
      </div>
    </div>

    <div v-if="screener.advancedOpen && !isMixed" class="screener-advanced-panel">
      <div class="screener-advanced-head">
        <div>
          <h3>⚙ ตัวกรองเพิ่มเติม <InfoTooltip text="เลือกเงื่อนไขเพิ่มเพื่อคัดกรองกองทุนให้ตรงกับการลงทุน (เลือกได้หลายอัน)" /></h3>
        </div>
        <button type="button" class="screener-advanced-close" @click="closeAdvanced">ปิด ✕</button>
      </div>

      <div v-if="usesInvestmentStyleFilters" class="screener-advanced">
        <div>
          <h3>Investment Style</h3>
          <div class="screener-pills"><button v-for="option in investmentStyleOptions" :key="option" type="button" :class="{ active: screener.investmentStyle.includes(option) }" @click="toggleInvestmentStyle(option)">{{ option }}</button></div>
        </div>
        <div>
          <h3>Size & Characteristic</h3>
          <div class="screener-pills"><button v-for="option in sizeOptions" :key="option" type="button" :class="{ active: screener.sizeCharacteristic.includes(option) }" @click="toggleSize(option)">{{ option }}</button></div>
        </div>
      </div>

      <div v-else class="screener-advanced">
        <div>
          <h3>FX Hedging <small>(นโยบายป้องกันความเสี่ยงค่าเงิน)</small></h3>
          <div class="screener-pills"><button v-for="option in fxHedgingOptions" :key="option" type="button" :class="{ active: screener.fxHedging === option }" @click="setFxHedging(option)">{{ option }}</button></div>
        </div>
        <div>
          <h3>Geography <small>(ภูมิภาค/ประเทศ)</small></h3>
          <div class="screener-pills"><button v-for="option in geographyOptions" :key="option" type="button" :class="{ active: screener.geography.includes(option) }" @click="toggleGeography(option)">{{ option }}</button></div>
        </div>
        <div>
          <h3>Megatrends / Thematic</h3>
          <div class="screener-pills"><button v-for="option in megatrendOptions" :key="option" type="button" :class="{ active: screener.megatrend.includes(option) }" @click="toggleMegatrend(option)">{{ option }}</button></div>
        </div>
        <div>
          <h3>Fund Style</h3>
          <div class="screener-pills"><button v-for="option in styleOptions" :key="option" type="button" :class="{ active: screener.style.includes(option) }" @click="toggleStyle(option)">{{ option }}</button></div>
        </div>
      </div>
    </div>
  </section>
</template>