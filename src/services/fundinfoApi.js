import { reconGet, wpGet } from './apiClient'
import { FUND_TYPES } from '../data/fundinfoConstants'

// Input Validation — whitelist enums/patterns, reused by router guards & stores.
export const VALID_FUND_TYPES = Object.freeze(Object.keys(FUND_TYPES))
// API Contract — share classes such as K-GDBOND-A(A), SCBS&P500, and KKP GNP
// are valid. The service applies encodeURIComponent before path interpolation.
// Keep the route whitelist narrow: no slashes, quotes, percent signs, or controls.
export const FUND_ID_PATTERN = /^[A-Za-z0-9()& _-]{1,64}$/
export const VALID_STOCK_MARKETS = Object.freeze(['TH', 'FOREIGN'])
export const VALID_ALLOCATION_TYPES = Object.freeze(['ASSET_CLASS', 'SECTOR', 'REGIONAL'])
// Allows `/` — confirmed live that 3 of 34 real theme ids contain it (e.g.
// "global_bond_fully_f/x_hedge", from "F/X" in the label). theme_id is only
// ever sent as a query-param value (never a URL path segment, never CSV-
// joined on anything but comma), so `/` is safe here.
export const THEME_ID_PATTERN = /^[a-z0-9_/-]{1,64}$/

// API Data Quality — screener filter dimensions the API added after the
// mock-removal audit (context.md §3 originally listed these as fully
// missing). Confirmed live 2026-09-03 that all five now ship as stable
// UPPER_SNAKE_CASE enums, 100% populated across feeder/offshore/thai. Store
// the backend's own enum string as the id (no hand-translated lookup table)
// so a future backend rename fails loud (mapEnum returns null, filter goes
// no-op safely) instead of silently mismatching like the old Thai-sentence
// `FX_HEDGING_MAP` did when the API swapped `fx_hedging` from free text to
// this same enum shape without warning.
// Bug fix — re-verified live 2026-09-08: the backend renamed 3 of these enum
// strings again since the 2026-09-03 audit above (same "flapping" pattern the
// FX Hedging alias already guards against), silently zeroing out 3 screener
// chips (ทองคำ/สินค้าโภคภัณฑ์, สุขภาพ, เอเชีย(ไม่รวมญี่ปุ่น)) even though funds
// tagged with the real values existed all along:
//   thematic_category: 'COMMODITIES_GOLD' -> 'COMMODITIES', 'HEALTHCARE' -> 'HEALTHCARE_BIOTECH'
//   geographic_focus: 'ASIA_EX_JAPAN' -> 'ASIA_PACIFIC'
// Also added 2 new thematic values the backend now ships with real funds
// behind them (11-19 each) that had no matching chip before at all:
// 'CONSUMER_LIFESTYLE', 'FINTECH_FINANCE'.
const FX_HEDGING_VALUES = new Set(['FULLY_HEDGED', 'DISCRETIONARY', 'PARTIALLY_HEDGED', 'UNHEDGED', 'UNSPECIFIED', 'NOT_APPLICABLE'])
const GEOGRAPHY_VALUES = new Set(['GLOBAL', 'US', 'JAPAN', 'CHINA', 'VIETNAM', 'INDIA', 'EUROPE', 'EMERGING_MARKETS', 'ASIA_PACIFIC', 'THAILAND'])
const THEMATIC_VALUES = new Set(['BROAD_MARKET', 'TECHNOLOGY_AI', 'COMMODITIES', 'HIGH_DIVIDEND', 'PROPERTY_INFRA', 'HEALTHCARE_BIOTECH', 'ESG_CLEAN_ENERGY', 'CONSUMER_LIFESTYLE', 'FINTECH_FINANCE'])
const MANAGEMENT_STYLE_VALUES = new Set(['ACTIVE', 'PASSIVE_INDEX', 'DIVIDEND_FOCUSED'])
const MARKET_CAP_VALUES = new Set(['ALL_CAP', 'MID_SMALL_CAP', 'LARGE_CAP'])

function mapEnum(raw, validValues) {
  const text = safeText(raw, 64).toUpperCase()
  return validValues.has(text) ? text : null
}

// API Contract — `fx_hedge_policy` is the documented field; `fx_hedging` was
// briefly a raw Thai sentence, vanished, then came back as an exact alias of
// fx_hedge_policy (same enum values) — prefer the documented name, fall back
// to the alias so this survives either one disappearing again.
function mapFxHedging(record) {
  return mapEnum(record.fx_hedge_policy ?? record.fx_hedging, FX_HEDGING_VALUES)
}

