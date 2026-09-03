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

// Legacy advanced filters — feeder / offshore only, unchanged.
// fxHedging is now a real API-backed filter (fund.fxHedging, mapped to a
// stable id in fundinfoApi.js's mapFxHedging()) — compare by id, not label,
// so relabeling these options never breaks the filter. Funds with no FX
// exposure ('na') or an unrecognized raw value (null) simply don't match
// any of these chips, same as picking no filter shows everyone.
export const FX_HEDGING_OPTIONS = [
  { id: 'full', label: 'Fully Hedged (100%)' },
  { id: 'discretionary', label: 'ตามดุลยพินิจ' },
  { id: 'partial', label: 'บางส่วน' },
  { id: 'none', label: 'Unhedged (ไม่ป้องกัน)' },
]
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

const tagCache = new Map()

// อ่าน tag ของ "ตัวกรองขั้นสูง" จาก fund object ที่มาจาก API จริงเท่านั้น — มิติที่ API ยังไม่มี
// field รองรับเลย (fxHedging/geography/megatrend/style/investmentStyle/size/minInvestment) จะได้
// เป็น null/[] แทนการเดา ทำให้ filter เหล่านั้นกรองได้ตรงไปตรงมา (ไม่ match เลยถ้าไม่มีข้อมูลจริง)
// แทนที่จะโชว์ผลลัพธ์ปลอมๆ
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
    // legacy (feeder/offshore)
    fxHedging: fund.fxHedging ?? null, // real API field now — see fundinfoApi.js mapFxHedging()
    geography: fund.geography?.length ? fund.geography : [],
    megatrend: fund.megatrend?.length ? fund.megatrend : fund.themes?.length ? fund.themes : [],
    style: fund.style || null,
    // new (thai/mixed) — no real API field for either yet
    investmentStyle: fund.investmentStyle || null,
    size: fund.size || null,
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
      .filter(({ tags }) => !screener.fxHedging || tags.fxHedging === screener.fxHedging)
      // Bug fix — minInvestment/geography/megatrend/style/investmentStyle/
      // size have no real API field at all (see deriveScreenerTags), so
      // their tags are always null/[]. Filtering on them used to silently
      // exclude every fund the moment an option was picked (`null < x`
      // coerces to `0 < x`, `[].some(...)` is always false) — from the
      // user's perspective, selecting any of these wiped the whole list.
      // Left as a genuine no-op instead: the dropdown/chips stay fully
      // interactive (so the UI is untouched) but don't narrow results,
      // since there's no real data to narrow by yet. Swap back to an active
      // filter the moment normalizeFund() maps a real field for any of
      // these (fxHedging above already made that switch).
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