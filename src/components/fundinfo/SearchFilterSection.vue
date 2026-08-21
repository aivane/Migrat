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

      <div class="screener-metric-row">
        <span>เพิ่มตัวกรองเมื่อจำเป็น:</span>
        <button v-for="option in extraMetricOptions" :key="option.key" type="button" :class="{ active: screener.activeExtraMetrics.includes(option.key) }" @click="toggleExtraMetric(option.key)">+ {{ option.label }}</button>
      </div>

      <div v-if="screener.activeExtraMetrics.length" class="screener-metric-inputs">
        <label v-for="key in screener.activeExtraMetrics" :key="key">{{ metricOption(key).hint }}
          <input v-model.number="screener.extraMetricMin[key]" type="number" step="0.1" class="filter-select" placeholder="0" />
          <small>{{ metricOption(key).suffix }}</small>
        </label>
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