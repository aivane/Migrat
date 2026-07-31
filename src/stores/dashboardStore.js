import { defineStore } from 'pinia'
import {
  getDashboardStats,
  getFundList,
  getMasterEtfs,
  getPortfolioAllocation,
  getThaiEtfs,
  getTopStocks,
  searchFunds,
} from '../services/fundApi'

const CACHE_TTL_MS = 10 * 60 * 1000
const STORAGE_KEY = 'migrat.dashboard.cache.v1'

const emptyErrors = () => ({
  allocation: null,
  statsForeign: null,
  statsTH: null,
  topForeign: null,
  topTH: null,
  masterEtfs: null,
  thaiEtfs: null,
  fundsForeign: null,
  fundsTH: null,
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
    // Ignore storage quota/private mode errors. Runtime cache still works.
  }
}

function errorMessage(error) {
  return error?.message || error?.error || 'โหลดข้อมูลไม่สำเร็จ'
}

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    loadedAt: null,
    lastSearchAt: null,
    stats: {
      FOREIGN: null,
      TH: null,
    },
    topStocks: {
      FOREIGN: [],
      TH: [],
    },
    funds: {
      FOREIGN: [],
      TH: [],
    },
    totals: {
      FOREIGN: 0,
      TH: 0,
    },
    masterEtfs: [],
    thaiEtfs: [],
    portfolioAllocation: null,
    searchCache: {},
    partialErrors: emptyErrors(),
    restoredFromSession: false,
  }),
  getters: {
    hasDashboardData: (state) =>
      Boolean(state.loadedAt && (state.funds.FOREIGN.length || state.funds.TH.length)),
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
    async loadDashboard({ force = false } = {}) {
      if (!force && !this.hasDashboardData) {
        this.restoreFromSession()
      }

      if (!force && this.hasDashboardData && this.isFresh) {
        return this.snapshot()
      }

      const tasks = {
        allocation: getPortfolioAllocation(),
        statsForeign: getDashboardStats('FOREIGN', '1M'),
        statsTH: getDashboardStats('TH', '1M'),
        topForeign: getTopStocks('FOREIGN', 20),
        topTH: getTopStocks('TH', 20),
        masterEtfs: getMasterEtfs('1M'),
        thaiEtfs: getThaiEtfs('1M'),
        fundsForeign: getFundList({
          type: 'FOREIGN',
          sort_by: 'aum',
          sort_dir: 'desc',
          per_page: 100,
          page: 1,
        }),
        fundsTH: getFundList({ type: 'TH', sort_by: 'aum', sort_dir: 'desc', per_page: 100, page: 1 }),
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

        const value = result.value

        if (key === 'allocation') this.portfolioAllocation = value
        if (key === 'statsForeign') this.stats.FOREIGN = value
        if (key === 'statsTH') this.stats.TH = value
        if (key === 'topForeign') this.topStocks.FOREIGN = value
        if (key === 'topTH') this.topStocks.TH = value
        if (key === 'masterEtfs') this.masterEtfs = value
        if (key === 'thaiEtfs') this.thaiEtfs = value
        if (key === 'fundsForeign') {
          this.funds.FOREIGN = value.funds
          this.totals.FOREIGN = value.total
        }
        if (key === 'fundsTH') {
          this.funds.TH = value.funds
          this.totals.TH = value.total
        }
      })

      this.partialErrors = errors
      this.loadedAt = Date.now()
      this.restoredFromSession = false
      writeSessionCache(this.snapshot())

      return this.snapshot()
    },
    async searchBySymbols(symbols) {
      const key = symbols.map((symbol) => symbol.toUpperCase()).sort().join(',')

      if (this.searchCache[key]) {
        return this.searchCache[key]
      }

      const result = await searchFunds(symbols)
      this.searchCache[key] = result
      this.lastSearchAt = Date.now()

      return result
    },
    snapshot() {
      return {
        portfolioAllocation: this.portfolioAllocation,
        stats: this.stats,
        topStocks: this.topStocks,
        masterEtfs: this.masterEtfs,
        thaiEtfs: this.thaiEtfs,
        funds: this.funds,
        totals: this.totals,
        loadedAt: this.loadedAt,
        partialErrors: this.partialErrors,
      }
    },
    restoreFromSession() {
      const cached = readSessionCache()

      if (!cached?.loadedAt) return false

      this.portfolioAllocation = cached.portfolioAllocation || null
      this.stats.FOREIGN = cached.stats?.FOREIGN || null
      this.stats.TH = cached.stats?.TH || null
      this.topStocks.FOREIGN = cached.topStocks?.FOREIGN || []
      this.topStocks.TH = cached.topStocks?.TH || []
      this.masterEtfs = cached.masterEtfs || []
      this.thaiEtfs = cached.thaiEtfs || []
      this.funds.FOREIGN = cached.funds?.FOREIGN || []
      this.funds.TH = cached.funds?.TH || []
      this.totals.FOREIGN = cached.totals?.FOREIGN || 0
      this.totals.TH = cached.totals?.TH || 0
      this.loadedAt = cached.loadedAt
      this.partialErrors = cached.partialErrors || emptyErrors()
      this.restoredFromSession = true

      return true
    },
  },
})
