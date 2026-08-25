import { reconGet, wpGet } from './apiClient'
import { FUNDS, FUND_TYPES, fundsByType } from '../data/fundinfoData'

// Input Validation — whitelist enums/patterns, reused by router guards & stores.
export const VALID_FUND_TYPES = Object.freeze(Object.keys(FUND_TYPES))
// API Contract — share classes such as K-GDBOND-A(A), SCBS&P500, and KKP GNP
// are valid. The service applies encodeURIComponent before path interpolation.
// Keep the route whitelist narrow: no slashes, quotes, percent signs, or controls.
export const FUND_ID_PATTERN = /^[A-Za-z0-9()& _-]{1,64}$/
export const VALID_STOCK_MARKETS = Object.freeze(['TH', 'FOREIGN'])
export const VALID_ALLOCATION_TYPES = Object.freeze(['ASSET_CLASS', 'SECTOR', 'REGIONAL'])
export const THEME_ID_PATTERN = /^[a-z0-9_-]{1,64}$/

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
  thai: Object.freeze({ market_type: 'TH', is_feeder_fund: 0 }),
  mixed: Object.freeze({ market_type: 'TH', is_feeder_fund: 0 }),
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

// Feature switch — mock data remains untouched. Direct mode targets the supplied
// Mutual Fund Data API; wordpress keeps the legacy adapter contract intact.
export const fundinfoApiMode = import.meta.env.VITE_FUNDINFO_API_MODE || 'mock'

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

