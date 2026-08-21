// useFundinfoScreener.js
import { computed, reactive } from 'vue'
import { useFundinfoCategory, sortFundsBy } from './useFundinfoCategory'

// ==========================================================================
// Section ④ ค้นหาและคัดกรองกองทุน — "Fund Screener"
// Layers the richer search bar + advanced filter panel + compare-selection
// on top of useFundinfoCategory(type) instead of replacing it: the plain
// search/AMC/risk state used by the fund table still lives there (and is
// now cached per-type, see useFundinfoCategory.js), this composable just
// adds the extra screening criteria shown in the SearchFilterSection design.
//
// The advanced-filter panel differs by fund universe:
// - feeder / offshore (ลงทุนต่างประเทศ): FX Hedging / Geography / Megatrend / Fund Style
// - thai / mixed (ลงทุนหุ้นไทย): Investment Style / Size & Characteristic
// `usesInvestmentStyleFilters` tells the component which block to render;
// both sets of state/tags exist on every instance so switching is free and
// harmless (an unused set just stays empty and never filters anything).
//
// Thai fund data (fundinfoData.js) doesn't carry these screener tags yet, so
// they're derived deterministically per fund id (same seeded-hash approach
// used throughout the other useFundinfo* composables) rather than invented
// randomly on every render. Swap deriveScreenerTags() for real fields
// whenever the data layer grows them — everything downstream (filters,
// options, UI) reads through this one function.
// ==========================================================================

const MAX_COMPARE = 4
const THAI_STYLE_TYPES = ['thai', 'mixed']

export const TAX_BENEFIT_OPTIONS = [
  { value: 'ssf', label: 'SSF (กองทุนรวมเพื่อการออม)' },
  { value: 'rmf', label: 'RMF (กองทุนรวมเพื่อการเลี้ยงชีพ)' },
  { value: 'thaiesg', label: 'Thai ESG' },
  { value: 'none', label: 'ทั่วไป (ไม่ลดหย่อนภาษี)' },
]

export const DIVIDEND_POLICY_OPTIONS = [
  { value: 'pay', label: 'จ่ายปันผล' },
  { value: 'accumulate', label: 'สะสมมูลค่า (ไม่จ่ายปันผล)' },
]

export const MIN_INVESTMENT_OPTIONS = [
  { value: '0-1000', label: 'ต่ำกว่า 1,000 บาท', max: 1000 },
  { value: '1000-10000', label: '1,000 - 10,000 บาท', min: 1000, max: 10000 },
  { value: '10000-50000', label: '10,000 - 50,000 บาท', min: 10000, max: 50000 },
  { value: '50000+', label: 'มากกว่า 50,000 บาท', min: 50000 },
]

// Legacy advanced filters — feeder / offshore only, unchanged.
export const FX_HEDGING_OPTIONS = ['Fully Hedged (100%)', 'ตามดุลยพินิจ (บางส่วน)', 'Unhedged (ไม่ป้องกัน)']
export const GEOGRAPHY_OPTIONS = ['Global Equity', 'US Equity', 'China Equity', 'Europe', 'Asia ex-Japan', 'Emerging Markets']
export const MEGATREND_OPTIONS = ['Technology', 'AI & Robotics', 'Semiconductor', 'Healthcare', 'ESG / ยั่งยืน', 'Gold / Commodities']
export const STYLE_OPTIONS = ['Passive (ดัชนี)', 'Active (เชิงรุก)', 'Dividend (ปันผล)']

// New advanced filters — thai / mixed only.
export const INVESTMENT_STYLE_OPTIONS = [
  'Index / Passive (SET50/100)',
  'Active (เชิงรุก)',
  'High Dividend (SETHD)',
  'ESG / Thai ESG',
]
export const SIZE_OPTIONS = [
  'Large-Cap (ใหญ่)',
  'Mid/Small-Cap (เล็ก-กลาง)',
  'Value / ปันผล',
]

export const EXTRA_METRIC_OPTIONS = [
  { key: 'perf', label: 'ผลตอบแทนกองทุน', suffix: '%', hint: 'ผลตอบแทนย้อนหลัง 1 ปี ไม่ต่ำกว่า' },
  { key: 'sd', label: 'SD', suffix: '%', hint: 'ความผันผวน (Standard Deviation) ไม่เกิน' },
  { key: 'sharpe', label: 'Sharpe Ratio', suffix: '', hint: 'ผลตอบแทนต่อความเสี่ยง ไม่ต่ำกว่า' },
  { key: 'maxDrawdown', label: 'Max Drawdown', suffix: '%', hint: 'ขาดทุนหนักสุดจากจุดสูงสุด ไม่เกิน (ใส่เป็นค่าบวก)' },
]

const TAX_BENEFIT_SEEDS = ['none', 'none', 'ssf', 'rmf', 'thaiesg', 'none']
const MIN_INVESTMENT_SEEDS = [500, 1000, 1000, 5000, 10000, 50000]

