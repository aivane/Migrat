// useFundinfoScreener.js
import { computed, reactive } from 'vue'
import { useFundinfoCategory, sortFundsBy } from './useFundinfoCategory'

// ==========================================================================
// Section ④ ค้นหาและคัดกรองกองทุน — Fund Screener. Layers advanced filters +
// compare-selection on top of useFundinfoCategory(type) (search/AMC/risk state
// stays there). Advanced panel differs by universe: feeder/offshore use FX
// Hedging/Geography/Megatrend/Fund Style; thai/mixed use Investment Style/Size
// (usesInvestmentStyleFilters picks which block renders; unused state just
// stays empty and harmless).
//
// deriveScreenerTags() reads tags from the real API fund object — dimensions
// with no backend field yet return null/[] instead of a guess, so those
// filters just return fewer matches rather than fabricate data.
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

// Filters compare by id (API's UPPER_SNAKE_CASE enum, see fundinfoApi.js
// mapEnum()) not by UI label, so relabeling never breaks matching and an
// unmapped value (null) just excludes the fund rather than being guessed.
//
// Lists omit each enum's "no signal" bucket as a chip: FX Hedging skips
// UNSPECIFIED/NOT_APPLICABLE, Megatrend skips BROAD_MARKET.
export const FX_HEDGING_OPTIONS = [
  { id: 'FULLY_HEDGED', label: 'ป้องกันความเสี่ยงเต็มจำนวน (Fully Hedged)' },
  { id: 'DISCRETIONARY', label: 'ตามดุลยพินิจผู้จัดการกองทุน' },
  { id: 'PARTIALLY_HEDGED', label: 'ป้องกันความเสี่ยงบางส่วน' },
  { id: 'UNHEDGED', label: 'ไม่ป้องกันความเสี่ยง (Unhedged)' },
]
export const GEOGRAPHY_OPTIONS = [
  { id: 'GLOBAL', label: 'ทั่วโลก (Global)' },
  { id: 'US', label: 'สหรัฐฯ (US)' },
  { id: 'CHINA', label: 'จีน (China)' },
  { id: 'JAPAN', label: 'ญี่ปุ่น (Japan)' },
  { id: 'INDIA', label: 'อินเดีย (India)' },
  { id: 'EUROPE', label: 'ยุโรป (Europe)' },
  { id: 'VIETNAM', label: 'เวียดนาม (Vietnam)' },
  { id: 'EMERGING_MARKETS', label: 'ตลาดเกิดใหม่ (Emerging Markets)' },
  { id: 'ASIA_PACIFIC', label: 'เอเชียแปซิฟิก (Asia Pacific)' },
]
export const MEGATREND_OPTIONS = [
  { id: 'TECHNOLOGY_AI', label: 'เทคโนโลยี / AI' },
  { id: 'COMMODITIES', label: 'ทองคำ / สินค้าโภคภัณฑ์' },
  { id: 'HIGH_DIVIDEND', label: 'หุ้นปันผลสูง' },
  { id: 'PROPERTY_INFRA', label: 'อสังหาริมทรัพย์ / โครงสร้างพื้นฐาน' },
  { id: 'HEALTHCARE_BIOTECH', label: 'สุขภาพ / เทคโนโลยีชีวภาพ' },
  { id: 'ESG_CLEAN_ENERGY', label: 'ESG / พลังงานสะอาด' },
  { id: 'CONSUMER_LIFESTYLE', label: 'สินค้าอุปโภคบริโภค / ไลฟ์สไตล์' },
  { id: 'FINTECH_FINANCE', label: 'ฟินเทค / การเงิน' },
]
// Same field (fund.managementStyle) powers both "Fund Style" (feeder/offshore)
// and "Investment Style" (thai/mixed) — one shared option list.
//
// DIVIDEND_FOCUSED describes the stock-picking universe, not payout — some
// RMFs match it despite dividendPolicy "ไม่จ่าย" (can't distribute by law), so
// the label was reworded off "เน้นจ่ายปันผล" to avoid implying a payout promise.
export const MANAGEMENT_STYLE_OPTIONS = [
  { id: 'ACTIVE', label: 'บริหารเชิงรุก (Active)' },
  { id: 'PASSIVE_INDEX', label: 'อิงดัชนี (Passive / Index)' },
  { id: 'DIVIDEND_FOCUSED', label: 'กองทุนปันผลสูง' },
]
export const STYLE_OPTIONS = MANAGEMENT_STYLE_OPTIONS

// New advanced filters — thai / mixed only.
export const INVESTMENT_STYLE_OPTIONS = MANAGEMENT_STYLE_OPTIONS
export const SIZE_OPTIONS = [
  { id: 'LARGE_CAP', label: 'หุ้นใหญ่ (Large-Cap)' },
  { id: 'MID_SMALL_CAP', label: 'หุ้นกลาง-เล็ก (Mid/Small-Cap)' },
  { id: 'ALL_CAP', label: 'ทุกขนาด (All-Cap)' },
]

