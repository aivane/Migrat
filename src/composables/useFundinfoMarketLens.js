import { computed, reactive, watch } from 'vue'
import { useFundinfoStore } from '../stores/fundinfoStore'
import { performanceSeries, CMP_LABELS } from './useFundinfoThemeTrend'

// ==========================================================================
// Section ① Market Lens — แนวโน้มสินทรัพย์ (Mixed Fund)
// Ported from computeScopes() (else branch), trendStats(), trendLeaders(),
// trendBenchmark(), renderTrend() and buildTrendChart() in the fundinfo
// v3.2.1 HTML prototype. Groups mixed funds by each asset class that makes
// up >= 10% of the fund's mix (a fund can belong to more than one scope),
// then shows up to 5 lines on one chart — 3 leading + 2 lagging by perf,
// or a single line when the person drills into one scope.
// ==========================================================================

const MAX_LINES = 5
const BENCH = { name: 'พอร์ตผสม 60/40', ret: 5.4 }

function seedFromId(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 71)
}

export function trendSeries(scope) {
  return performanceSeries(seedFromId(scope.id), scope.perf, CMP_LABELS.length)
}

// จัดกลุ่มกองทุนผสมตามสินทรัพย์ที่มีน้ำหนัก >= 10% ในพอร์ต (กองเดียวอยู่ได้หลายหมวด)
function computeScopes(funds) {
  const groups = {}
  funds.forEach((fund) => {
    ;(fund.mix || fund.asset || []).forEach((item) => {
      if (item.percent < 10) return
      ;(groups[item.name] = groups[item.name] || []).push(fund)
    })
  })
  return Object.entries(groups).map(([key, list], idx) => {
    const members = [...new Map(list.map((f) => [f.id, f])).values()]
    return {
      id: key,
      title: key,
      idx,
      members,
      perf: +(members.reduce((sum, f) => sum + f.perf, 0) / members.length).toFixed(1),
      flow: members.reduce((sum, f) => sum + f.netbuy, 0),
    }
  })
}

function trendStats(scope) {
  const data = trendSeries(scope)
  return {
    scope,
    data,
    momentum: +(data.at(-1) - data.at(-4)).toFixed(1),
  }
}

export function useFundinfoMarketLens(type = 'mixed') {
  // Store-backed (fundinfoStore.js -> fundinfoApi.js): reads local mock data
  // today, will read the real backend once VITE_FUNDINFO_API_MODE flips —
  // scopes/stats recompute automatically once the store's data arrives.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const funds = computed(() => fundinfoStore.getFundsByType(type))

  // API Compatibility — /funds/list never returns a fund's own asset mix
  // (only /funds/{code} does), so computeScopes() below would otherwise
  // always see an empty fund.mix/fund.asset for every fund and group nothing.
  // "Mixed" is a small, bounded category (a few dozen funds), so backfilling
  // each one's real allocation via the per-fund detail endpoint once — same
  // lazy fetch FundTableWithCompare.vue uses on row-expand — is cheap and
  // gets cached by fundinfoStore, so this only ever runs once per fund.
  let detailBackfillStarted = false
  watch(
    funds,
    (list) => {
      if (detailBackfillStarted || !list.length) return
      detailBackfillStarted = true
      list.forEach((fund) => {
        if (!fundinfoStore.hasFundDetail(fund.id)) fundinfoStore.loadFundById(fund.id)
      })
    },
    { immediate: true },
  )

  const scopes = computed(() => computeScopes(funds.value))
  const stats = computed(() => scopes.value.map(trendStats))

  const state = reactive({
    scope: null, // scope id ที่เจาะดูอยู่ (null = ภาพรวมตลาด)
  })

  const leader = computed(() => [...stats.value].sort((a, b) => b.scope.perf - a.scope.perf)[0])
  const laggard = computed(() => [...stats.value].sort((a, b) => a.scope.perf - b.scope.perf)[0])
  const momentumTop = computed(() => [...stats.value].sort((a, b) => b.momentum - a.momentum)[0])
  const positiveCount = computed(() => scopes.value.filter((s) => s.perf > 0).length)

  const activeStat = computed(() => stats.value.find((s) => s.scope.id === state.scope) || null)

  // เส้นที่แสดงบนกราฟ: เจาะดูหมวดเดียวถ้าเลือกไว้ ไม่งั้นแสดง 3 กลุ่มนำ + 2 กลุ่มตาม (ไม่เกิน 5 เส้น)
  const chartLines = computed(() => {
    if (activeStat.value) return [activeStat.value]
    const ranked = [...stats.value].sort((a, b) => b.scope.perf - a.scope.perf)
    const picked = [...ranked.slice(0, 3), ...ranked.slice(-2)]
    const seen = new Set()
    return picked
      .filter((s) => {
        if (seen.has(s.scope.id)) return false
        seen.add(s.scope.id)
        return true
      })
      .slice(0, MAX_LINES)
  })

  const chartTitle = computed(() =>
    state.scope ? `แนวโน้ม ${state.scope}` : 'ภาพตลาด: 3 กลุ่มนำและ 2 กลุ่มตาม',
  )

  function setScope(id) {
    state.scope = state.scope === id ? null : id
  }

  function clearScope() {
    state.scope = null
  }

  return {
    scopes,
    stats,
    state,
    leader,
    laggard,
    momentumTop,
    positiveCount,
    chartLines,
    chartTitle,
    bench: BENCH,
    setScope,
    clearScope,
  }
}