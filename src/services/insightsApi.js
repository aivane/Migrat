import { apiMode, reconGet, wpGet } from './apiClient'

function extractArray(payload, keys = ['funds', 'themes', 'flows', 'data', 'items']) {
  if (Array.isArray(payload)) return payload

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key]
    if (Array.isArray(payload?.data?.[key])) return payload.data[key]
  }

  return []
}

function labelFromTheme(value) {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (!value || typeof value !== 'object') return ''

  return (
    value.theme_name ||
    value.name ||
    value.theme ||
    value.label ||
    value.title ||
    value.category ||
    labelFromTheme(value.themes) ||
    ''
  )
}

function mapFundRecord(f, index = 0) {
  const return_1y = Number(f.return_1y ?? f.ret ?? 0)
  const return_1m = Number(f.return_1m ?? 0)
  const return_3m = Number(f.return_3m ?? return_1m)
  const unit_1d = Number(f.unit_change_1d ?? 0)
  const unit_1w = Number(f.unit_change_1w ?? 0)
  const unit_1m = Number(f.unit_change_1m ?? 0)
  const unit_3m = Number(f.unit_change_3m ?? 0)
  const unit_1y = Number(f.unit_change_1y ?? 0)

  // Provide mini flow chart points for 1D, 1W, 1M, 3M, 1Y
  const flows = [
    { label: '1D', net: unit_1d },
    { label: '1W', net: unit_1w },
    { label: '1M', net: unit_1m || return_1m },
    { label: '3M', net: unit_3m || return_3m },
    { label: '1Y', net: unit_1y || return_1y },
  ]

  return {
    ...f,
    code: f.fund_code || f.code || f.symbol || '-',
    name: f.fund_name_th || f.fund_name || f.name || f.fund_code || '-',
    amc: f.amc_name || f.amc || '-',
    sector: f.aimc_category_name_en || f.sector || f.category || '-',
    category: f.aimc_category_name_en || f.category || '-',
    risk: f.risk_level ?? f.risk ?? '-',
    return_1y,
    return_1m,
    return_3m,
    aum: Number(f.aum ?? (f.aum_m_thb ? f.aum_m_thb * 1e6 : 0)),
    nav: Number(f.nav ?? f.nav_price ?? 0),
    rank: f.rank || index + 1,
    flows,
  }
}

function normalizeThemeFunds(payload, requestedThemes = []) {
  const source = payload?.data || payload?.theme_funds || payload || {}
  const requested = Array.isArray(requestedThemes) ? requestedThemes : [requestedThemes]
  const result = {}
  requested.forEach((theme) => {
    const tName = labelFromTheme(theme)
    if (tName) result[tName] = []
  })

  // Case 1: source is already an object grouped by theme name: { 'Global Equity': [...], ... }
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    let foundAny = false
    for (const [key, val] of Object.entries(source)) {
      const fundsList = Array.isArray(val) ? val : (Array.isArray(val?.funds) ? val.funds : null)
      if (fundsList) {
        result[key] = fundsList.map(mapFundRecord)
        foundAny = true
      }
    }
    if (foundAny) return result
  }

  // Case 2: source is a flat array of funds
  const funds = Array.isArray(source) ? source : (Array.isArray(source?.funds) ? source.funds : [])
  if (!funds.length) return result

  if (requested.length === 1) {
    const tName = labelFromTheme(requested[0])
    result[tName] = funds.map(mapFundRecord)
    return result
  }

  // Multi-theme: match each fund's aimc_category_name_en against requested themes
  funds.forEach((fund, idx) => {
    const mapped = mapFundRecord(fund, idx)
    const fundCategory = (fund.aimc_category_name_en || fund.sector || fund.category || '').toLowerCase().trim()

    let matchedTheme = requested.find((t) => {
      const target = labelFromTheme(t).toLowerCase().trim()
      return target === fundCategory || fundCategory.includes(target) || target.includes(fundCategory)
    })

    if (!matchedTheme && requested.length > 0) {
      matchedTheme = requested[0]
    }

    if (matchedTheme) {
      const tName = labelFromTheme(matchedTheme)
      if (!result[tName]) result[tName] = []
      result[tName].push(mapped)
    }
  })

  // Ensure rank is 1..N within each theme group
  for (const key of Object.keys(result)) {
    result[key] = result[key].map((f, i) => ({ ...f, rank: i + 1 }))
  }

  return result
}

// -----------------------------------------------------------------
// Sector Trend APIs (Swagger: /api/v1/insights/sectors/*)
// -----------------------------------------------------------------

/** ภาพรวม Sector Trend ทั้ง 4 หมวด */
export async function getInsightSectors(limit = 10) {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors', { limit }))
  }

  return reconGet('/api/v1/insights/sectors', { limit })
}

