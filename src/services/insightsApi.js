import { apiMode, reconGet, wpGet } from './apiClient'

function extractArray(payload, keys = ['funds', 'themes', 'flows', 'data']) {
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

export async function getInsightTrend(params = {}) {
  const query = { type: 'FOREIGN', sort_by: 'return_1y', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_trend', query))
  }

  return extractArray(await reconGet('/insights/trend', query))
}

export async function getInsightValuation(params = {}) {
  const query = { type: 'FOREIGN', sort_by: 'pe_discount', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_valuation', query))
  }

  return extractArray(await reconGet('/insights/valuation', query))
}

export async function getInsightPopularity(params = {}) {
  const query = { type: 'FOREIGN', limit: 20, ...params }

  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_popularity', query))
  }

  return extractArray(await reconGet('/insights/popularity', query))
}

export async function getInsightThemes(limit = 12) {
  if (apiMode === 'wordpress') {
    return extractArray(await wpGet('fund_insights_themes', { limit }))
  }

  return extractArray(await reconGet('/insights/themes', { limit }))
}

export async function getGlobalFlow(period = '1M') {
  const payload =
    apiMode === 'wordpress'
      ? await wpGet('fund_insights_global_flow', { period })
      : await reconGet('/insights/global-flow', { period })

  return {
    flows: extractArray(payload, ['flows', 'themes', 'data']),
    summary: payload?.summary || payload?.data?.summary || {},
    updatedAt: payload?.updated_at || payload?.data?.updated_at || null,
    raw: payload,
  }
}

export async function getFlowTrend(params = {}) {
  const query = { type: 'FOREIGN', period: '1M', ...params }

  if (apiMode === 'wordpress') {
    return wpGet('fund_insights_flow_trend', query)
  }

  return reconGet('/insights/flow-trend', query)
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

export async function getFundTrend(code) {
  if (!code) return {}

  if (apiMode === 'wordpress') {
    return wpGet('fund_fund_trend', { code })
  }

  return reconGet(`/funds/${encodeURIComponent(code)}/trend`)
}
