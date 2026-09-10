import { computed, reactive, watch } from 'vue'
import { useFundinfoStore } from '../stores/fundinfoStore'
import { membersTrendSeries, CMP_LABELS } from './useFundinfoThemeTrend'

// ==========================================================================
// Section ① Market Lens — แนวโน้มสินทรัพย์ (Mixed Fund)
// Groups mixed funds by each asset class with >= 10% weight in the fund's mix
// (a fund can belong to multiple scopes); chart shows up to 5 lines (3 leading
// + 2 lagging by perf), or a single line when drilled into one scope.
// ==========================================================================

const MAX_LINES = 5
// Name only — no live index-return field exists (see [[project-fundinfo-known-gaps]]).
const BENCH = { name: 'พอร์ตผสม 60/40' }

// Real checkpoint returns averaged across member funds (see
// useFundinfoThemeTrend.js); falls back to a flat 0% line only if none have data.
export function trendSeries(scope) {
  return membersTrendSeries(scope.members, CMP_LABELS.length) || new Array(CMP_LABELS.length).fill(100)
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
  // Store-backed (fundinfoStore.js -> fundinfoApi.js) — scopes/stats recompute
  // automatically once the store's data arrives.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const funds = computed(() => fundinfoStore.getFundsByType(type))

  // /funds/list omits each fund's asset mix (only /funds/{code} has it), so this
  // backfills allocations via the per-fund detail endpoint — cached by
  // fundinfoStore, so it only runs once per fund (same lazy fetch used on
  // row-expand in FundTableWithCompare.vue).
  //
  // Capped to the top BACKFILL_MAX_FUNDS funds by AUM: mixed grew to 473 funds,
  // and an uncapped burst hits the ngrok tunnel's connection-rate ceiling
  // (sockets reset mid-TLS-handshake, not a concurrency limit). Start is delayed
  // to avoid competing with the page's first paint, and a circuit breaker halts
  // the backfill after repeated failures instead of grinding through a dead
  // tunnel. Retry-with-backoff still covers one fund's request landing badly.
  // Non-blocking: the chart renders whatever's loaded so far and fills in as
  // more detail arrives (see `scopes`/`watch` below).
  const BACKFILL_MAX_FUNDS = 80
  const BACKFILL_START_DELAY_MS = 1500
  const DETAIL_BACKFILL_CONCURRENCY = 2
  const DETAIL_BACKFILL_DELAY_MS = 400
  const DETAIL_BACKFILL_RETRY_DELAYS_MS = [1000, 3000]
  const CIRCUIT_BREAKER_MAX_CONSECUTIVE_FAILURES = 6
  let detailBackfillStarted = false

  async function loadFundWithRetry(id) {
    for (const retryDelay of [0, ...DETAIL_BACKFILL_RETRY_DELAYS_MS]) {
      if (retryDelay) await new Promise((resolve) => setTimeout(resolve, retryDelay))
      const fund = await fundinfoStore.loadFundById(id).catch(() => null)
      if (fund) return true
    }
    return false
  }

  async function backfillDetails(list) {
    const queue = [...list]
      .sort((a, b) => (b.aum || 0) - (a.aum || 0))
      .slice(0, BACKFILL_MAX_FUNDS)
      .filter((fund) => !fundinfoStore.hasFundDetail(fund.id))
    let cursor = 0
    let consecutiveFailures = 0
    let circuitOpen = false
    async function worker() {
      while (cursor < queue.length && !circuitOpen) {
        const fund = queue[cursor++]
        const ok = await loadFundWithRetry(fund.id)
        consecutiveFailures = ok ? 0 : consecutiveFailures + 1
        if (consecutiveFailures >= CIRCUIT_BREAKER_MAX_CONSECUTIVE_FAILURES) {
          // Tunnel is clearly down — stop hammering it; unfetched funds just miss
          // a scope-level asset mix this session, nothing else depends on this.
          circuitOpen = true
          return
        }
        await new Promise((resolve) => setTimeout(resolve, DETAIL_BACKFILL_DELAY_MS))
      }
    }
    await Promise.all(Array.from({ length: DETAIL_BACKFILL_CONCURRENCY }, worker))
  }
  watch(
    funds,
    (list) => {
      if (detailBackfillStarted || !list.length) return
      detailBackfillStarted = true
      setTimeout(() => backfillDetails(list), BACKFILL_START_DELAY_MS)
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