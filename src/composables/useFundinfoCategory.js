import { computed, reactive } from 'vue'
import { fundsByType } from '../data/fundinfoData'

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

// เอาออกมาเป็น util แยกเพราะ useFundinfoScreener.js ต้องเรียง screenedFunds (ผลลัพธ์หลังผ่าน
// ตัวกรองขั้นสูงเพิ่มเติม) ด้วย logic การเรียงเดียวกันเป๊ะๆ กับตารางกองทุนปกติ ไม่อยากก็อปโค้ดซ้ำ
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

// instances ถูก cache ต่อ type (เหมือน useFundinfoRanking) เพราะตอนนี้มีมากกว่าหนึ่งจุดที่ต้อง
// อ่าน/เขียน state เดียวกันของแต่ละแท็บ — ตาราง FundView เดิม กับ ThaiFundSearchFilterSection.vue
// (ผ่าน useFundinfoScreener) ต้องเห็น state.search / state.selectedAmc ชุดเดียวกัน ไม่งั้นพิมพ์ค้นหา
// ในกล่องค้นหาใหม่แล้วตารางจะไม่กรองตาม
const instances = new Map()

export function useFundinfoCategory(type, options = {}) {
  if (instances.has(type)) return instances.get(type)
  const instance = createFundinfoCategory(type, options)
  instances.set(type, instance)
  return instance
}

function createFundinfoCategory(type, { defaultSortBy = 'perf' } = {}) {
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

  const sortedFunds = computed(() => sortFundsBy(filteredFunds.value, state.sortBy, state.sortDir))

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