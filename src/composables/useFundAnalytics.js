// src/composables/useFundAnalytics.js
//
// Real-API-only fund analytics derivations for a single fund. Never invents
// analytics that the backend doesn't publish — a field with no real source
// renders as '-'/[]/null, handled by the existing "no data" UI states.
//
// Security note: this module never touches user input, the DOM, or
// localStorage — it only shapes numbers/strings that callers bind via
// Vue's `{{ }}` interpolation (auto-escaped), never via v-html. There is
// no injection surface here by construction.
import { computed, ref } from 'vue'
import { fetchFundNavHistory } from '../services/fundinfoApi'

function noSeries() {
  return { labels: [], rawLabels: [], navData: [], totalReturnData: [], benchmarkData: [] }
}

function percentageText(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2)} % ต่อปี` : '-'
}

// Front/back-end fees are one-time transaction fees, not annual — no "ต่อปี" suffix.
function feePercentText(value) {
  const number = Number(value)
  return Number.isFinite(number) ? `${number.toFixed(2)} %` : '-'
}

function finiteApiNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * @param {import('vue').Ref|import('vue').ComputedRef} fundRef - reactive ref to the active fund object (or null)
 */
export function useFundAnalytics(fundRef) {
  const registrationDate = computed(() => fundRef.value?.inceptionDate || '-')

  // turnover_ratio exists on the API record (mapped in fundinfoApi.js) but was
  // 100% null across a 1,244-fund sample (2026-09-10) — schema field added,
  // not populated yet. Renders real data automatically once the backend does.
  const turnoverRatio = computed(() => {
    const value = fundRef.value?.turnoverRatio
    return typeof value === 'number' && Number.isFinite(value) ? percentageText(value) : '-'
  })

  const countryAllocation = computed(() => {
    const f = fundRef.value
    return f && Array.isArray(f.countryAllocation) ? f.countryAllocation : []
  })

  const topHoldings = computed(() => {
    const f = fundRef.value
    return f && Array.isArray(f.top5) ? f.top5.slice(0, 10) : []
  })

  // ---------- Investment-policy bullet copy ----------
  const policyBullets = computed(() => {
    const f = fundRef.value
    if (!f) return []
    return [
      f.group ? `หมวดหมู่กองทุน: ${f.group}` : '',
      f.master ? `กองทุนหลัก: ${f.master}` : '',
      f.dividendPolicy ? `นโยบายการจ่ายปันผล: ${f.dividendPolicy}` : '',
    ].filter(Boolean)
  })

  // ---------- Benchmark / alpha / beta / recovery ----------
  // recovery_period (recoveryPeriodMonths, mapped in fundinfoApi.js) was 100%
  // null across a 1,244-fund sample (2026-09-10) — schema field added, not
  // populated yet — so `available` still resolves false for every fund today.
  // Wired for real now so recoveringPeriodText below picks up real values
  // automatically once the backend starts sending them, no further changes.
  const alphaBetaRecover = computed(() => {
    const f = fundRef.value
    if (!f) return { alpha: 0, beta: 0, recover: 0 }
    const recover = finiteApiNumber(f.recoveryPeriodMonths)
    return { alpha: finiteApiNumber(f.alpha), beta: finiteApiNumber(f.beta), recover, available: recover !== null }
  })

  const recoveringPeriodText = computed(() => {
    if (alphaBetaRecover.value.available === false) return '-'
    const months = alphaBetaRecover.value.recover
    const years = Math.floor(months / 12)
    const rem = months % 12
    let text = ''
    if (years > 0) text += `${years} ปี `
    if (rem > 0 || years === 0) text += `${rem} เดือน`
    return text
  })

  // Real peer/category averages the API publishes (fund.categoryAvg, mapped
  // in fundinfoApi.js). Only 3M/6M/1Y have a real source; 3Y/5Y/10Y have no
  // peer-average field at all — those keep returning null (never fabricated),
  // the caller renders null as "-".
  const CATEGORY_AVG_KEY = { q1: 'return3m', m6: 'return6m', y1: 'return1y' }
  function groupAverage(periodKey) {
    const avgKey = CATEGORY_AVG_KEY[periodKey]
    const avg = avgKey ? fundRef.value?.categoryAvg?.[avgKey] : null
    return avg ?? null
  }

  // ---------- Fee schedule (prospectus vs. actual) ----------
  const feeSchedule = computed(() => {
    const f = fundRef.value
    if (!f) return null
    return {
      frontEndProspectus: feePercentText(f.maxFrontEndFee), frontEndActual: feePercentText(f.frontEndFee),
      backEndProspectus: feePercentText(f.maxBackEndFee), backEndActual: feePercentText(f.backEndFee),
      switchInProspectus: '-', switchInActual: '-',
      switchOutProspectus: '-', switchOutActual: '-',
      managementProspectus: '-', managementActual: percentageText(f.managementFee),
      terProspectus: '-', terActual: percentageText(f.fee),
      bid: finiteApiNumber(f.nav),
      offer: finiteApiNumber(f.nav),
      turnoverRatio: '-',
    }
  })

  // ---------- Dividend history ----------
  // No dividend payment-history endpoint (dates/amounts) — only a policy
  // flag/yield %, see context.md §3. FundPerformancePanel.vue already shows
  // the correct "policy pays but no history endpoint yet" message for this.
  const dividendHistory = computed(() => [])

  // ---------- NAV history: real daily series when available ----------
  // The recon API grew a real per-day NAV endpoint (fund/{code}/nav-history)
  // after this chart originally shipped against checkpoint-only returns. It's
  // a plain async GET, so we fetch-and-cache it here (keyed by fund+days) and
  // bump apiNavHistoryVersion so callers watching that ref re-render once the
  // real series lands, instead of making `navHistory()` itself async.
  const apiNavHistoryCache = new Map()
  const apiNavHistoryPending = new Set()
  const apiNavHistoryVersion = ref(0)
  const NAV_HISTORY_DAYS = { '1M': 30, '3M': 90, '1Y': 365, '3Y': 1095, '5Y': 1825, MAX: 3650 }

  function ensureApiNavHistory(fundId, days) {
    const key = `${fundId}:${days}`
    if (apiNavHistoryCache.has(key) || apiNavHistoryPending.has(key)) return
    apiNavHistoryPending.add(key)
    fetchFundNavHistory(fundId, { days })
      .then((points) => {
        apiNavHistoryCache.set(key, points)
        apiNavHistoryVersion.value++
      })
      .finally(() => apiNavHistoryPending.delete(key))
  }

  // Fallback while the real series is loading (or for a fund/range it never
  // covers): the fund profile's checkpoint returns (1M/3M/1Y/3Y/5Y/10Y,
  // already captured into fund.retPRaw) turned into a small real index
  // series (base 100 = today). Every plotted value is still derived directly
  // from the fund's own disclosed return_*, never fabricated.
  const RETURN_CHECKPOINTS = [
    { key: 'y10', days: 3650 },
    { key: 'y5', days: 1825 },
    { key: 'y3', days: 1095 },
    { key: 'y1', days: 365 },
    { key: 'q1', days: 90 },
    { key: 'm1', days: 30 },
  ]

  function apiCheckpointNavHistory(f) {
    const points = RETURN_CHECKPOINTS
      .map(({ key, days }) => ({ days, ret: f.retPRaw?.[key] }))
      .filter((p) => typeof p.ret === 'number' && Number.isFinite(p.ret))
      .sort((a, b) => b.days - a.days) // oldest first

    if (!points.length) return noSeries()

    const navDate = f.navDate ? new Date(f.navDate) : null
    const rawLabels = []
    const navData = []
    points.forEach(({ days, ret }) => {
      navData.push(+(100 / (1 + ret / 100)).toFixed(2))
      if (navDate && !Number.isNaN(navDate.getTime())) {
        const d = new Date(navDate)
        d.setDate(d.getDate() - days)
        rawLabels.push(d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' }))
      } else {
        rawLabels.push(`${days} วันก่อน`)
      }
    })
    rawLabels.push('ปัจจุบัน')
    navData.push(100)

    return { labels: rawLabels, rawLabels, navData, totalReturnData: navData, benchmarkData: [], isDaily: false }
  }

  function apiNavHistory(f, range) {
    const days = NAV_HISTORY_DAYS[range] || NAV_HISTORY_DAYS['1Y']
    ensureApiNavHistory(f.id, days)

    const points = apiNavHistoryCache.get(`${f.id}:${days}`)
    if (!points || !points.length) return apiCheckpointNavHistory(f)

    const rawLabels = points.map((p) => new Date(p.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }))
    const navData = points.map((p) => p.nav)
    const step = Math.max(1, Math.round(points.length / 12))
    const labels = rawLabels.map((l, idx) => (idx % step === 0 || idx === points.length - 1 ? l : ''))

    // No daily benchmark series from the API yet — leave empty rather than
    // fabricate one; FundOverviewPanel already renders an empty benchmark
    // line gracefully.
    return { labels, rawLabels, navData, totalReturnData: navData, benchmarkData: [], isDaily: true }
  }

  // ---------- NAV history (line-chart source) ----------
  function navHistory(range) {
    const f = fundRef.value
    if (!f) return noSeries()
    return apiNavHistory(f, range)
  }

  return {
    registrationDate,
    turnoverRatio,
    countryAllocation,
    topHoldings,
    policyBullets,
    feeSchedule,
    dividendHistory,
    alphaBetaRecover,
    recoveringPeriodText,
    groupAverage,
    navHistory,
    apiNavHistoryVersion,
  }
}
