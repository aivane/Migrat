import { computed, reactive } from 'vue'
import { useFundinfoStore } from '../stores/fundinfoStore'

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

// Extracted so useFundinfoScreener.js can sort screenedFunds with identical logic (avoid duplicating).
export function sortFundsBy(list, sortBy, sortDir) {
  const dir = sortDir === 'desc' ? -1 : 1
  return [...list].sort((a, b) => {
    const left = a[sortBy]
    const right = b[sortBy]

    if (typeof left === 'string' || typeof right === 'string') {
      return String(left ?? '').localeCompare(String(right ?? '')) * dir
    }

    return ((Number(left) || 0) - (Number(right) || 0)) * dir
  })
}

// Cached per type (like useFundinfoRanking) — FundView and ThaiFundSearchFilterSection
// (via useFundinfoScreener) must share the same state.search/selectedAmc.
const instances = new Map()

export function useFundinfoCategory(type, options = {}) {
  if (instances.has(type)) return instances.get(type)
  const instance = createFundinfoCategory(type, options)
  instances.set(type, instance)
  return instance
}

function createFundinfoCategory(type, { defaultSortBy = 'perf' } = {}) {
  // Store-backed (fundinfoStore.js -> fundinfoApi.js) — nothing here needs to
  // change across API modes.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const funds = computed(() => fundinfoStore.getFundsByType(type))
  const isLoading = computed(() => fundinfoStore.isLoading(type))
  const loadError = computed(() => fundinfoStore.getError(type))

  // Search placeholder promises matching held stocks, but fund.top5 is empty for
  // list-fetched funds (holdings only come from the detail endpoint). /stocks/top
  // already publishes the reverse mapping (topHoldingFundCodes) and is already
  // cached here (Ranking Cards / Exposure Trend), so reuse it instead of an N+1 fetch.
  const stockMarket = type === 'thai' || type === 'mixed' ? 'TH' : 'FOREIGN'
  fundinfoStore.loadTopStocksByMarket(stockMarket)
  const topStocks = computed(() => fundinfoStore.getTopStocksByMarket(stockMarket))

  const state = reactive({
    search: '',
    selectedAmc: '',
    selectedRisk: '',
    sortBy: defaultSortBy,
    sortDir: 'desc',
    expandedId: '',
  })

  const amcOptions = computed(() => unique(funds.value.map((fund) => fund.amc)))

  // Fund codes holding a stock whose name/symbol matches the query — merged into
  // the search haystack so "NVIDIA" finds funds that hold it, not just funds named it.
  const stockMatchedFundIds = computed(() => {
    const query = state.search.trim().toLowerCase()
    if (!query) return null

    const ids = new Set()
    topStocks.value.forEach((stock) => {
      const matches = stock.name.toLowerCase().includes(query) || stock.symbol.toLowerCase().includes(query)
      if (matches) stock.topHoldingFundCodes.forEach((code) => ids.add(code))
    })
    return ids
  })

  const filteredFunds = computed(() => {
    const query = state.search.trim().toLowerCase()
    const stockMatches = stockMatchedFundIds.value

    let rows = funds.value.filter((fund) => {
      if (!query) return true
      const haystack = [fund.id, fund.name, fund.master, fund.country, fund.amc]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query) || stockMatches.has(fund.id)
    })

    if (state.selectedAmc) rows = rows.filter((fund) => fund.amc === state.selectedAmc)
    if (state.selectedRisk) {
      rows = rows.filter((fund) => {
        if (state.selectedRisk === 'low') return fund.risk <= 3
        if (state.selectedRisk === 'medium') return fund.risk >= 4 && fund.risk <= 5
        return fund.risk >= 6
      })
    }

    return rows
  })

  const sortedFunds = computed(() => sortFundsBy(filteredFunds.value, state.sortBy, state.sortDir))

  const summary = computed(() => {
    const list = funds.value
    if (!list.length) {
      return { count: 0, avgPerf: 0, avgFee: 0, totalNetbuy: 0, best: null, mostPopular: null }
    }

    const avgPerf = list.reduce((sum, fund) => sum + fund.perf, 0) / list.length
    const avgFee = list.reduce((sum, fund) => sum + fund.fee, 0) / list.length
    const totalNetbuy = list.reduce((sum, fund) => sum + fund.netbuy, 0)
    const best = [...list].sort((a, b) => b.perf - a.perf)[0]
    const mostPopular = [...list].sort((a, b) => b.pop - a.pop)[0]

    return { count: list.length, avgPerf, avgFee, totalNetbuy, best, mostPopular }
  })

  const topHoldings = computed(() => {
    const totals = new Map()

    filteredFunds.value.forEach((fund) => {
      ;(fund.top5 || []).forEach(({ name, percent }) => {
        totals.set(name, (totals.get(name) || 0) + percent)
      })
    })

    const rows = [...totals.entries()].map(([name, value]) => ({ name, value }))
    const max = Math.max(...rows.map((row) => row.value), 1)

    return rows
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((row) => ({ ...row, percent: (row.value / max) * 100 }))
  })

  function setSort(key) {
    if (state.sortBy === key) {
      state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc'
    } else {
      state.sortBy = key
      state.sortDir = 'desc'
    }
  }

  function toggleExpand(id) {
    state.expandedId = state.expandedId === id ? '' : id
  }

  return {
    funds,
    isLoading,
    loadError,
    state,
    amcOptions,
    filteredFunds,
    sortedFunds,
    summary,
    topHoldings,
    setSort,
    toggleExpand,
  }
}