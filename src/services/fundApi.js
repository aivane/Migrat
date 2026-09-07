import { apiMode, reconGet, reconPost, wpGet, wpPost } from './apiClient'

// API Field Mapping — /api/v1/funds/list returns real field names that never
// matched this normalizer (fund_code not code, fund_name_th not name_th,
// amc_name not amc, risk_level not risk, ...) — verified live against the
// backend's own /api/fund/openapi.json + a sample record on 2026-09-07.
// return_1y/return_1m/return_3m arrive already as percent-scale numbers (e.g.
// 0.9 means 0.9%, not a 0-1 fraction — same convention fundinfoApi.js already
// relies on), so no extra scaling here. The endpoint has no per-fund holdings
// (top5) at all — leave `top` empty rather than fabricate it (see AGENTS.md's
// no-fabrication rule); a fund's top holdings only come from the single-fund
// detail endpoint, which this list-level function never calls.
function normalizeFund(fund, targetType) {
  return {
    target_type: targetType || fund.market_type || 'TH',
    code: fund.fund_code || fund.code || '',
    name: fund.fund_name_th || fund.name || '',
    amc: fund.amc_name || fund.amc || '',
    risk: Number(fund.risk_level ?? fund.risk ?? 0),
    ret: Number(fund.return_1y ?? 0),
    r1m: Number(fund.return_1m ?? 0),
    r3m: Number(fund.return_3m ?? 0),
    nav: Number(fund.nav ?? fund.nav_value ?? 0),
    aum: Number(fund.aum_m_thb ?? fund.aum ?? 0),
    method: fund.aimc_broad_category_name_en || fund.method || 'Other',
    sector: fund.aimc_category_name_en || fund.sector || '',
    fund_type: fund.aimc_category_name_en || fund.fund_type || '',
    feeder: fund.main_feeder_fund || fund.feeder_target || null,
    top: (fund.top5 || []).map((item) => ({
      symbol: item.symbol || '',
      name: item.name || '',
      percent: Number(item.percent || 0),
    })),
  }
}

function extractFunds(payload, targetType) {
  const data = payload?.data || payload || {}
  const funds = Array.isArray(data) ? data : Array.isArray(data.funds) ? data.funds : []

  return {
    funds: funds.map((fund) => normalizeFund(fund, targetType)),
    total: Number(data.total || funds.length || 0),
  }
}

function extractArray(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.funds)) return payload.funds
  return []
}

// API Endpoint + Field Mapping — /dashboard/stats only exists under
// /api/v1 (or v2/v4), and its real shape is a flat per-market stats object
// (avg_return_1y, dist_1m_down_gt_5, ...) with no `period` filter and no
// `cards`/`charts` structure — DashboardView.vue's normalizeStats() still
// expects the old `{cards, charts}` shape, which the real backend has never
// returned. Fixed the endpoint/params here so this call succeeds (200) with
// real data instead of 404ing; the stat cards themselves need a follow-up
// redesign against the real flat shape (see /api/fund/openapi.json) before
// they'll show anything — tracked separately, not a mechanical field-rename.
export async function getDashboardStats(type = 'FOREIGN') {
  if (apiMode === 'wordpress') {
    return wpGet('fund_dashboard_stats', { type })
  }

  const data = await reconGet('/api/v1/dashboard/stats', { type })
  return Array.isArray(data) ? data[0] || null : data
}

export async function getTopStocks(type = 'FOREIGN', limit = 20) {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_top_stocks', { type, limit }))
  }

  const stocks = extractArray(await reconGet('/api/v1/stocks/top', { type, limit }))
  // Field Mapping — real field is stock_symbol/stock_name, not symbol/name;
  // alias them so DashboardView.vue's existing `.symbol`/`.name` reads work.
  return stocks.map((stock) => ({ ...stock, symbol: stock.stock_symbol, name: stock.stock_name }))
}