const API_LIST_LIMIT = 1000
const MAX_TEXT_LENGTH = 300
const MAX_HOLDINGS = 20
const MAX_ALLOCATIONS = 30
const MIXED_CATEGORY_PATTERN = /mixed|allocation|balanced|multi[- ]?asset|ผสม|จัดสรร/i
const THAI_EQUITY_CATEGORY_PATTERN = /thai equity|equity|หุ้น/i

const DIRECT_LIST_PARAMS = Object.freeze({
  // API Contract — Thai feeder funds are categorised under FOREIGN market_type.
  feeder: Object.freeze({ market_type: 'FOREIGN', is_feeder_fund: 1 }),
  offshore: Object.freeze({ market_type: 'FOREIGN', is_feeder_fund: 0 }),
  // Bug fix — do not filter by is_feeder_fund here: confirmed live that it's
  // unreliable under market_type TH (see inferFundType() above), so an
  // is_feeder_fund:0 param here server-side-excluded 839 real domestic funds
  // before isFundInType() ever got a chance to classify them correctly.
  // Fetch every TH-market record and let isFundInType() (category-text based,
  // not flag based) sort thai vs mixed vs neither.
  thai: Object.freeze({ market_type: 'TH' }),
  mixed: Object.freeze({ market_type: 'TH' }),
})

export function isValidFundType(type) {
  return typeof type === 'string' && VALID_FUND_TYPES.includes(type)
}

export function isValidFundId(id) {
  return typeof id === 'string' && FUND_ID_PATTERN.test(id)
}

export function isValidStockMarket(marketType) {
  return typeof marketType === 'string' && VALID_STOCK_MARKETS.includes(marketType)
}

export function isValidAllocationType(allocationType) {
  return typeof allocationType === 'string' && VALID_ALLOCATION_TYPES.includes(allocationType)
}

export function isValidThemeId(themeId) {
  return typeof themeId === 'string' && THEME_ID_PATTERN.test(themeId)
}

// Feature switch — direct mode targets the supplied Mutual Fund Data API;
// wordpress routes the same real backend through admin-ajax.php. No mock
// mode: local fabricated fund data was removed, this feature is real-API-only.
export const fundinfoApiMode = import.meta.env.VITE_FUNDINFO_API_MODE || 'direct'

function toSafeError(fallbackMessage) {
  // Error Handling — never propagate backend payloads, Axios objects, or stack traces to UI/state.
  return new Error(fallbackMessage)
}

function isRecord(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function safeText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') return ''

  // Anti-XSS — preserve plain text only; components must continue using {{ }} rather than v-html.
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength)
}