export const EXTRA_METRIC_OPTIONS = [
  { key: 'perf', label: 'ผลตอบแทนกองทุน', suffix: '%', hint: 'ผลตอบแทนย้อนหลัง 1 ปี ไม่ต่ำกว่า' },
  { key: 'sd', label: 'SD', suffix: '%', hint: 'ความผันผวน (Standard Deviation) ไม่เกิน' },
  { key: 'sharpe', label: 'Sharpe Ratio', suffix: '', hint: 'ผลตอบแทนต่อความเสี่ยง ไม่ต่ำกว่า' },
  { key: 'maxDrawdown', label: 'Max Drawdown', suffix: '%', hint: 'ขาดทุนหนักสุดจากจุดสูงสุด ไม่เกิน (ใส่เป็นค่าบวก)' },
]

const tagCache = new Map()

// อ่าน tag ตัวกรองขั้นสูงจาก field จริงของ API (ค่าเดียวต่อกอง ไม่ใช่ array) — เทียบว่าค่าตรงกับ
// id ที่เลือกไว้หรือไม่ กองที่ backend ยังไม่มีค่า (null) จะไม่ match chip ไหนเลย ไม่ใช่การเดา
function deriveScreenerTags(fund) {
  if (tagCache.has(fund.id)) return tagCache.get(fund.id)

  // fund.stats (sharpe_ratio_1y/std_1y/max_drawdown_1y via normalizeFund) —
  // null when the API hasn't published a value, never a fabricated number.
  const sd = fund.stats?.sd ?? null
  const sharpe = fund.stats?.sharpe ?? null
  const maxDrawdown = fund.stats?.maxdd != null ? Math.abs(fund.stats.maxdd) : null

  // Real dividend_policy text ("จ่าย"/"ไม่จ่าย") when the API has it; null
  // (not a coin flip) for the small number of funds where it's blank.
  const dividendPolicy =
    fund.dividendPolicy === 'จ่าย' ? 'pay'
    : fund.dividendPolicy === 'ไม่จ่าย' ? 'accumulate'
    : null

  const tags = {
    taxBenefit: fund.taxBenefit || 'none',
    dividendPolicy,
    minInvestment: fund.minInvestment ?? null,
    // legacy (feeder/offshore) — real API fields, see fundinfoApi.js mapEnum()/normalizeFund()
    fxHedging: fund.fxHedging ?? null,
    geography: fund.geography ?? null,
    megatrend: fund.megatrend ?? null,
    style: fund.managementStyle ?? null,
    // new (thai/mixed) — same underlying field as `style` above
    investmentStyle: fund.managementStyle ?? null,
    size: fund.marketCapFocus ?? null,
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

// value === null never matches a bucket (excluded as unknown, same as id
// filters). max is exclusive so 1000 lands in "1,000-10,000", not "below 1,000".
function matchesMinInvestment(value, rangeId) {
  if (!rangeId) return true
  const range = MIN_INVESTMENT_OPTIONS.find((option) => option.value === rangeId)
  if (!range) return true
  if (value == null) return false
  if (range.min != null && value < range.min) return false
  if (range.max != null && value >= range.max) return false
  return true
}

// cache ต่อ type เหมือน useFundinfoCategory/useFundinfoRanking — ให้ทุกจุดที่อ่าน
// screener.compareSelected ของแท็บเดียวกันเห็น selection ชุดเดียวกันโดยไม่ต้องส่ง prop
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
      .filter(({ tags }) => !screener.fxHedging || tags.fxHedging === screener.fxHedging)
      // geography/megatrend/style/investmentStyle/size are real single-value
      // API fields — match when no chip is selected or the value is among
      // selected ids; unclassified funds (null) never match any chip.
      .filter(({ tags }) => !screener.geography.length || (tags.geography != null && screener.geography.includes(tags.geography)))
      .filter(({ tags }) => !screener.megatrend.length || (tags.megatrend != null && screener.megatrend.includes(tags.megatrend)))
      .filter(({ tags }) => !screener.style.length || (tags.style != null && screener.style.includes(tags.style)))
      .filter(({ tags }) => !screener.investmentStyle.length || (tags.investmentStyle != null && screener.investmentStyle.includes(tags.investmentStyle)))
      .filter(({ tags }) => !screener.sizeCharacteristic.length || (tags.size != null && screener.sizeCharacteristic.includes(tags.size)))
      // minInvestment is a real numeric field (minimum_initial_thb) matched
      // against the UI's range buckets rather than an exact id.
      .filter(({ tags }) => matchesMinInvestment(tags.minInvestment, screener.minInvestment))
      .filter(({ fund, tags }) =>
        screener.activeExtraMetrics.every((key) => {
          const min = screener.extraMetricMin[key]
          if (min === '' || min == null) return true
          if (key === 'perf') return fund.perf >= min
          const value = tags.metrics[key]
          // `null <= min`/`null >= min` coerce to 0, so a missing sd/sharpe/
          // maxDrawdown used to silently pass/fail instead of being excluded.
          if (value == null) return false
          if (key === 'maxDrawdown') return value <= min // ยิ่งน้อยยิ่งดี เลยกรองแบบ "ไม่เกิน"
          if (key === 'sd') return value <= min // ความผันผวน "ไม่เกิน"
          return value >= min // sharpe: "ไม่ต่ำกว่า"
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