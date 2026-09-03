import { computed, reactive, watch } from 'vue'
import { useFundinfoStore } from '../stores/fundinfoStore'
import { membersTrendSeries, CMP_LABELS } from './useFundinfoThemeTrend'

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

// Real checkpoint returns averaged across the scope's member funds — see
// useFundinfoThemeTrend.js's membersTrendSeries()/checkpointSeries() for how
// this replaces the old seeded-noise fabrication. Falls back to a flat
// 0%-change line only if literally no member fund has any real checkpoint.
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
  // Store-backed (fundinfoStore.js -> fundinfoApi.js): reads local mock data
  // today, will read the real backend once VITE_FUNDINFO_API_MODE flips —
  // scopes/stats recompute automatically once the store's data arrives.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const funds = computed(() => fundinfoStore.getFundsByType(type))

  // API Compatibility — /funds/list never returns a fund's own asset mix
  // (only /funds/{code} does), so computeScopes() below would otherwise
  // always see an empty fund.mix/fund.asset for every fund and group nothing.
  // Backfilling each one's real allocation via the per-fund detail endpoint
  // once — same lazy fetch FundTableWithCompare.vue uses on row-expand — gets
  // cached by fundinfoStore, so this only ever runs once per fund.
  //
  // Bug fix — "mixed" used to be assumed "a small, bounded category (a few
  // dozen funds)", firing every backfill request in one uncapped
  // Promise.all-shaped burst. That assumption broke the moment
  // fundinfoApi.js started including TH-market funds regardless of the
  // (backend-buggy) is_feeder_fund flag: mixed jumped to 473 funds.
  //
  // Bug fix #2 — capping *concurrency* alone (originally 8, then 3) wasn't
  // enough: verified live (dev proxy terminal) that requests were failing
  // not with a clean HTTP error but "Client network socket disconnected
  // before secure TLS connection was established" — the recon API/ngrok
  // tunnel is resetting the connection mid-handshake, before any HTTP layer
  // is even reached. That's consistent with a hard connection-RATE ceiling
  // (e.g. ngrok free tier), not a concurrency one.
  //
  // Bug fix #3 — the user reported the page itself feeling like it "crashes"
  // right on open. Two compounding causes: (a) this backfill used to start
  // `immediate: true` at the exact same moment as every other request the
  // page fires (funds list, stocks/top, portfolio-allocation, nav-history
  // charts elsewhere) — the worst possible instant to also open 473 more
  // connections; (b) it targeted literally every mixed fund with no ceiling,
  // so even a healthy tunnel would be busy for minutes. Fixed by: capping
  // the backfill to the BACKFILL_MAX_FUNDS largest funds by AUM (Market Lens
  // groups by asset-class weight — the biggest funds already cover every
  // real scope; the long tail of small funds barely changes which groups
  // show up), delaying the start so it never competes with the page's own
  // first paint, and a circuit breaker that stops the whole backfill after
  // several failures in a row instead of grinding through hundreds of
  // certain-to-fail requests against a tunnel that's clearly down. Retry
  // with backoff still covers the common case of one fund's request landing
  // in a bad moment (loadFundById() allows a retry: it only marks
  // detailLoaded on success, so a plain re-call after a failure re-fetches).
  // This only slows/eventually-fills-in how fast Market Lens groups appear —
  // the page and chart already render whatever's loaded so far (see the
  // `scopes`/`watch` below), never blocks on the full backfill finishing.
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
          // Backend/tunnel is clearly down right now — stop hammering it.
          // Whatever loaded so far stays; the rest just won't have a
          // scope-level asset mix this session. Nothing else on the page
          // depends on this finishing.
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