function seedFromId(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 71)
}

const tagCache = new Map()

// เดารายละเอียด "ตัวกรองขั้นสูง" ที่ยังไม่มีในโครงสร้างข้อมูลกองทุนจริง แบบ deterministic ต่อกองทุน
// (id เดิม → ผลลัพธ์เดิมเสมอ) เพื่อให้ UI ใช้งานได้ทันทีโดยไม่ต้องแก้ fundinfoData.js ก่อน
function deriveScreenerTags(fund) {
  if (tagCache.has(fund.id)) return tagCache.get(fund.id)

  const seed = seedFromId(fund.id)
  const sd = fund.csvStats?.sd || +(6 + (seed % 14)).toFixed(1)
  const sharpe = fund.csvStats?.sharpe || +(((seed % 30) - 6) / 10).toFixed(2)
  const maxDrawdown = Math.abs(fund.csvStats?.maxDrawdown ?? fund.stats?.maxdd ?? +(8 + (seed % 20)).toFixed(1))

  const tags = {
    taxBenefit: fund.taxBenefit || TAX_BENEFIT_SEEDS[seed % TAX_BENEFIT_SEEDS.length],
    dividendPolicy: fund.div > 0 || seed % 3 === 0 ? 'pay' : 'accumulate',
    minInvestment: fund.minInvestment || MIN_INVESTMENT_SEEDS[seed % MIN_INVESTMENT_SEEDS.length],
    // legacy (feeder/offshore)
    fxHedging: fund.fxHedging || FX_HEDGING_OPTIONS[seed % FX_HEDGING_OPTIONS.length],
    geography: fund.geography?.length ? fund.geography : [GEOGRAPHY_OPTIONS[seed % GEOGRAPHY_OPTIONS.length]],
    megatrend: fund.megatrend?.length ? fund.megatrend : fund.themes?.length ? fund.themes : [MEGATREND_OPTIONS[(seed + 2) % MEGATREND_OPTIONS.length]],
    style: fund.style || STYLE_OPTIONS[(seed + 1) % STYLE_OPTIONS.length],
    // new (thai/mixed)
    investmentStyle: fund.investmentStyle || INVESTMENT_STYLE_OPTIONS[seed % INVESTMENT_STYLE_OPTIONS.length],
    size: fund.size || SIZE_OPTIONS[(seed + 2) % SIZE_OPTIONS.length],
    metrics: { sd, sharpe, maxDrawdown },
  }

  tagCache.set(fund.id, tags)
  return tags
}

function toggleInArray(arr, value) {
  const at = arr.indexOf(value)
  if (at > -1) arr.splice(at, 1)
  else arr.push(value)
}

// cache ต่อ type เหมือน useFundinfoCategory/useFundinfoRanking — เผื่ออนาคตมีมากกว่าหนึ่งจุด
// ที่ต้องอ่าน screener.compareSelected ของแท็บเดียวกัน (เช่น ปุ่ม "เปรียบเทียบกองที่เลือก" ที่ย้าย
// ไปอยู่ที่อื่น) จะได้เห็น selection ชุดเดียวกันโดยไม่ต้องส่ง prop ไปมา
const instances = new Map()

export function useFundinfoScreener(type = 'thai') {
  if (instances.has(type)) return instances.get(type)
  const instance = createFundinfoScreener(type)
  instances.set(type, instance)
  return instance
}

