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
// Real-API-only: deriveScreenerTags() below reads each tag straight from the
// API-backed fund object. Several dimensions (FX hedging, geography,
// megatrend, style, investment style, size, min investment) have no
// equivalent field published by the API at all as of this writing — those
// come back null/[] rather than a fabricated guess, so filtering on them
// honestly returns no/fewer matches instead of matching fake data. The
// filter UI itself is unchanged; swap the null/[] fallback for a real field
// read the moment the backend adds one.
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

// Advanced filters below compare by id (the API's own UPPER_SNAKE_CASE enum
// string, mapped in fundinfoApi.js's mapEnum()) instead of matching a UI
// label against fund data — exact-match, so relabeling an option never
// breaks the filter, and a future backend enum addition just shows up as an
// unmatched chip rather than silently corrupting an existing one. A value
// the API doesn't publish for a given fund (null) simply excludes it from
// every chip, same as before — never guessed.
//
// Each list deliberately omits its enum's "no real signal" bucket as a
// selectable chip (nothing to search FOR): FX Hedging skips UNSPECIFIED/
// NOT_APPLICABLE, Megatrend skips BROAD_MARKET (means "no specific theme").
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
// Same underlying field (fund.managementStyle, from the API's
// management_style) powers both "Fund Style" (feeder/offshore) and
// "Investment Style" (thai/mixed) — one option list shared between them.
//
// Bug fix — DIVIDEND_FOCUSED describes the fund's stock-picking universe
// (invests in high dividend-yield stocks), not whether the fund itself pays
// out to unitholders — that's the separate, already-correct "นโยบายปันผล"
// filter (fund.dividendPolicy, from dividend_policy). Confirmed live: 13 of
// 43 TH DIVIDEND_FOCUSED-style funds have dividend_policy "ไม่จ่าย" (e.g.
// KFDIVRMF — an RMF, which by regulation can never distribute regardless of
// strategy). The original label "เน้นจ่ายปันผล (Dividend Focused)" read as a
// payout promise and collided with that filter's "จ่ายปันผล" option, so
// picking this chip alone looked like a bug when a non-paying RMF matched
// it. Reworded to name the strategy, not a payout outcome.
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

// อ่าน tag ของ "ตัวกรองขั้นสูง" จาก fund object ที่มาจาก API จริงเท่านั้น — ทุก dimension
// ด้านล่างตอนนี้มี field จริงรองรับแล้ว (2026-09-03) เป็นค่าเดียวต่อกอง (ไม่ใช่ array of tags)
// จึงเทียบแบบ "ค่าตรงกับตัวไหนใน id ที่เลือกไว้" — กองที่ backend ยังไม่มีค่า (null) จะไม่ match
// chip ไหนเลย ไม่ใช่การเดา
function deriveScreenerTags(fund) {
  if (tagCache.has(fund.id)) return tagCache.get(fund.id)

  // Real API fields (fund.stats, from sharpe_ratio_1y/std_1y/max_drawdown_1y
  // in fundinfoApi.js normalizeFund) — null when the API hasn't published a
  // value for this specific fund, never a fabricated number.
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

// A fund with no real minimum_initial_thb (value === null) never matches a
// selected bucket — excluded as unknown, same convention as the id filters
// above. max is exclusive (so 1000 lands in the "1,000-10,000" bucket, not
// "below 1,000") to keep buckets from double-counting their shared boundary.
function matchesMinInvestment(value, rangeId) {
  if (!rangeId) return true
  const range = MIN_INVESTMENT_OPTIONS.find((option) => option.value === rangeId)
  if (!range) return true
  if (value == null) return false
  if (range.min != null && value < range.min) return false
  if (range.max != null && value >= range.max) return false
  return true
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
      .filter(({ tags }) => !screener.fxHedging || tags.fxHedging === screener.fxHedging)
      // Bug fix — geography/megatrend/style/investmentStyle/size now have
      // real single-value API fields (see deriveScreenerTags): a fund
      // matches when no chip is selected, or its one real value is among the
      // selected ids. A fund the API hasn't classified (tag === null) still
      // never matches any chip — excluded as unknown, not guessed.
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
          // Bug fix — `null <= min` / `null >= min` coerce to `0`, so a fund
          // with no real sd/sharpe/maxDrawdown value used to silently pass
          // (or fail) every threshold instead of being excluded as unknown.
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