import { apiMode, reconGet, reconPost, wpGet, wpPost } from './apiClient'

function normalizeFund(fund, targetType) {
  return {
    target_type: targetType || fund.target_type || 'TH',
    code: fund.code || '',
    name: fund.name_th || fund.name || '',
    amc: fund.amc || '',
    risk: Number(fund.risk || 0),
    ret: Number(fund.return_1y || 0),
    r1m: Number(fund.return_1m || 0),
    r3m: Number(fund.return_3m || 0),
    nav: Number(fund.nav || 0),
    aum: Number(fund.aum || 0),
    method: fund.method || 'Other',
    sector: fund.sector || '',
    fund_type: fund.fund_type || '',
    feeder: fund.feeder_target || null,
    top: (fund.top5 || []).map((item) => ({
      symbol: item.symbol || '',
      name: item.name || '',
      percent: Number(item.percent || 0),
    })),
  }
}

function extractFunds(payload, targetType) {
  const data = payload?.data || payload || {}
  const funds = Array.isArray(data.funds) ? data.funds : []

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

export async function getDashboardStats(type = 'FOREIGN', period = '1M') {
  if (apiMode === 'wordpress') {
    return wpGet('fund_dashboard_stats', { type, period })
  }

  return reconGet('/dashboard/stats', { type, period })
}

export async function getTopStocks(type = 'FOREIGN', limit = 20) {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_top_stocks', { type, limit }))
  }

  return extractArray(await reconGet('/stocks/top', { type, limit }))
}

export async function getFundList(params = {}) {
  const type = params.type || 'FOREIGN'

  if (apiMode === 'wordpress') {
    return extractFunds(await wpGet('fund_fund_list', params), type)
  }

  return extractFunds(await reconGet('/funds/list', params), type)
}

export async function searchFunds(symbols = []) {
  if (!symbols.length) return []

  if (apiMode === 'wordpress') {
    const payload = await wpPost('fund_search', {
      symbols: JSON.stringify(symbols),
    })
    return extractArray(payload?.holders ? payload.holders : payload)
  }

  const [thai, foreign] = await Promise.all([
    reconPost('/search/funds', { symbols }, { type: 'TH' }),
    reconPost('/search/funds', { symbols }, { type: 'FOREIGN' }),
  ])

  return [
    ...extractArray(thai?.holders || thai).map((item) => normalizeFund(item, 'TH')),
    ...extractArray(foreign?.holders || foreign).map((item) => normalizeFund(item, 'FOREIGN')),
  ]
}

export async function getSearchSuggestions(query, type = 'TH') {
  if (!query) return []

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_search_nav', { q: query }))
  }

  return extractArray(await reconGet('/search/suggestions', { q: query, type }))
}

export async function getMasterEtfs(period = '1M') {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_dashboard_master_etfs', { period }))
  }

  return extractArray(await reconGet('/dashboard/master-etfs', { type: 'FOREIGN', period }))
}

export async function getThaiEtfs(period = '1M') {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_dashboard_thai_etfs', { period }))
  }

  return extractArray(await reconGet('/dashboard/thai-etfs', { period }))
}

export async function getPortfolioAllocation(funds = '') {
  if (apiMode === 'wordpress') {
    return wpGet('fund_dashboard_portfolio_allocation', funds ? { funds } : {})
  }

  return reconGet('/dashboard/portfolio-allocation', funds ? { codes: funds } : {})
}
