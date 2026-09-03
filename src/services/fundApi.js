import { apiMode, reconGet, reconPost, wpGet, wpPost } from './apiClient'

// -----------------------------------------------------------------
// Schema Normalizer: รองรับทั้ง schema ใหม่ (Swagger API) และ schema เก่า
// -----------------------------------------------------------------
function normalizeFund(fund, targetType) {
  // field ที่ Swagger API ใหม่ใช้ชื่อต่างจากเดิม
  const code = fund.fund_code || fund.code || ''
  const name = fund.fund_name_th || fund.name_th || fund.name || ''
  const amc = fund.amc_name || fund.amc || ''
  const risk = Number(fund.risk_level ?? fund.risk ?? 0)
  const aum = Number(fund.aum_m_thb ?? fund.aum ?? 0) // aum_m_thb คือ ล้านบาท
  const nav = Number(fund.nav ?? 0)

  // ผลตอบแทน
  const ret = Number(fund.return_1y ?? 0)
  const r1m = Number(fund.return_1m ?? 0)
  const r3m = Number(fund.return_3m ?? 0)

  // Flow — ใช้ estimated_flow_1m_m_thb จาก Swagger API ก่อน (หน่วย ล้านบาท)
  const flow = Number(fund.estimated_flow_1m_m_thb ?? fund.flow_1m ?? fund.flow ?? 0)

  // Category / Method / Sector
  const method = fund.aimc_category_name_en || fund.method || 'Other'
  const sector = fund.aimc_broad_category_name_en || fund.sector || ''

  // Feeder Fund
  const feeder = fund.main_feeder_fund || fund.feeder_target || null

  // Top Holdings — รองรับทุก field format:
  // - API ใหม่: stock_symbol / clean_holding_name / holding_percent
  // - Normalized: symbol / name / percent
  // - WordPress: s / n / p
  const rawTop = fund.top_holdings || fund.top5 || []
  const top = rawTop.map((item) => ({
    symbol: item.stock_symbol || item.symbol || item.s || '',
    name: item.clean_holding_name || item.raw_holding_name || item.name || item.n || '',
    percent: Number(item.holding_percent ?? item.percent ?? item.p ?? item.weight ?? 0),
  }))

  return {
    target_type: targetType || fund.market_type || fund.target_type || 'TH',
    code,
    name,
    amc,
    risk,
    ret,
    r1m,
    r3m,
    nav,
    aum,
    flow,
    method,
    sector,
    fund_type: fund.fund_type || fund.aimc_broad_category_name_en || '',
    feeder,
    top,
    // Field เพิ่มเติมจาก Swagger API ที่มีประโยชน์
    is_feeder_fund: fund.is_feeder_fund ?? null,
    is_etf: fund.is_etf ?? null,
    dividend_policy: fund.dividend_policy || '',
    fund_tax_type: fund.fund_tax_type || null,
    return_3y: Number(fund.return_3y ?? 0),
    return_5y: Number(fund.return_5y ?? 0),
    sharpe_1y: Number(fund.sharpe_ratio_1y ?? 0),
    max_drawdown_1y: Number(fund.max_drawdown_1y ?? 0),
    estimated_flow_1y: Number(fund.estimated_flow_1y_m_thb ?? 0),
    unit_change_1m: Number(fund.unit_change_1m ?? 0),
    unit_change_1y: Number(fund.unit_change_1y ?? 0),
    nav_date: fund.nav_date || null,
    fund_fact_sheet: fund.fund_fact_sheet || '',
    fund_short_desc: fund.fund_short_desc || '',
  }
}

function extractFunds(payload, targetType) {
  // รองรับทั้ง { status, count, data: [...] } (Swagger) และ { data: { funds: [...], total } } (เก่า)
  const raw = payload?.data ?? payload ?? {}

  let funds = []
  let total = 0

  if (Array.isArray(raw)) {
    // Swagger: data เป็น array โดยตรง
    funds = raw
    total = funds.length
  } else if (Array.isArray(raw.funds)) {
    // format เก่า
    funds = raw.funds
    total = Number(raw.total || funds.length)
  }

  // Swagger root-level count
  if (!total && payload?.count) total = Number(payload.count)

  return {
    funds: funds.map((fund) => normalizeFund(fund, targetType)),
    total,
  }
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.funds)) return payload.funds
  if (Array.isArray(payload?.data?.funds)) return payload.data.funds
  return []
}

