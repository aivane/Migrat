import { reconGet, wpGet } from './apiClient'
import { FUND_TYPES } from '../data/fundinfoConstants'

export const VALID_FUND_TYPES = Object.freeze(Object.keys(FUND_TYPES))
// Encoded before path interpolation; narrow whitelist (no slashes/quotes/%/controls).
export const FUND_ID_PATTERN = /^[A-Za-z0-9()& _-]{1,64}$/
export const VALID_STOCK_MARKETS = Object.freeze(['TH', 'FOREIGN'])
export const VALID_ALLOCATION_TYPES = Object.freeze(['ASSET_CLASS', 'SECTOR', 'REGIONAL'])
// Allows `/` — 3 of 34 real theme ids contain it (e.g. "global_bond_fully_f/x_hedge").
export const THEME_ID_PATTERN = /^[a-z0-9_/-]{1,64}$/

// Screener enum values, verified live against the backend. Store the raw enum
// string as the id (no translation table) so a future rename fails loud
// (mapEnum -> null, filter no-ops) instead of silently mismatching. Backend
// renamed 3 of these again on 2026-09-08 (COMMODITIES_GOLD->COMMODITIES,
// HEALTHCARE->HEALTHCARE_BIOTECH, ASIA_EX_JAPAN->ASIA_PACIFIC) and added
// CONSUMER_LIFESTYLE/FINTECH_FINANCE.
const FX_HEDGING_VALUES = new Set(['FULLY_HEDGED', 'DISCRETIONARY', 'PARTIALLY_HEDGED', 'UNHEDGED', 'UNSPECIFIED', 'NOT_APPLICABLE'])
const GEOGRAPHY_VALUES = new Set(['GLOBAL', 'US', 'JAPAN', 'CHINA', 'VIETNAM', 'INDIA', 'EUROPE', 'EMERGING_MARKETS', 'ASIA_PACIFIC', 'THAILAND'])
const THEMATIC_VALUES = new Set(['BROAD_MARKET', 'TECHNOLOGY_AI', 'COMMODITIES', 'HIGH_DIVIDEND', 'PROPERTY_INFRA', 'HEALTHCARE_BIOTECH', 'ESG_CLEAN_ENERGY', 'CONSUMER_LIFESTYLE', 'FINTECH_FINANCE'])
const MANAGEMENT_STYLE_VALUES = new Set(['ACTIVE', 'PASSIVE_INDEX', 'DIVIDEND_FOCUSED'])
const MARKET_CAP_VALUES = new Set(['ALL_CAP', 'MID_SMALL_CAP', 'LARGE_CAP'])

function mapEnum(raw, validValues) {
  const text = safeText(raw, 64).toUpperCase()
  return validValues.has(text) ? text : null
}

// `fx_hedge_policy` is the documented field; `fx_hedging` is an alias that
// briefly disappeared. Prefer the documented name, fall back to the alias.
function mapFxHedging(record) {
  return mapEnum(record.fx_hedge_policy ?? record.fx_hedging, FX_HEDGING_VALUES)
}

const API_LIST_LIMIT = 1000
const MAX_TEXT_LENGTH = 300
const MAX_HOLDINGS = 20
const MAX_ALLOCATIONS = 30
const MIXED_CATEGORY_PATTERN = /mixed|allocation|balanced|multi[- ]?asset|ผสม|จัดสรร/i
const THAI_EQUITY_CATEGORY_PATTERN = /thai equity|equity|หุ้น/i
const COMMODITIES_CATEGORY_PATTERN = /commodit|โภคภัณฑ์/i