/** หุ้นไทยที่กองทุนไทยถือครองมากที่สุด */
export async function getInsightSectorsThai(params = {}) {
  const query = { sort_by: 'holding_value', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_thai', query))
  }

  return extractArray(await reconGet('/api/v1/insights/sectors/thai', query))
}

/** หุ้น US/Global ที่กองทุนต่างประเทศถือครองมากที่สุด */
export async function getInsightSectorsForeign(params = {}) {
  const query = { sort_by: 'holding_value', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_foreign', query))
  }

  return extractArray(await reconGet('/api/v1/insights/sectors/foreign', query))
}

/** Sector ของ Foreign Master Funds ตาม AUM/Flow */
export async function getInsightSectorsFeeder(params = {}) {
  const query = { sort_by: 'aum', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_feeder', query))
  }

  return extractArray(await reconGet('/api/v1/insights/sectors/feeder', query))
}

/** สัดส่วนสินทรัพย์กองทุนผสม Mixed Fund */
export async function getInsightSectorsMixed(params = {}) {
  const query = { sort_by: 'aum', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_mixed', query))
  }

  return extractArray(await reconGet('/api/v1/insights/sectors/mixed', query))
}

// -----------------------------------------------------------------
// Flow Trend & Global Flow APIs
// -----------------------------------------------------------------

export async function getFlowTrend(params = {}) {
  const query = { type: 'FOREIGN', limit: 50, ...params }

  if (apiMode === 'wordpress') {
    return wpGet('fund_insights_flow_trend', query)
  }

  return reconGet('/api/v1/insights/flow-trend', query)
}

/**
 * ดึงข้อมูลกระแสเงินลงทุนรายธีม (Global Fund Flow) พร้อม Summary
 * ทำการรวบรวม (aggregate) flow จาก /api/v1/insights/flow-trend ตามหมวดธีม (AIMC Category)
 */
export async function getGlobalFlow(params = {}) {
  const period = typeof params === 'string' ? params : (params?.period || '1M')
  const safeLimit = Math.min(Number(params?.limit || 500), 500)

  if (apiMode === 'wordpress') {
    const payload = await wpGet('fund_insights_global_flow', { period })
    return {
      flows: extractArray(payload, ['flows', 'themes', 'data']),
      summary: payload?.summary || payload?.data?.summary || {},
      updatedAt: payload?.updated_at || payload?.data?.updated_at || null,
      raw: payload,
    }
  }

  // เรียก Backend จริง /api/v1/insights/flow-trend
  const rawPayload = await reconGet('/api/v1/insights/flow-trend', { limit: safeLimit })
  const fundList = extractArray(rawPayload, ['data', 'funds', 'items'])

  // รวมกระแสเงิน (Flow) ตามหมวดหมู่ธีม (AIMC Category)
  const themeMap = {}

  fundList.forEach((fund) => {
    const category = fund.aimc_category_name_en || fund.sector || fund.category || 'Other'
    const aum = Number(fund.aum_m_thb || 0)

    let flowM = 0
    if (period === '1M') {
      flowM = Number(fund.estimated_flow_1m_m_thb ?? (aum * Number(fund.unit_change_1m || 0) / 100))
    } else if (period === 'YTD' || period === '1Y') {
      flowM = Number(fund.estimated_flow_1y_m_thb ?? (aum * Number(fund.unit_change_1y || 0) / 100))
    } else if (period === '1D') {
      flowM = aum * Number(fund.unit_change_1d || 0) / 100
    } else if (period === '1W') {
      flowM = aum * Number(fund.unit_change_1w || 0) / 100
    } else if (period === '3M') {
      flowM = aum * Number(fund.unit_change_3m || 0) / 100
    } else {
      flowM = Number(fund.estimated_flow_1m_m_thb || 0)
    }

    if (!themeMap[category]) {
      themeMap[category] = {
        name: category,
        flow_thb_m: 0,
        count: 0,
        funds: [],
      }
    }

    themeMap[category].flow_thb_m += flowM
    themeMap[category].count += 1
    themeMap[category].funds.push(fund)
  })

  // แปลงหน่วยเป็น USD สำหรับการแสดงผล $B/$M (อัตราแลกเปลี่ยน ~35 THB/USD)
  const flows = Object.values(themeMap).map((t) => {
    const flow_usd = (t.flow_thb_m * 1e6) / 35
    const flow_thb = t.flow_thb_m * 1e6
    return {
      name: t.name,
      theme_name: t.name,
      label: t.name,
      flow_usd,
      flow_thb,
      value: flow_usd,
      flow: flow_usd,
      funds_count: t.count,
      funds: t.funds.map(mapFundRecord),
    }
  })

  const inflows = flows.filter((f) => f.flow_usd >= 0).sort((a, b) => b.flow_usd - a.flow_usd)
  const outflows = flows.filter((f) => f.flow_usd < 0).sort((a, b) => a.flow_usd - b.flow_usd)

  const total_inflow_usd = inflows.reduce((sum, f) => sum + f.flow_usd, 0)
  const total_outflow_usd = outflows.reduce((sum, f) => sum + f.flow_usd, 0)
  const net_flow_usd = total_inflow_usd + total_outflow_usd

  const summary = {
    net_flow_usd,
    total_inflow_usd,
    total_outflow_usd,
    inflow_themes: inflows.length,
    outflow_themes: outflows.length,
  }

  return {
    flows: [...inflows, ...outflows],
    summary,
    updatedAt: rawPayload?.updated_at || new Date().toISOString(),
    raw: rawPayload,
  }
}

