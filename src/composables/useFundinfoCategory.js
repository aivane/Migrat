import { computed, reactive } from 'vue'
import { fundsByType } from '../data/fundinfoData'

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function useFundinfoCategory(type, { defaultSortBy = 'perf' } = {}) {
  const funds = fundsByType(type)

  const state = reactive({
    search: '',
    selectedAmc: '',
    selectedRisk: '',
    sortBy: defaultSortBy,
    sortDir: 'desc',
    expandedId: '',
  })

  const amcOptions = computed(() => unique(funds.map((fund) => fund.amc)))

  const filteredFunds = computed(() => {
    const query = state.search.trim().toLowerCase()

    let rows = funds.filter((fund) => {
      if (!query) return true
      const haystack = [fund.id, fund.name, fund.master, fund.country, fund.amc]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
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

  const sortedFunds = computed(() =>
    [...filteredFunds.value].sort((a, b) => {
      const left = a[state.sortBy]
      const right = b[state.sortBy]
      const dir = state.sortDir === 'desc' ? -1 : 1

      if (typeof left === 'string' || typeof right === 'string') {
        return String(left ?? '').localeCompare(String(right ?? '')) * dir
      }

      return ((Number(left) || 0) - (Number(right) || 0)) * dir
    }),
  )

  const summary = computed(() => {
    if (!funds.length) {
      return { count: 0, avgPerf: 0, avgFee: 0, totalNetbuy: 0, best: null, mostPopular: null }
    }

    const avgPerf = funds.reduce((sum, fund) => sum + fund.perf, 0) / funds.length
    const avgFee = funds.reduce((sum, fund) => sum + fund.fee, 0) / funds.length
    const totalNetbuy = funds.reduce((sum, fund) => sum + fund.netbuy, 0)
    const best = [...funds].sort((a, b) => b.perf - a.perf)[0]
    const mostPopular = [...funds].sort((a, b) => b.pop - a.pop)[0]

    return { count: funds.length, avgPerf, avgFee, totalNetbuy, best, mostPopular }
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