function safeHttpsUrl(value) {
  const url = safeText(value, 2048)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.href : '' // Anti-XSS — block javascript:, data:, and mixed-content URLs.
  } catch {
    return ''
  }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function optionalNumber(value) {
  // Bug fix: `Number(null) === 0` and `Number.isFinite(0) === true`, so a
  // bare `Number(value)` coercion silently turned every explicit API `null`
  // (very common — pe_ratio/pb_ratio/max_drawdown_*/front_end_fee etc. are
  // frequently null) into 0, misrepresenting "no data" as "genuinely zero"
  // everywhere this feeds a `??` fallback or a `!= null` display check.
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function safePercent(value, fallback = 0) {
  return Math.min(Math.max(safeNumber(value, fallback), -100000), 100000)
}

function rounded(value, decimals = 2) {
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

// Bug fix — categoryAvg (เฉลี่ยกลุ่ม) below used to pass the API's raw float
// straight through optionalNumber() with no rounding at all (e.g.
// category_avg_return_3m: 0.700666 rendered as "+0.700666%"), unlike every
// other percent field in this file which goes through rounded(). Null-safe
// wrapper so "no data" (null) doesn't get coerced into 0 by rounding it.
function optionalRounded(value, decimals = 2) {
  const number = optionalNumber(value)
  return number == null ? null : rounded(number, decimals)
}

function asFlag(value) {
  return value === true || value === 1 || value === '1'
}

function categoryText(record) {
  return [
    record?.aimc_category_name_en,
    record?.aimc_category_name_th,
    record?.aimc_broad_category_name_en,
    record?.aimc_broad_category_name_th,
  ]
    .map((value) => safeText(value))
    .filter(Boolean)
    .join(' ')
}

// Bug fix — `is_feeder_fund` is unreliable under market_type TH: confirmed
// live 2026-09-03 that 839 domestic-only funds (categories "Equity Large
// Cap"/"Equity General"/"SET 50 Index Fund"/allocation funds — e.g.
// K-EQUITY, K-SET50, ES-SET50-A) are flagged is_feeder_fund=1 despite never
// routing through a foreign master fund, which used to make inferFundType()
// call every one of them 'feeder' and drop them out of both the Thai and
// Mixed catalogs entirely (they never surfaced in either tab, or in any
// screener/exposure view scoped to those types). Real feeder funds are, by
// this API's own convention (see DIRECT_LIST_PARAMS below), always under
// market_type FOREIGN — so only trust is_feeder_fund there.
function inferFundType(record) {
  const marketType = safeText(record?.market_type).toUpperCase()
  if (asFlag(record?.is_feeder_fund) && marketType === 'FOREIGN') return 'feeder'
  if (marketType === 'FOREIGN') return 'offshore'
  if (MIXED_CATEGORY_PATTERN.test(categoryText(record))) return 'mixed'
  return 'thai'
}

function isFundInType(record, type) {
  if (!isRecord(record)) return false
  const inferredType = inferFundType(record)

  if (type === 'thai') {
    return inferredType === 'thai' && THAI_EQUITY_CATEGORY_PATTERN.test(categoryText(record))
  }

  return inferredType === type
}

function mapHoldings(holdings) {
  if (!Array.isArray(holdings)) return []

  return holdings.slice(0, MAX_HOLDINGS).flatMap((holding) => {
    if (!isRecord(holding)) return []

    const name = safeText(holding.clean_holding_name || holding.raw_holding_name || holding.stock_symbol)
    if (!name) return []

    // API Contract — try multiple field names; different API versions may use different keys.
    const rawPercent =
      holding.holding_percent ??
      holding.percent ??
      holding.weight ??
      holding.portfolio_percent ??
      holding.net_asset_percent ??
      0

    return [{ name, percent: rounded(safePercent(rawPercent)) }]
  })
}

function mapAllocations(allocations) {
  if (!Array.isArray(allocations)) return []

  return allocations.slice(0, MAX_ALLOCATIONS).flatMap((allocation) => {
    if (!isRecord(allocation)) return []

    const name = safeText(allocation.name)
    if (!name) return []

    const allocationType = safeText(allocation.allocation_type, 32).toUpperCase()
    if (!['ASSET_CLASS', 'SECTOR', 'REGIONAL'].includes(allocationType)) return []

    return [{ allocationType, name, percent: rounded(safePercent(allocation.percent)) }]
  })
}

function allocationsOfType(allocations, allocationType) {
  return allocations
    .filter((allocation) => allocation.allocationType === allocationType)
    .map(({ name, percent }) => ({ name, percent }))
}

// API Contract — fund_tax_type is real (RMF/SSF/TESG/TESGX), just bucketed
// into the app's existing SSF/RMF/Thai ESG/none categories.
function mapTaxBenefit(record) {
  const type = safeText(record.fund_tax_type, 16).toUpperCase()
  if (type === 'RMF') return 'rmf'
  if (type === 'SSF') return 'ssf'
  if (type === 'TESG' || type === 'TESGX') return 'thaiesg'
  return 'none'
}

function safeIsoDate(value) {
  const date = safeText(value, 32)
  return /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?$/.test(date) ? date.slice(0, 10) : ''
}

function normalizeFund(record, requestedType, details = {}) {
  if (!isRecord(record)) return null

  const id = safeText(record.fund_code, 32)
  if (!isValidFundId(id)) return null

  const category = categoryText(record)
  const marketType = safeText(record.market_type).toUpperCase()
  const allocations = mapAllocations(details.allocations)
  const assetAllocation = allocationsOfType(allocations, 'ASSET_CLASS')
  const sectorAllocation = allocationsOfType(allocations, 'SECTOR')
  const regionalAllocation = allocationsOfType(allocations, 'REGIONAL')
  const type = isValidFundType(requestedType) ? requestedType : inferFundType(record)
  const return1y = rounded(safePercent(record.return_1y))
  const return3y = rounded(safePercent(record.return_3y))
  const return5y = rounded(safePercent(record.return_5y))
  const return10y = rounded(safePercent(record.return_10y))
  const flow1m = rounded(safeNumber(record.estimated_flow_1m_m_thb))
  const flow1y = rounded(safeNumber(record.estimated_flow_1y_m_thb))
  const expenseRatio = safeNumber(record.expense_ratio, safeNumber(record.management_fee))
  const maxDrawdown = optionalRounded(record.max_drawdown_1y) ?? optionalRounded(record.max_drawdown_3y)
  const amc = safeText(record.amc_name)
  const master = safeText(record.main_feeder_fund) || safeText(record.aimc_category_name_en) || category || id
  const themes = [safeText(record.aimc_broad_category_name_th), safeText(record.aimc_category_name_th), marketType]
    .filter(Boolean)
    .slice(0, 3)

  return {
    id,
    type,
    name: safeText(record.fund_name_th || record.fund_name_en || record.fund_code),
    amc,
    // UI Adapter — preserve the legacy presentation contract without changing components.
    amcCode: safeText(amc.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()) || 'FI',
    amcShort: amc,
    risk: Math.min(Math.max(Math.round(safeNumber(record.risk_level)), 0), 8),
    fee: rounded(expenseRatio),
    div: rounded(safePercent(record.dividend_yield)),
    dividendPolicy: safeText(record.dividend_policy),
    fxHedging: mapFxHedging(record),
    // Screener dimensions — real enums as of 2026-09-03 (see mapEnum above).
    // One value per fund (not a tag list), so screener filters match by
    // membership in the user's selected id set, not array overlap.
    geography: mapEnum(record.geographic_focus, GEOGRAPHY_VALUES),
    megatrend: mapEnum(record.thematic_category, THEMATIC_VALUES),
    managementStyle: mapEnum(record.management_style, MANAGEMENT_STYLE_VALUES),
    marketCapFocus: mapEnum(record.market_cap_focus, MARKET_CAP_VALUES),
    minInvestment: optionalNumber(record.minimum_initial_thb),
    hasDividend: asFlag(record.has_dividend),
    master,
    masterFund: master,
    country: marketType || category,
    group: category || marketType,
    asset: assetAllocation,
    mix: type === 'mixed' ? assetAllocation : [],
    sectorMix: sectorAllocation,
    countryAllocation: regionalAllocation,
    top5: mapHoldings(details.top_holdings),
    themes,
    netbuy: flow1m,
    perf: return1y,
    pop: 0, // Popularity is not supplied by the API; do not fabricate analytics.
    aum: rounded(safeNumber(record.aum_m_thb)),
    nav: rounded(safeNumber(record.nav ?? record.nav_value)),
    navDate: safeText(record.nav_date, 32),
    // API Data Quality — this field looks broken upstream as of this writing
    // (seen +126.72% on an equity feeder, +19.99% on a low-vol bond fund —
    // consistent with being computed against inception NAV, not the previous
    // day). Kept for completeness/debugging only; don't display it as a
    // "daily change" — derive that from nav-history instead (see
    // useFundAnalytics.js dailyChange usage in FundInfoDetailView.vue).
    navChangePct1d: optionalNumber(record.nav_change_pct_1d),
    inceptionDate: safeIsoDate(record.inception_date),
    factSheetUrl: safeHttpsUrl(record.fund_fact_sheet),
    isFeederFund: asFlag(record.is_feeder_fund),
    isEtf: asFlag(record.is_etf),
    taxBenefit: mapTaxBenefit(record),
    // Bug fix — m6 (return_6m) added: FundPerformancePanel.vue's "6 เดือน" row
    // used to fabricate this as y1*0.6 because retP had no real slot for it,
    // even though the API has published return_6m all along.
    retP: { m1: rounded(safePercent(record.return_1m)), q1: rounded(safePercent(record.return_3m)), m6: rounded(safePercent(record.return_6m)), y1: return1y, y3: return3y, y5: return5y, y10: return10y },
    // Distinct from retP above — retP defaults a missing period to 0% for safe
    // display everywhere else. Anything that needs to tell "genuinely 0%
    // return" apart from "no data for this period" (e.g. building a real
    // checkpoint chart) must read this instead, never retP.
    retPRaw: {
      m1: optionalNumber(record.return_1m),
      q1: optionalNumber(record.return_3m),
      m6: optionalNumber(record.return_6m),
      y1: optionalNumber(record.return_1y),
      y3: optionalNumber(record.return_3y),
      y5: optionalNumber(record.return_5y),
      y10: optionalNumber(record.return_10y),
    },
    // API Data Quality — there is no estimated_flow_1w_m_thb from this API,
    // only 1m/1y. unit_change_1w is a % unit-price change (a completely
    // different unit from the THB-millions m1/y1 below) — never substitute
    // it here, it previously showed e.g. "-1 ลบ." for a -1.1% price move.
    flowP: { w1: null, m1: flow1m, y1: flow1y },
    managementFee: optionalNumber(record.management_fee),
    frontEndFee: optionalNumber(record.front_end_fee),
    backEndFee: optionalNumber(record.back_end_fee),
    maxFrontEndFee: optionalNumber(record.max_front_end_fee),
    maxBackEndFee: optionalNumber(record.max_back_end_fee),
    sharpe: optionalNumber(record.sharpe_ratio_1y),
    drawdown: maxDrawdown === null ? '-' : `${rounded(maxDrawdown)}%`,
    // Benchmark/alpha/beta — the API attaches these to the fund's own AIMC
    // category, not a market index feed. peRatio/pbRatio exist in the schema
    // but are still null for every fund observed so far — kept null-aware
    // (optionalNumber) rather than defaulted, so UI can tell "not disclosed
    // yet" apart from "genuinely zero".
    benchmarkName: safeText(record.benchmark_name, 120),
    benchmarkReturn1y: optionalNumber(record.benchmark_return_1y ?? record.category_avg_return_1y),
    alpha: optionalNumber(record.alpha_1y),
    beta: optionalNumber(record.beta_1y),
    peRatio: optionalNumber(record.pe_ratio),
    pbRatio: optionalNumber(record.pb_ratio),
    stats: {
      sharpe: optionalRounded(record.sharpe_ratio_1y),
      sd: optionalRounded(record.std_1y),
      maxdd: maxDrawdown,
    },
    // Bug fix — the risk-metric table (FundPerformancePanel.vue) used to
    // fabricate every period (3M/6M/1Y/3Y/5Y/10Y) by multiplying `stats`
    // above by a hardcoded per-period ratio table ("mock illustrative
    // figures only", per its own comment) even in direct mode. The API only
    // ever publishes 1Y (stats above) and 3Y (here) period-specific figures
    // — no 3M/6M/5Y/10Y equivalent exists for SD/Sharpe/MaxDrawdown at all,
    // so those periods have no real replacement and are dropped, not faked.
    stats3y: {
      sharpe: optionalRounded(record.sharpe_ratio_3y),
      sd: optionalRounded(record.std_3y),
      maxdd: optionalRounded(record.max_drawdown_3y),
    },
    // Real peer/category averages the API publishes — used to replace the
    // "เฉลี่ยกลุ่ม" (group average) column, which used to be either a mock
    // formula (mock mode) or silently `null` -> blank "%" (direct mode, see
    // useFundAnalytics.js groupAverage). Only these periods exist: no 3Y/5Y/
    // 10Y peer-return average, and no peer SD at all.
    categoryAvg: {
      return3m: optionalRounded(record.category_avg_return_3m),
      return6m: optionalRounded(record.category_avg_return_6m),
      return1y: optionalRounded(record.category_avg_return_1y),
      sharpe1y: optionalRounded(record.category_avg_sharpe_1y),
      maxdd1y: optionalRounded(record.category_avg_max_drawdown_1y),
    },
  }
}

function extractFundList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.funds)) return payload.funds
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