// -----------------------------------------------------------------
// Theme APIs (Swagger: /api/v1/insights/themes, /theme-funds)
// -----------------------------------------------------------------

export async function getInsightThemes(limit = 20) {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_themes', { limit }), ['themes', 'data'])
  }

  const payload = await reconGet('/api/v1/insights/themes')
  const rawList = extractArray(payload, ['themes', 'data'])
  return rawList.map((t) => ({
    ...t,
    name: t.theme_name || t.name || t.label,
    theme_name: t.theme_name || t.name || t.label,
    label: t.label || t.theme_name || t.name,
  }))
}

export async function getThemeFunds(themes = [], limit = 10, params = {}) {
  const themeParam = Array.isArray(themes) ? themes.join(',') : themes

  if (!themeParam) return {}

  const query = { themes: themeParam, limit: Math.max(limit * (Array.isArray(themes) ? themes.length : 1), 50), ...params }
  const payload =
    apiMode === 'wordpress'
      ? await wpGet('fund_insights_theme_funds', query)
      : await reconGet('/api/v1/insights/theme-funds', query)

  return normalizeThemeFunds(payload, themes)
}

export async function getThemeFundsRaw(themes = [], limit = 10, params = {}) {
  const themeParam = Array.isArray(themes) ? themes.join(',') : themes

  if (!themeParam) return {}

  const query = { themes: themeParam, limit, ...params }

  return apiMode === 'wordpress'
    ? wpGet('fund_insights_theme_funds', query)
    : reconGet('/api/v1/insights/theme-funds', query)
}

// -----------------------------------------------------------------
// Fund Trend & Valuation APIs (Swagger: /api/v1/insights/trend, valuation)
// -----------------------------------------------------------------

export async function getInsightTrend(params = {}) {
  const query = { type: 'TH', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_trend', query), ['funds', 'data'])
  }

  const payload = await reconGet('/api/v1/insights/trend', query)
  const rawFunds = extractArray(payload, ['funds', 'data'])
  return rawFunds.map(mapFundRecord)
}

export async function getInsightValuation(params = {}) {
  const query = { limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_valuation', query), ['data', 'funds'])
  }

  const payload = await reconGet('/api/v1/insights/valuation', query)
  const rawData = extractArray(payload, ['data', 'funds'])

  return rawData.map((item) => {
    const symbol = item.symbol || item.code || '-'
    const name = item.fund_name || item.name || item.name_th || symbol
    const pe = item.pe_ratio != null ? Number(item.pe_ratio) : null
    const pb = item.pb_ratio != null ? Number(item.pb_ratio) : null
    const aum = Number(item.aum ?? (item.aum_m_thb ? item.aum_m_thb * 1e6 : (item.total_assets_usd ? item.total_assets_usd * 35 : 0)))

    let zone = item.pe_zone || item.zone
    if (!zone) {
      if (pe != null && pe > 0) {
        zone = pe < 15 ? '💎 ถูกมาก' : pe < 25 ? '🟡 เหมาะสม' : '🔴 แพง'
      } else {
        zone = '🟡 เหมาะสม'
      }
    }

    return {
      ...item,
      code: symbol,
      symbol,
      name,
      pe_zone: zone,
      upside_to_avg: item.upside_to_avg ?? (item.dividend_yield != null ? item.dividend_yield : (pb != null ? pb : 0)),
      aum,
    }
  })
}

export async function getInsightPopularity(params = {}) {
  const query = { limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_popularity', query), ['data', 'funds'])
  }

  const payload = await reconGet('/api/v1/insights/popularity', query)
  const rawData = extractArray(payload, ['data', 'funds'])
  return rawData.map(mapFundRecord)
}

export async function getFundTrend(code) {
  if (!code) return {}

  if (apiMode === 'wordpress') {
    return wpGet('fund_fund_trend', { code })
  }

  return reconGet(`/api/v1/funds/${encodeURIComponent(code)}/trend`)
}