// -----------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------

export async function getDashboardStats(type = 'FOREIGN') {
  if (apiMode === 'wordpress') {
    return wpGet('fund_dashboard_stats', { type })
  }

  // Swagger: GET /api/v1/dashboard/stats
  const payload = await reconGet('/dashboard/stats', { type })

  // Response: { status, data: [ { market_type, total_funds, ... }, ... ] }
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload)) return payload
  return payload
}

export async function getTopStocks(type = 'FOREIGN', limit = 20) {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_top_stocks', { type, limit }))
  }

  // Swagger: GET /api/v1/stocks/top
  return extractArray(await reconGet('/stocks/top', { type, limit }))
}

export async function getFundList(params = {}) {
  const type = params.type || 'FOREIGN'

  if (apiMode === 'wordpress') {
    return extractFunds(await wpGet('fund_fund_list', params), type)
  }

  // Swagger: GET /api/v1/funds/list
  return extractFunds(await reconGet('/funds/list', params), type)
}

export async function getFundDetail(code) {
  if (!code) return null

  if (apiMode === 'wordpress') {
    return wpGet('fund_fund_detail', { code })
  }

  // Swagger: GET /api/v1/funds/{code}
  return reconGet(`/funds/${encodeURIComponent(code)}`)
}

export async function searchFunds(symbols = []) {
  if (!symbols.length) return []

  if (apiMode === 'wordpress') {
    const payload = await wpPost('fund_search', {
      symbols: JSON.stringify(symbols),
    })
    return extractArray(payload?.holders ? payload.holders : payload)
  }

  // Swagger: GET /api/v1/search/stocks (รองรับทั้งหุ้นไทยและต่างประเทศ)
  const symbolStr = symbols.join(',')
  const payload = await reconGet('/search/stocks', { symbols: symbolStr, market_type: 'ALL', limit: 200 })
  return extractArray(payload)
}

export async function getSearchSuggestions(query, type = null) {
  if (!query) return []

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_search_nav', { q: query }))
  }

  // Swagger: GET /api/v1/search/suggestions
  const params = { q: query, limit: 20 }
  if (type) params.type = type
  return extractArray(await reconGet('/search/suggestions', params))
}

export async function getMasterEtfs() {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_dashboard_master_etfs', {}))
  }

  // Swagger: GET /api/v1/dashboard/master-etfs
  return extractArray(await reconGet('/dashboard/master-etfs', { limit: 100 }))
}

export async function getThaiEtfs() {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_dashboard_thai_etfs', {}))
  }

  // Swagger: GET /api/v1/dashboard/thai-etfs
  return extractArray(await reconGet('/dashboard/thai-etfs', { limit: 200 }))
}

export async function getPortfolioAllocation(funds = '') {
  if (apiMode === 'wordpress') {
    return wpGet('fund_dashboard_portfolio_allocation', funds ? { funds } : {})
  }

  // Swagger: GET /api/v1/portfolio-allocation
  return reconGet('/portfolio-allocation', funds ? { codes: funds } : {})
}

export async function getFeederFundHolders(symbol, limit = 50) {
  if (apiMode === 'wordpress') {
    return wpGet('fund_feeder_holders', { symbol, limit })
  }

  // Swagger: GET /api/v1/feeder-funds/holders
  return reconGet('/feeder-funds/holders', { symbol, limit })
}

export async function getSectorHierarchy(limit = 10) {
  if (apiMode === 'wordpress') {
    return wpGet('fund_insights_sectors', { limit })
  }

  // Swagger: GET /api/v1/insights/sectors
  return reconGet('/insights/sectors', { limit })
}

// Export normalizer for use in other modules
export { normalizeFund, extractFunds, extractArray }