function mapTopHoldingFundCodes(value) {
  if (!Array.isArray(value)) return []

  // Anti-XSS — these are public fund codes only; retain plain, bounded text
  // so composables can join rankings to the already-sanitized fund list.
  return value
    .slice(0, 100)
    .map((code) => safeText(code, 64))
    .filter(Boolean)
}

function mapTopStock(record) {
  if (!isRecord(record)) return null

  const symbol = safeText(record.stock_symbol, 32)
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(symbol)) return null

  const name = safeText(record.stock_name || symbol)
  const fundCount = Math.max(0, Math.min(Math.round(safeNumber(record.holding_funds_count)), 1000000))
  const totalHoldingValueMThb = Math.max(0, rounded(safeNumber(record.total_holding_value_m_thb)))
  const avgHoldingWeight = Math.max(0, rounded(safeNumber(record.avg_holding_weight)))
  const maxHoldingWeight = Math.max(0, rounded(safeNumber(record.max_holding_weight)))

  return {
    symbol,
    name,
    marketType: safeText(record.market_type, 16).toUpperCase(),
    industry: safeText(record.industry, 80),
    sector: safeText(record.sector, 80),
    return1m: optionalNumber(record.return_1m),
    return1y: optionalNumber(record.return_1y),
    fundCount,
    totalHoldingValueMThb,
    avgHoldingWeight,
    maxHoldingWeight,
    // API Contract — the API supplies only a capped list of holders. Keep it
    // separate from `fundCount`, which remains the API's full aggregate count.
    topHoldingFundCodes: mapTopHoldingFundCodes(record.top_holding_funds),
  }
}

