import { defineStore } from 'pinia'
import {
  getGlobalFlow,
  getInsightPopularity,
  getInsightThemes,
  getInsightTrend,
  getInsightValuation,
  getThemeFunds,
} from '../services/insightsApi'

const CACHE_TTL_MS = 10 * 60 * 1000
const STORAGE_KEY = 'migrat.insights.cache.v1'
const SUPPORTED_PERIODS = ['1D', '1W', '1M', '3M', 'YTD']

const emptyErrors = () => ({
  trend: null,
  valuation: null,
  popularity: null,
  themes: null,
  globalFlow: null,
  themeFunds: null,
})

function readSessionCache() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeSessionCache(snapshot) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Runtime cache remains available even when sessionStorage is blocked.
  }
}

function errorMessage(error) {
  return error?.message || error?.error || 'โหลดข้อมูลไม่สำเร็จ'
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

export const useInsightsStore = defineStore('insights', {
  state: () => ({
    loadedAt: null,
    period: '1M',
    trendFunds: [],
    valuationFunds: [],
    popularityFunds: [],
    themes: [],
    selectedThemes: [],
    globalFlows: [],
    globalFlowSummary: {},
    themeFunds: {},
    partialErrors: emptyErrors(),
    restoredFromSession: false,
  }),
  getters: {
    hasData: (state) =>
      Boolean(
        state.loadedAt &&
          (state.trendFunds.length ||
            state.valuationFunds.length ||
            state.globalFlows.length ||
            state.themes.length),
      ),
    isFresh: (state) => Boolean(state.loadedAt && Date.now() - state.loadedAt < CACHE_TTL_MS),
    loadedAtLabel: (state) => {
      if (!state.loadedAt) return ''

      return new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(state.loadedAt))
    },
    hasPartialErrors: (state) => Object.values(state.partialErrors).some(Boolean),
    partialErrorList: (state) =>
      Object.entries(state.partialErrors)
        .filter(([, message]) => Boolean(message))
        .map(([key, message]) => ({ key, message })),
  },
  actions: {
    async loadInsights({ force = false, period = this.period } = {}) {
      if (!SUPPORTED_PERIODS.includes(period)) {
        period = '1M'
      }

      this.period = period

      if (!force && !this.hasData) {
        this.restoreFromSession()
      }

      if (!force && this.hasData && this.isFresh && this.period === period) {
        return this.snapshot()
      }

      const tasks = {
        trend: getInsightTrend({ type: 'FOREIGN', limit: 20 }),
        valuation: getInsightValuation({ type: 'FOREIGN', limit: 20 }),
        popularity: getInsightPopularity({ type: 'FOREIGN', limit: 20 }),
        themes: getInsightThemes(12),
        globalFlow: getGlobalFlow(period),
      }

      const keys = Object.keys(tasks)
      const results = await Promise.allSettled(Object.values(tasks))
      const errors = emptyErrors()

      results.forEach((result, index) => {
        const key = keys[index]

        if (result.status === 'rejected') {
          errors[key] = errorMessage(result.reason)
          return
        }

        if (key === 'trend') this.trendFunds = result.value
        if (key === 'valuation') this.valuationFunds = result.value
        if (key === 'popularity') this.popularityFunds = result.value
        if (key === 'themes') this.themes = result.value
        if (key === 'globalFlow') {
          this.globalFlows = result.value.flows
          this.globalFlowSummary = result.value.summary
          if (!this.selectedThemes.length && result.value.flows.length) {
            this.selectedThemes = result.value.flows.slice(0, 2).map(labelFromTheme).filter(Boolean)
          }
        }
      })

      if (this.selectedThemes.length) {
        try {
          this.themeFunds = await getThemeFunds(this.selectedThemes, 10)
        } catch (error) {
          errors.themeFunds = errorMessage(error)
        }
      }

      this.partialErrors = errors
      this.loadedAt = Date.now()
      this.restoredFromSession = false
      writeSessionCache(this.snapshot())

      return this.snapshot()
    },
    async setPeriod(period) {
      if (!SUPPORTED_PERIODS.includes(period)) {
        period = '1M'
      }

      return this.loadInsights({ force: true, period })
    },
    async toggleTheme(themeName) {
      themeName = labelFromTheme(themeName)
      if (!themeName) return this.snapshot()

      const index = this.selectedThemes.indexOf(themeName)

      if (index >= 0) {
        this.selectedThemes.splice(index, 1)
      } else {
        this.selectedThemes.push(themeName)
      }

      if (!this.selectedThemes.length) {
        this.themeFunds = {}
        writeSessionCache(this.snapshot())
        return this.snapshot()
      }

      this.themeFunds = await getThemeFunds(this.selectedThemes, 10)
      writeSessionCache(this.snapshot())
      return this.snapshot()
    },
    clearThemes() {
      this.selectedThemes = []
      this.themeFunds = {}
      writeSessionCache(this.snapshot())
    },
    snapshot() {
      return {
        loadedAt: this.loadedAt,
        period: this.period,
        trendFunds: this.trendFunds,
        valuationFunds: this.valuationFunds,
        popularityFunds: this.popularityFunds,
        themes: this.themes,
        selectedThemes: this.selectedThemes,
        globalFlows: this.globalFlows,
        globalFlowSummary: this.globalFlowSummary,
        themeFunds: this.themeFunds,
        partialErrors: this.partialErrors,
      }
    },
    restoreFromSession() {
      const cached = readSessionCache()

      if (!cached?.loadedAt) return false

      this.loadedAt = cached.loadedAt
      this.period = SUPPORTED_PERIODS.includes(cached.period) ? cached.period : '1M'
      this.trendFunds = cached.trendFunds || []
      this.valuationFunds = cached.valuationFunds || []
      this.popularityFunds = cached.popularityFunds || []
      this.themes = cached.themes || []
      this.selectedThemes = cached.selectedThemes || []
      this.globalFlows = cached.globalFlows || []
      this.globalFlowSummary = cached.globalFlowSummary || {}
      this.themeFunds = cached.themeFunds || {}
      this.partialErrors = cached.partialErrors || emptyErrors()
      this.restoredFromSession = true

      return true
    },
  },
})