// Perf — /api/v1/funds/list caps at 1000 rows/request (same ceiling
// documented in fundinfoApi.js's fetchAllDirectFunds) and the real TH/FOREIGN
// universes are ~1800 each, so one page can silently miss real funds. Two
// pages covers the current real totals with a bounded worst case.
const FUND_LIST_PAGE_SIZE = 1000
const FUND_LIST_MAX_PAGES = 3

export async function getFundList(params = {}) {
  const type = params.type || 'FOREIGN'

  if (apiMode === 'wordpress') {
    return extractFunds(await wpGet('fund_fund_list', params), type)
  }

  // API Field Mapping — /api/v1/funds/list has no sort_by/sort_dir/per_page/
  // page params (verified against /api/fund/openapi.json); DashboardView.vue
  // already sorts/paginates client-side via its own filterAndSort(), so the
  // API-side sort/page request was always a no-op — fetch by limit/offset
  // instead and let the view keep doing what it already does.
  const rows = []
  for (let page = 0; page < FUND_LIST_MAX_PAGES; page++) {
    const batch = await reconGet('/api/v1/funds/list', { type, limit: FUND_LIST_PAGE_SIZE, offset: page * FUND_LIST_PAGE_SIZE })
    const records = Array.isArray(batch) ? batch : batch?.data || []
    rows.push(...records)
    if (records.length < FUND_LIST_PAGE_SIZE) break
  }

  return extractFunds(rows, type)
}

// API Compatibility — there is no backend endpoint for "which funds hold
// these stock symbols" (verified against /api/fund/openapi.json — the
// closest match, /api/v1/feeder-funds/holders, looks up master-fund/ETF
// symbols like "IVV", not individual equity tickers). Returning empty here
// is honest and lets DashboardView.vue's existing local-search fallback
// (matching against already-loaded funds' top holdings) take over instead
// of throwing a 404 on every symbol click.
export async function searchFunds(symbols = []) {
  if (!symbols.length) return []

  if (apiMode === 'wordpress') {
    const payload = await wpPost('fund_search', {
      symbols: JSON.stringify(symbols),
    })
    return extractArray(payload?.holders ? payload.holders : payload)
  }

  return []
}

export async function getSearchSuggestions(query, type = 'TH') {
  if (!query) return []

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_search_nav', { q: query }))
  }

  return extractArray(await reconGet('/api/v1/search/suggestions', { q: query, type }))
}

// API Field Mapping — /dashboard/master-etfs only accepts limit/offset
// (verified against /api/fund/openapi.json) — there is no type/period filter
// on the real endpoint, so `period` is dropped rather than sent as a no-op.
export async function getMasterEtfs(period = '1M') {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_dashboard_master_etfs', { period }))
  }

  return extractArray(await reconGet('/api/v1/dashboard/master-etfs', { limit: 20 }))
}

// Same real-endpoint constraint as getMasterEtfs above — limit/offset only.
export async function getThaiEtfs(period = '1M') {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_dashboard_thai_etfs', { period }))
  }

  return extractArray(await reconGet('/api/v1/dashboard/thai-etfs', { limit: 20 }))
}

// API Endpoint + Field Mapping — /dashboard/portfolio-allocation does not
// exist under /api/v1 at all (verified against /api/fund/openapi.json) —
// only v2/v3 have it, and the real shape is a flat array of
// {allocation_type, name, avg_percent, weighted_percent, funds_count} rows,
// not the `{portfolio_allocation: {key: {pct, val}}}` shape
// DashboardView.vue's allocationSegments computed expects. Fixed the
// endpoint so this succeeds (200) with real data; the allocation chart
// itself needs a follow-up redesign against the real flat shape before it'll
// render anything — same follow-up as getDashboardStats above.
export async function getPortfolioAllocation(funds = '') {
  if (apiMode === 'wordpress') {
    return wpGet('fund_dashboard_portfolio_allocation', funds ? { funds } : {})
  }

  return reconGet('/api/v2/dashboard/portfolio-allocation', funds ? { codes: funds } : {})
}