function mapPortfolioAllocation(record) {
  if (!isRecord(record)) return null

  const allocationType = safeText(record.allocation_type, 32).toUpperCase()
  if (!isValidAllocationType(allocationType)) return null

  const name = safeText(record.name)
  if (!name) return null

  const color = safeText(record.color, 16)
  return {
    allocationType,
    name,
    // Anti-XSS — accept only CSS hex colours supplied by the API; components
    // must not interpolate arbitrary values into inline style attributes.
    color: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '',
    avgPercent: rounded(safePercent(record.avg_percent)),
    weightedPercent: rounded(safePercent(record.weighted_percent)),
    fundsCount: Math.max(0, Math.min(Math.round(safeNumber(record.funds_count)), 1000000)),
  }
}

// Bug fix — this read record.icon/master_fund/sample_symbols, which never
// exist on a real /insights/themes record (verified live across all 34
// themes, v1/v2 identical schema) — those three always came out blank/[].
// Meanwhile the real payload's theme_name/funds_count/total_aum_m_thb/
// avg_return_1m/avg_return_1y were silently dropped entirely. Read the
// fields the API actually sends instead of the ones a stale schema assumed.
function mapTheme(record) {
  if (!isRecord(record)) return null

  const id = safeText(record.id, 64).toLowerCase()
  if (!isValidThemeId(id)) return null

  const label = safeText(record.label || record.theme_name, 120)
  if (!label) return null

  return {
    id,
    label,
    fundsCount: Math.max(0, Math.min(Math.round(safeNumber(record.funds_count)), 1000000)),
    totalAumMThb: Math.max(0, rounded(safeNumber(record.total_aum_m_thb))),
    avgReturn1m: optionalNumber(record.avg_return_1m),
    avgReturn1y: optionalNumber(record.avg_return_1y),
  }
}

