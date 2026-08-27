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
    value.name ||
    value.theme ||
    value.label ||
    value.title ||
    value.category ||
    labelFromTheme(value.themes) ||
    ''
  )
}

function normalizeThemeFunds(payload, requestedThemes = []) {
  const source = payload?.data || payload || {}
  const requested = Array.isArray(requestedThemes) ? requestedThemes : [requestedThemes]
  const firstTheme = requested[0] || ''

  if (Array.isArray(source)) {
    const grouped = {}
    const looksGrouped = source.some((item) => Array.isArray(item?.funds))

    if (!looksGrouped) {
      return firstTheme ? { [firstTheme]: source } : {}
    }

    source.forEach((item) => {
      const name = labelFromTheme(item)
      if (name) grouped[name] = item.funds || []
    })

    return grouped
  }

  if (Array.isArray(source.themes)) {
    return normalizeThemeFunds(source.themes, requested)
  }

  if (Array.isArray(source.theme_funds)) {
    return normalizeThemeFunds(source.theme_funds, requested)
  }

  if (source.theme_funds && typeof source.theme_funds === 'object') {
    return normalizeThemeFunds(source.theme_funds, requested)
  }

  if (Array.isArray(source.funds)) {
    return firstTheme ? { [firstTheme]: source.funds } : {}
  }

  if (source.funds && typeof source.funds === 'object') {
    return normalizeThemeFunds(source.funds, requested)
  }

  return Object.entries(source).reduce((result, [key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value
    } else if (Array.isArray(value?.funds)) {
      result[key] = value.funds
    }

    return result
  }, {})
}

// -----------------------------------------------------------------
// Sector Trend APIs (Swagger: /api/v1/insights/sectors/*)
// -----------------------------------------------------------------

/** ภาพรวม Sector Trend ทั้ง 4 หมวด */
export async function getInsightSectors(limit = 10) {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors', { limit }))
  }

  // Swagger: GET /api/v1/insights/sectors
  return reconGet('/insights/sectors', { limit })
}

/** หุ้นไทยที่กองทุนไทยถือครองมากที่สุด */
export async function getInsightSectorsThai(params = {}) {
  const query = { sort_by: 'holding_value', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_thai', query))
  }

  // Swagger: GET /api/v1/insights/sectors/thai
  return extractArray(await reconGet('/insights/sectors/thai', query))
}

/** หุ้น US/Global ที่กองทุนต่างประเทศถือครองมากที่สุด */
export async function getInsightSectorsForeign(params = {}) {
  const query = { sort_by: 'holding_value', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_foreign', query))
  }

  // Swagger: GET /api/v1/insights/sectors/foreign
  return extractArray(await reconGet('/insights/sectors/foreign', query))
}

/** Sector ของ Foreign Master Funds ตาม AUM/Flow */
export async function getInsightSectorsFeeder(params = {}) {
  const query = { sort_by: 'aum', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_feeder', query))
  }

  // Swagger: GET /api/v1/insights/sectors/feeder
  return extractArray(await reconGet('/insights/sectors/feeder', query))
}

/** สัดส่วนสินทรัพย์กองทุนผสม Mixed Fund */
export async function getInsightSectorsMixed(params = {}) {
  const query = { sort_by: 'aum', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_sectors_mixed', query))
  }

  // Swagger: GET /api/v1/insights/sectors/mixed
  return extractArray(await reconGet('/insights/sectors/mixed', query))
}

// -----------------------------------------------------------------
// Flow Trend API (Swagger: /api/v1/insights/flow-trend)
// -----------------------------------------------------------------

export async function getFlowTrend(params = {}) {
  const query = { type: 'FOREIGN', limit: 50, ...params }

  if (apiMode === 'wordpress') {
    return wpGet('fund_insights_flow_trend', query)
  }

  // Swagger: GET /api/v1/insights/flow-trend
  return reconGet('/insights/flow-trend', query)
}

export async function getGlobalFlow(params = {}) {
  const query = { limit: 50, ...params }

  const payload =
    apiMode === 'wordpress'
      ? await wpGet('fund_insights_global_flow', query)
      : await reconGet('/insights/flow-trend', query)

  return {
    flows: extractArray(payload, ['flows', 'data', 'funds']),
    summary: payload?.summary || payload?.data?.summary || {},
    updatedAt: payload?.updated_at || payload?.data?.updated_at || null,
    raw: payload,
  }
}

// -----------------------------------------------------------------
// Theme APIs (Swagger: /api/v1/insights/themes, /theme-funds)
// -----------------------------------------------------------------

export async function getInsightThemes() {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_themes', {}))
  }

  // Swagger: GET /api/v1/insights/themes
  return extractArray(await reconGet('/insights/themes'))
}

export async function getThemeFunds(themes = [], limit = 10, params = {}) {
  const themeParam = Array.isArray(themes) ? themes.join(',') : themes

  if (!themeParam) return {}

  const query = { themes: themeParam, limit, ...params }
  const payload =
    apiMode === 'wordpress'
      ? await wpGet('fund_insights_theme_funds', query)
      : await reconGet('/insights/theme-funds', query)

  return normalizeThemeFunds(payload, themes)
}

export async function getThemeFundsRaw(themes = [], limit = 10, params = {}) {
  const themeParam = Array.isArray(themes) ? themes.join(',') : themes

  if (!themeParam) return {}

  const query = { themes: themeParam, limit, ...params }

  return apiMode === 'wordpress'
    ? wpGet('fund_insights_theme_funds', query)
    : reconGet('/insights/theme-funds', query)
}

// -----------------------------------------------------------------
// Fund Trend (Swagger: /api/v1/funds/{code}/trend)
// -----------------------------------------------------------------

export async function getFundTrend(code) {
  if (!code) return {}

  if (apiMode === 'wordpress') {
    return wpGet('fund_fund_trend', { code })
  }

  // Swagger: GET /api/v1/funds/{code}/trend
  return reconGet(`/funds/${encodeURIComponent(code)}/trend`)
}

// -----------------------------------------------------------------
// Backward-compatible aliases (สำหรับ code เก่าที่อาจยังเรียกชื่อเหล่านี้)
// -----------------------------------------------------------------

/** @deprecated ใช้ getInsightSectorsForeign แทน */
export async function getInsightTrend(params = {}) {
  return getInsightSectorsForeign({ sort_by: 'holding_value', ...params })
}

/** @deprecated ใช้ getInsightSectorsForeign แทน */
export async function getInsightPopularity(params = {}) {
  return getInsightSectorsForeign({ sort_by: 'flow', ...params })
}

/** @deprecated ใช้ getInsightThemes แทน */
export async function getInsightValuation(params = {}) {
  return getInsightThemes()
}