const DIRECT_LIST_PARAMS = Object.freeze({
  // Feeder funds are categorised under FOREIGN market_type.
  feeder: Object.freeze({ market_type: 'FOREIGN', is_feeder_fund: 1 }),
  offshore: Object.freeze({ market_type: 'FOREIGN', is_feeder_fund: 0 }),
  // is_feeder_fund is unreliable under TH (excluded 839 real domestic funds
  // server-side) — fetch all TH records, let isFundInType() classify them.
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

// direct calls the API directly; wordpress routes through admin-ajax.php. Both real, no mock mode.
export const fundinfoApiMode = import.meta.env.VITE_FUNDINFO_API_MODE || 'direct'

function toSafeError(fallbackMessage) {
  return new Error(fallbackMessage) // never propagate raw backend payloads/stack traces to UI
}

function isRecord(value) {
  return Object.prototype.toString.call(value) === '[object Object]'
}

function safeText(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string') return ''

  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength)
}

function safeHttpsUrl(value) {
  const url = safeText(value, 2048)
  if (!url) return ''

  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ? parsed.href : '' // block javascript:/data: URLs
  } catch {
    return ''
  }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function optionalNumber(value) {
  // `Number(null) === 0`, which would misrepresent "no data" as "genuinely zero".
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

// Null-safe rounded() — categoryAvg fields need rounding but must stay null, not 0, when absent.
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

// Commodities funds (e.g. gold ETFs tracking SPDR Gold Trust) get geographic_focus=US
// from the backend — that's the master fund's exchange listing, not real geographic
// exposure (verified live: finnomena.com tags the same funds as Commodities only, no
// geography). Drop it rather than let a gold fund pollute a "US equity" filter.
function hasUnreliableGeography(record) {
  return COMMODITIES_CATEGORY_PATTERN.test(categoryText(record))
}

// `is_feeder_fund` is unreliable under market_type TH (839 domestic-only funds are
// flagged =1 despite no foreign master fund) — only trust it under FOREIGN.
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

    // different API versions use different field names
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

// fund_tax_type (RMF/SSF/TESG/TESGX) bucketed into the app's SSF/RMF/Thai ESG/none categories.
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
    amcCode: safeText(amc.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()) || 'FI',
    amcShort: amc,
    risk: Math.min(Math.max(Math.round(safeNumber(record.risk_level)), 0), 8),
    fee: rounded(expenseRatio),
    div: rounded(safePercent(record.dividend_yield)),
    dividendPolicy: safeText(record.dividend_policy),
    fxHedging: mapFxHedging(record),
    // one value per fund (not a tag list) — screener filters match by set membership
    geography: hasUnreliableGeography(record) ? null : mapEnum(record.geographic_focus, GEOGRAPHY_VALUES),
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
    pop: 0, // not supplied by the API; do not fabricate
    aum: rounded(safeNumber(record.aum_m_thb)),
    nav: rounded(safeNumber(record.nav ?? record.nav_value)),
    navDate: safeText(record.nav_date, 32),
    // looks broken upstream (e.g. +126% on an equity feeder — likely vs. inception NAV,
    // not previous day). Kept for debugging only; derive daily change from nav-history instead.
    navChangePct1d: optionalNumber(record.nav_change_pct_1d),
    inceptionDate: safeIsoDate(record.inception_date),
    factSheetUrl: safeHttpsUrl(record.fund_fact_sheet),
    isFeederFund: asFlag(record.is_feeder_fund),
    isEtf: asFlag(record.is_etf),
    taxBenefit: mapTaxBenefit(record),
    retP: { m1: rounded(safePercent(record.return_1m)), q1: rounded(safePercent(record.return_3m)), m6: rounded(safePercent(record.return_6m)), y1: return1y, y3: return3y, y5: return5y, y10: return10y },
    // retP defaults missing periods to 0% for display; use this instead when
    // "genuinely 0%" must be distinguishable from "no data" (e.g. charts).
    retPRaw: {
      m1: optionalNumber(record.return_1m),
      q1: optionalNumber(record.return_3m),
      m6: optionalNumber(record.return_6m),
      y1: optionalNumber(record.return_1y),
      y3: optionalNumber(record.return_3y),
      y5: optionalNumber(record.return_5y),
      y10: optionalNumber(record.return_10y),
    },
    // no 1w flow from the API (only 1m/1y) — unit_change_1w is a % price change,
    // not THB-millions, and must never be substituted here.
    flowP: { w1: null, m1: flow1m, y1: flow1y },
    managementFee: optionalNumber(record.management_fee),
    frontEndFee: optionalNumber(record.front_end_fee),
    backEndFee: optionalNumber(record.back_end_fee),
    maxFrontEndFee: optionalNumber(record.max_front_end_fee),
    maxBackEndFee: optionalNumber(record.max_back_end_fee),
    sharpe: optionalNumber(record.sharpe_ratio_1y),
    drawdown: maxDrawdown === null ? '-' : `${rounded(maxDrawdown)}%`,
    // benchmark/alpha/beta are vs. the fund's AIMC category, not a market index.
    // peRatio/pbRatio are still null for every fund observed — kept nullable, not defaulted.
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
    // API only publishes 1Y (stats above) and 3Y period-specific risk figures;
    // no 3M/6M/5Y/10Y equivalents exist, so those are dropped rather than faked.
    stats3y: {
      sharpe: optionalRounded(record.sharpe_ratio_3y),
      sd: optionalRounded(record.std_3y),
      maxdd: optionalRounded(record.max_drawdown_3y),
    },
    // real peer/category averages ("เฉลี่ยกลุ่ม" column) — only these periods exist,
    // no 3Y/5Y/10Y peer return average and no peer SD.
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
    // API caps this list; fundCount above is the full aggregate count
    topHoldingFundCodes: mapTopHoldingFundCodes(record.top_holding_funds),
    // Backend added these after buildApiStockRankEntities was written assuming
    // they didn't exist (see useFundinfoRanking.js) — no market cap field yet.
    peRatio: optionalRounded(record.pe_ratio),
    pbRatio: optionalRounded(record.pb_ratio),
    dividendYield: optionalRounded(record.dividend_yield),
    maxDrawdown: optionalRounded(record.max_drawdown),
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
    color: /^#[0-9A-Fa-f]{6}$/.test(color) ? color : '', // only accept CSS hex colours
    avgPercent: rounded(safePercent(record.avg_percent)),
    weightedPercent: rounded(safePercent(record.weighted_percent)),
    fundsCount: Math.max(0, Math.min(Math.round(safeNumber(record.funds_count)), 1000000)),
  }
}