function extractThemes(payload) {
  if (Array.isArray(payload?.themes)) return payload.themes
  if (Array.isArray(payload)) return payload
  return []
}

// Bug fix — this required record.theme_id to be a valid theme id or it
// returned null, silently dropping every record — but /insights/theme-funds
// never echoes theme_id (or theme_name/theme_weight/theme_value_thb/
// matched_stocks*/theme_exposure_score) back on a fund record, confirmed
// live with and without the ?themes= filter, identical on v1/v2/v3. That
// made fetchThemeFunds() always resolve to [] before a single caller ever
// used it. The API's own request param is the only source of which theme(s)
// were asked for, so the caller passes it in explicitly (see fetchThemeFunds
// below) instead of expecting the response to say so. The fields with no
// real source are dropped rather than defaulted to a fabricated 0/[].
function mapThemeFund(record, themeId) {
  if (!isRecord(record)) return null

  const fundCode = safeText(record.fund_code, 64)
  if (!isValidFundId(fundCode)) return null

  return {
    themeId: themeId || null,
    fundCode,
    fundName: safeText(record.fund_name_th || record.fund_name_en || fundCode),
    amc: safeText(record.amc_name, 120),
    category: safeText(record.aimc_category_name_en || record.aimc_category_name_th, 160),
    masterFund: safeText(record.main_feeder_fund, 180),
    marketType: safeText(record.market_type, 16).toUpperCase(),
    aum: Math.max(0, rounded(safeNumber(record.aum_m_thb))),
    return1m: rounded(safePercent(record.return_1m)),
    return3m: rounded(safePercent(record.return_3m)),
    return1y: rounded(safePercent(record.return_1y)),
    flow1m: optionalNumber(record.estimated_flow_1m_m_thb),
  }
}

// API Data Quality — /api/v1/funds/list caps out at 1000 rows per REQUEST
// (limit > 1000 silently returns 0, not an error — verified live, this is a
// hard server-side ceiling, not something the client can raise) and never
// sends a total count, so this loops on offset until a short page confirms
// the end. The TH market alone has ~4000 non-feeder funds; a single-page
// fetch used to return only whatever the API's default ordering put in the
// first 1000 — for 'thai' that was entirely Fixed Income/Miscellaneous
// funds, so every real Equity fund (and therefore the whole screener)
// silently showed 0 results. MAX_LIST_PAGES is only a runaway guard (in case
// the API never returns a short final page), not a real cap — at 1000/page
// it covers up to 100,000 funds, comfortably above any known fund universe.
const MAX_LIST_PAGES = 100