function inferFundType(record) {
  if (asFlag(record?.is_feeder_fund)) return 'feeder'
  if (safeText(record?.market_type).toUpperCase() === 'FOREIGN') return 'offshore'
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

    return [{ name, percent: rounded(safePercent(holding.holding_percent)) }]
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
  const maxDrawdown = optionalNumber(record.max_drawdown_1y) ?? optionalNumber(record.max_drawdown_3y)
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
    div: 0, // The API exposes a policy, not a dividend yield.
    dividendPolicy: safeText(record.dividend_policy),
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
    // UI Adapter — the existing detail header requires a numeric NAV. This
    // API's fund profile currently omits NAV, so retain the legacy numeric
    // contract with a neutral display value rather than crashing the page.
    nav: rounded(safeNumber(record.nav ?? record.nav_value)),
    navDate: safeText(record.nav_date, 32),
    inceptionDate: safeIsoDate(record.inception_date),
    factSheetUrl: safeHttpsUrl(record.fund_fact_sheet),
    isFeederFund: asFlag(record.is_feeder_fund),
    isEtf: asFlag(record.is_etf),
    retP: { m1: rounded(safePercent(record.return_1m)), q1: rounded(safePercent(record.return_3m)), y1: return1y, y3: return3y, y5: return5y, y10: return10y },
    flowP: { w1: rounded(safeNumber(record.unit_change_1w)), m1: flow1m, y1: flow1y },
    managementFee: optionalNumber(record.management_fee),
    frontEndFee: optionalNumber(record.front_end_fee),
    backEndFee: optionalNumber(record.back_end_fee),
    sharpe: optionalNumber(record.sharpe_ratio_1y),
    drawdown: maxDrawdown === null ? '-' : `${rounded(maxDrawdown)}%`,
    stats: {
      sharpe: optionalNumber(record.sharpe_ratio_1y),
      sd: optionalNumber(record.std_1y),
      maxdd: maxDrawdown,
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

function mapTheme(record) {
  if (!isRecord(record)) return null

  const id = safeText(record.id, 64).toLowerCase()
  if (!isValidThemeId(id)) return null

  const label = safeText(record.label, 120)
  if (!label) return null

  return {
    id,
    label,
    // Anti-XSS — rendered as interpolation only; bound the icon to a short
    // plain-text token rather than accepting an arbitrary HTML fragment.
    icon: safeText(record.icon, 8),
    masterFund: safeText(record.master_fund, 180),
    sampleSymbols: Array.isArray(record.sample_symbols)
      ? record.sample_symbols
        .slice(0, 20)
        .map((symbol) => safeText(symbol, 32))
        .filter((symbol) => /^[A-Za-z0-9._-]{1,32}$/.test(symbol))
      : [],
  }
}

function extractThemes(payload) {
  if (Array.isArray(payload?.themes)) return payload.themes
  if (Array.isArray(payload)) return payload
  return []
}

function mapThemeFund(record) {
  if (!isRecord(record)) return null

  const id = safeText(record.theme_id, 64).toLowerCase()
  const fundCode = safeText(record.fund_code, 64)
  if (!isValidThemeId(id) || !isValidFundId(fundCode)) return null

  return {
    themeId: id,
    themeName: safeText(record.theme_name, 120),
    fundCode,
    fundName: safeText(record.fund_name_th || record.fund_name_en || fundCode),
    amc: safeText(record.amc_name, 120),
    category: safeText(record.aimc_category_name_en || record.aimc_category_name_th, 160),
    masterFund: safeText(record.main_feeder_fund, 180),
    marketType: safeText(record.market_type, 16).toUpperCase(),
    aum: Math.max(0, rounded(safeNumber(record.aum))),
    return1m: rounded(safePercent(record.return_1m)),
    return3m: rounded(safePercent(record.return_3m)),
    return1y: rounded(safePercent(record.return_1y)),
    themeWeight: rounded(safePercent(record.theme_weight)),
    themeValueThb: Math.max(0, rounded(safeNumber(record.theme_value_thb))),
    matchedStocksCount: Math.max(0, Math.min(Math.round(safeNumber(record.matched_stocks_count)), 1000)),
    matchedStocks: Array.isArray(record.matched_stocks)
      ? record.matched_stocks
        .slice(0, 50)
        .map((symbol) => safeText(symbol, 32))
        .filter((symbol) => /^[A-Za-z0-9._-]{1,32}$/.test(symbol))
      : [],
    exposureScore: Math.max(0, rounded(safeNumber(record.theme_exposure_score))),
  }
}

async function fetchDirectFundsByType(type) {
  const payload = await reconGet('/api/v1/funds/list', {
    ...DIRECT_LIST_PARAMS[type],
    limit: API_LIST_LIMIT,
  })

  return extractFundList(payload)
    .filter((record) => isFundInType(record, type))
    .map((record) => normalizeFund(record, type))
    .filter(Boolean)
}

async function fetchDirectFundById(id) {
  const payload = await reconGet(`/api/v1/funds/${encodeURIComponent(id)}`)
  const profile = isRecord(payload?.profile) ? payload.profile : payload?.fund || payload
  return normalizeFund(profile, inferFundType(profile), payload)
}

export async function fetchTopStocksByMarket(marketType, { limit = 100 } = {}) {
  if (!isValidStockMarket(marketType)) {
    throw new Error('Invalid stock market requested')
  }

  const safeLimit = Math.min(Math.max(Math.round(safeNumber(limit, 100)), 1), 500)

  if (fundinfoApiMode === 'mock') return []

  try {
    if (fundinfoApiMode === 'wordpress') {
      return extractFundList(await wpGet('fundinfo_top_stocks', { market_type: marketType, limit: safeLimit }))
        .map(mapTopStock)
        .filter(Boolean)
    }

    return extractFundList(await reconGet('/api/v1/stocks/top', { market_type: marketType, limit: safeLimit }))
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

  if (fundinfoApiMode === 'mock') return []

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
  if (fundinfoApiMode === 'mock') return []

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

  if (fundinfoApiMode === 'mock') return []

  try {
    const params = { limit: safeLimit, offset: safeOffset, ...(themes.length ? { themes: themes.join(',') } : {}) }
    const payload = fundinfoApiMode === 'wordpress'
      ? await wpGet('fundinfo_theme_funds', params)
      : await reconGet('/api/v1/insights/theme-funds', params)

    return extractFundList(payload).map(mapThemeFund).filter(Boolean)
  } catch {
    throw toSafeError('ไม่สามารถโหลดข้อมูลกองทุนตามธีมได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง')
  }
}

export async function fetchFundsByType(type) {
  if (!isValidFundType(type)) {
    throw new Error('Invalid fund type requested')
  }

  if (fundinfoApiMode === 'mock') {
    return fundsByType(type)
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

  if (fundinfoApiMode === 'mock') {
    return FUNDS.find((fund) => fund.id === id) || null
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