// theme_name/funds_count/total_aum_m_thb/avg_return_1m/avg_return_1y are what the
// API actually sends — icon/master_fund/sample_symbols never exist on a real record.
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

// /insights/theme-funds never echoes theme_id (or theme_name/weight/matched_stocks*)
// back on a fund record — the caller passes themeId in explicitly instead (see
// fetchThemeFunds below). Fields with no real source are dropped, not fabricated.
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

// /api/v1/funds/list hard-caps at 1000 rows/request and never sends a total count,
// so this pages on offset until a short page confirms the end. MAX_LIST_PAGES is
// just a runaway guard (100k funds at 1000/page), not a real cap.
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

// Daily NAV series, sorted oldest-first so callers can plot it directly.
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
    return [] // non-critical chart data — callers fall back to checkpoint returns
  }
}

// /api/v1/stocks/top?market_type=FOREIGN mixes in domestic Thai SET stocks (they
// carry industry/sector taxonomy codes; genuine foreign holdings have both null).
// Drop those rows; remove this filter once the backend stops tagging them FOREIGN.
function isMisclassifiedThaiStock(record, marketType) {
  return marketType === 'FOREIGN' && Boolean(record?.industry || record?.sector)
}

// server-side row ceiling was raised 2026-09-07 — default limit set well above
// current usage (TH 158, FOREIGN 555) rather than hand-tuned to today's count.
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

// Aggregate region/sector allocation for the Analysis cards. Codes are validated
// before joining into a query string, so untrusted input can't reach the API.
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

    // response never says which theme a fund matched — only attribute themeId
    // when exactly one was requested; a multi-theme call gets null.
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