function createFundinfoScreener(type) {
  const base = useFundinfoCategory(type)
  const { state: baseState, filteredFunds } = base
  const usesInvestmentStyleFilters = THAI_STYLE_TYPES.includes(type)

  const screener = reactive({
    advancedOpen: false,
    taxBenefit: '',
    dividendPolicy: '',
    minInvestment: '',
    // legacy (feeder/offshore)
    fxHedging: '',
    geography: [],
    megatrend: [],
    style: [],
    // new (thai/mixed)
    investmentStyle: [],
    sizeCharacteristic: [],
    activeExtraMetrics: [],
    extraMetricMin: {},
    compareSelected: [],
  })

  const taggedFunds = computed(() => filteredFunds.value.map((fund) => ({ fund, tags: deriveScreenerTags(fund) })))

  const screenedFunds = computed(() =>
    taggedFunds.value
      .filter(({ tags }) => !screener.taxBenefit || tags.taxBenefit === screener.taxBenefit)
      .filter(({ tags }) => !screener.dividendPolicy || tags.dividendPolicy === screener.dividendPolicy)
      .filter(({ tags }) => {
        if (!screener.minInvestment) return true
        const opt = MIN_INVESTMENT_OPTIONS.find((o) => o.value === screener.minInvestment)
        if (!opt) return true
        if (opt.min != null && tags.minInvestment < opt.min) return false
        if (opt.max != null && tags.minInvestment > opt.max) return false
        return true
      })
      // legacy (no-op unless feeder/offshore UI populates these)
      .filter(({ tags }) => !screener.fxHedging || tags.fxHedging === screener.fxHedging)
      .filter(({ tags }) => !screener.geography.length || tags.geography.some((g) => screener.geography.includes(g)))
      .filter(({ tags }) => !screener.megatrend.length || tags.megatrend.some((m) => screener.megatrend.includes(m)))
      .filter(({ tags }) => !screener.style.length || screener.style.includes(tags.style))
      // new (no-op unless thai/mixed UI populates these)
      .filter(({ tags }) => !screener.investmentStyle.length || screener.investmentStyle.includes(tags.investmentStyle))
      .filter(({ tags }) => !screener.sizeCharacteristic.length || screener.sizeCharacteristic.includes(tags.size))
      .filter(({ fund, tags }) =>
        screener.activeExtraMetrics.every((key) => {
          const min = screener.extraMetricMin[key]
          if (min === '' || min == null) return true
          if (key === 'perf') return fund.perf >= min
          if (key === 'maxDrawdown') return tags.metrics.maxDrawdown <= min // ยิ่งน้อยยิ่งดี เลยกรองแบบ "ไม่เกิน"
          if (key === 'sd') return tags.metrics.sd <= min // ความผันผวน "ไม่เกิน"
          return tags.metrics[key] >= min // sharpe: "ไม่ต่ำกว่า"
        }),
      )
      .map(({ fund, tags }) => ({ ...fund, screenerTags: tags })),
  )

  const sortedScreenedFunds = computed(() => sortFundsBy(screenedFunds.value, baseState.sortBy, baseState.sortDir))

  const resultCount = computed(() => screenedFunds.value.length)

  const compareFunds = computed(() =>
    screener.compareSelected
      .map((id) => screenedFunds.value.find((f) => f.id === id) || base.funds.value.find((f) => f.id === id))
      .filter(Boolean),
  )

  function toggleAdvanced() {
    screener.advancedOpen = !screener.advancedOpen
  }

  function closeAdvanced() {
    screener.advancedOpen = false
  }

  // legacy (feeder/offshore)
  function toggleGeography(value) {
    toggleInArray(screener.geography, value)
  }

  function toggleMegatrend(value) {
    toggleInArray(screener.megatrend, value)
  }

  function toggleStyle(value) {
    toggleInArray(screener.style, value)
  }

  function setFxHedging(value) {
    screener.fxHedging = screener.fxHedging === value ? '' : value
  }

  // new (thai/mixed)
  function toggleInvestmentStyle(value) {
    toggleInArray(screener.investmentStyle, value)
  }

  function toggleSize(value) {
    toggleInArray(screener.sizeCharacteristic, value)
  }

  function toggleExtraMetric(key) {
    const at = screener.activeExtraMetrics.indexOf(key)
    if (at > -1) {
      screener.activeExtraMetrics.splice(at, 1)
      delete screener.extraMetricMin[key]
    } else {
      screener.activeExtraMetrics.push(key)
    }
  }

  function resetFilters() {
    screener.taxBenefit = ''
    screener.dividendPolicy = ''
    screener.minInvestment = ''
    screener.fxHedging = ''
    screener.geography = []
    screener.megatrend = []
    screener.style = []
    screener.investmentStyle = []
    screener.sizeCharacteristic = []
    screener.activeExtraMetrics = []
    screener.extraMetricMin = {}
  }

  function toggleCompare(id) {
    const at = screener.compareSelected.indexOf(id)
    if (at > -1) {
      screener.compareSelected.splice(at, 1)
    } else if (screener.compareSelected.length < MAX_COMPARE) {
      screener.compareSelected.push(id)
    }
  }

  function compareOrderOf(id) {
    return screener.compareSelected.indexOf(id)
  }

  function clearCompare() {
    screener.compareSelected = []
  }

  return {
    ...base,
    screener,
    screenedFunds,
    sortedScreenedFunds,
    resultCount,
    compareFunds,
    maxCompare: MAX_COMPARE,
    usesInvestmentStyleFilters,
    taxBenefitOptions: TAX_BENEFIT_OPTIONS,
    dividendPolicyOptions: DIVIDEND_POLICY_OPTIONS,
    minInvestmentOptions: MIN_INVESTMENT_OPTIONS,
    fxHedgingOptions: FX_HEDGING_OPTIONS,
    geographyOptions: GEOGRAPHY_OPTIONS,
    megatrendOptions: MEGATREND_OPTIONS,
    styleOptions: STYLE_OPTIONS,
    investmentStyleOptions: INVESTMENT_STYLE_OPTIONS,
    sizeOptions: SIZE_OPTIONS,
    extraMetricOptions: EXTRA_METRIC_OPTIONS,
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
    toggleCompare,
    compareOrderOf,
    clearCompare,
  }
}