async function fetchAllDirectFunds(type) {
  const pages = []
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const payload = await reconGet('/api/v1/funds/list', {
      ...DIRECT_LIST_PARAMS[type],
      limit: API_LIST_LIMIT,
      offset: page * API_LIST_LIMIT,
    })
    const records = extractFundList(payload)
    pages.push(...records)
    if (records.length < API_LIST_LIMIT) break
  }
  return pages
}

async function fetchDirectFundsByType(type) {
  const records = await fetchAllDirectFunds(type)

  return records
    .filter((record) => isFundInType(record, type))
    .map((record) => normalizeFund(record, type))
    .filter(Boolean)
}

async function fetchDirectFundById(id) {
  const payload = await reconGet(`/api/v1/funds/${encodeURIComponent(id)}`)
  const profile = isRecord(payload?.profile) ? payload.profile : payload?.fund || payload
  return normalizeFund(profile, inferFundType(profile), payload)
}

function mapNavHistoryPoint(record) {
  if (!isRecord(record)) return null

  const date = safeIsoDate(record.date)
  const nav = optionalNumber(record.nav)
  if (!date || nav === null) return null

  return { date, nav, changePct: optionalNumber(record.change_pct) }
}

function extractNavHistory(payload) {
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return []
}

// Real daily NAV series — added to the recon API after the fund profile's
// checkpoint-only returns (retPRaw) were the sole option. Sorted oldest-first
// so callers can plot it directly without re-sorting.
export async function fetchFundNavHistory(id, { days = 365 } = {}) {
  if (!isValidFundId(id)) {
    throw new Error('Invalid fund id requested')
  }

  const safeDays = Math.min(Math.max(Math.round(safeNumber(days, 365)), 1), 3650)

  try {
    const payload = fundinfoApiMode === 'wordpress'
      ? await wpGet('fundinfo_nav_history', { id, days: safeDays })
      : await reconGet(`/api/v1/funds/${encodeURIComponent(id)}/nav-history`, { days: safeDays })

    return extractNavHistory(payload)
      .map(mapNavHistoryPoint)
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return [] // Non-critical chart data — fail quiet, callers already fall back to checkpoint returns.
  }
}

// API Data Quality — /api/v1/stocks/top?market_type=FOREIGN mixes in plain
// domestic Thai SET stocks (confirmed live 2026-09-03: 10 of 15 FOREIGN-
// tagged rows were names like KBANK/GULF/CPALL/BBL — every genuine foreign
// holding in this dataset has industry/sector both null, while every
// misclassified Thai one carries Thai SET's own industry/sector taxonomy
// codes, e.g. GULF industry="RESOURC" sector="ENERG"). Left in, this made a
// Thai bank top the offshore "most widely held stock" stat and starved every
// Megatrend/Region scope of real matches (see useFundinfoExposureTrend.js).
// Drop those rows rather than let a Thai stock masquerade as a foreign one;
// remove this filter once the backend stops tagging domestic stocks FOREIGN.
function isMisclassifiedThaiStock(record, marketType) {
  return marketType === 'FOREIGN' && Boolean(record?.industry || record?.sector)
}

// API Data Quality — the 500-row ceiling this used to hard-cap at (422 above
// it) is gone server-side as of 2026-09-07: limit=501+ now returns 200 with
// the real count, no offset/pagination needed. That day FOREIGN had already
// grown to 555 ranked stocks, so the old fixed 500 default was silently
// truncating 55 real rows. Raise the ceiling well past current usage (TH 158,
// FOREIGN 555) rather than hand-tuning it to today's exact count again.
export async function fetchTopStocksByMarket(marketType, { limit = 2000 } = {}) {
  if (!isValidStockMarket(marketType)) {
    throw new Error('Invalid stock market requested')
  }

  const safeLimit = Math.min(Math.max(Math.round(safeNumber(limit, 2000)), 1), 2000)

  try {
    if (fundinfoApiMode === 'wordpress') {
      return extractFundList(await wpGet('fundinfo_top_stocks', { market_type: marketType, limit: safeLimit }))
        .filter((record) => !isMisclassifiedThaiStock(record, marketType))
        .map(mapTopStock)
        .filter(Boolean)
    }

    return extractFundList(await reconGet('/api/v1/stocks/top', { market_type: marketType, limit: safeLimit }))
      .filter((record) => !isMisclassifiedThaiStock(record, marketType))
      .map(mapTopStock)
      .filter(Boolean)
  } catch {
    throw toSafeError('ไม่สามารถโหลดข้อมูลหุ้นจัดอันดับได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
  }
}

// Portfolio API — aggregate region/sector allocation for the Analysis cards.
// Codes are validated before joining them to a query string, which prevents
// untrusted route/input values from being forwarded to the API.
export async function fetchPortfolioAllocation({ marketType, fundCodes = [], allocationType = '' } = {}) {
  if (marketType && !isValidStockMarket(marketType)) {
    throw new Error('Invalid stock market requested')
  }

  const normalizedAllocationType = safeText(allocationType, 32).toUpperCase()
  if (normalizedAllocationType && !isValidAllocationType(normalizedAllocationType)) {
    throw new Error('Invalid allocation type requested')
  }

  const codes = [...new Set(
    (Array.isArray(fundCodes) ? fundCodes : [])
      .filter(isValidFundId)
      .slice(0, 50),
  )]
  const params = {
    ...(marketType ? { market_type: marketType } : {}),
    ...(codes.length ? { codes: codes.join(',') } : {}),
    ...(normalizedAllocationType ? { allocation_type: normalizedAllocationType } : {}),
  }

  try {
    const payload = fundinfoApiMode === 'wordpress'
      ? await wpGet('fundinfo_portfolio_allocation', params)
      : await reconGet('/api/v1/portfolio-allocation', params)

    return extractFundList(payload).map(mapPortfolioAllocation).filter(Boolean)
  } catch {
    throw toSafeError('ไม่สามารถโหลดข้อมูลสัดส่วนการลงทุนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
  }
}

export async function fetchInsightThemes() {
  try {
    const payload = fundinfoApiMode === 'wordpress'
      ? await wpGet('fundinfo_insight_themes')
      : await reconGet('/api/v1/insights/themes')

    return extractThemes(payload).map(mapTheme).filter(Boolean)
  } catch {
    throw toSafeError('ไม่สามารถโหลดข้อมูลธีมการลงทุนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
  }
}

export async function fetchThemeFunds({ themeIds = [], limit = 100, offset = 0 } = {}) {
  const themes = [...new Set(
    (Array.isArray(themeIds) ? themeIds : [])
      .map((themeId) => String(themeId || '').toLowerCase())
      .filter(isValidThemeId)
      .slice(0, 20),
  )]
  const safeLimit = Math.min(Math.max(Math.round(safeNumber(limit, 100)), 1), 500)
  const safeOffset = Math.min(Math.max(Math.round(safeNumber(offset)), 0), 100000)

  try {
    const params = { limit: safeLimit, offset: safeOffset, ...(themes.length ? { themes: themes.join(',') } : {}) }
    const payload = fundinfoApiMode === 'wordpress'
      ? await wpGet('fundinfo_theme_funds', params)
      : await reconGet('/api/v1/insights/theme-funds', params)

    // API Contract — the response never says which requested theme a fund
    // matched (see mapThemeFund above), so only attribute themeId when the
    // call asked for exactly one; a multi-theme call can't attribute it
    // without guessing, so themeId comes back null there.
    const singleThemeId = themes.length === 1 ? themes[0] : null
    return extractFundList(payload).map((record) => mapThemeFund(record, singleThemeId)).filter(Boolean)
  } catch {
    throw toSafeError('ไม่สามารถโหลดข้อมูลกองทุนตามธีมได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
  }
}

export async function fetchFundsByType(type) {
  if (!isValidFundType(type)) {
    throw new Error('Invalid fund type requested')
  }

  try {
    if (fundinfoApiMode === 'wordpress') {
      return extractFundList(await wpGet('fundinfo_list', { type }))
    }

    return await fetchDirectFundsByType(type)
  } catch {
    throw toSafeError('ไม่สามารถโหลดข้อมูลกองทุนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
  }
}

export async function fetchFundById(id) {
  if (!isValidFundId(id)) {
    throw new Error('Invalid fund id requested')
  }

  try {
    if (fundinfoApiMode === 'wordpress') {
      const payload = await wpGet('fundinfo_detail', { id })
      return payload?.fund || payload || null
    }

    return await fetchDirectFundById(id)
  } catch {
    throw toSafeError('ไม่พบข้อมูลกองทุนที่ร้องขอ')
  }
}

export function fundTypeOptions() {
  return VALID_FUND_TYPES
}
