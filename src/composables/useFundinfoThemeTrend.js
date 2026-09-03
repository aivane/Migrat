import { computed, reactive, watch } from 'vue'
import { INSIGHT } from '../data/fundinfoConstants'
import { useFundinfoStore } from '../stores/fundinfoStore'

// ==========================================================================
// Section ① Theme / Sector Trend — "Theme Pulse" (Feeder Fund)
// Ported from renderThemePulse() + computeScopes()/themePulseStats() in the
// fundinfo v3.2.1 HTML prototype. Groups feeder funds by INSIGHT[master].theme
// (falls back to the fund's first tag), then computes momentum/acceleration
// stats per theme so the person can pick up to 7 themes and compare them on
// a single chart.
// ==========================================================================

const GLOBAL_RETURN = 12.8
const CMP_LABEL_COUNT = 13

// Bug fix — this used to be a hardcoded array frozen at whatever month it was
// written ("ก.ค. 68"–"ก.ค. 69"), so it silently drifted out of sync with the
// real calendar the moment that window passed (e.g. by 2026-09-03 the "today"
// end of that array already pointed at July, two months stale). Build the
// 13-point month timeline relative to the current date instead — last label
// is always the current month, each earlier one steps back a month. Buddhist
// year is shown on the first/last label (to disambiguate the two ends, which
// share the same month name a year apart) and on every January boundary,
// matching the original array's own labeling convention.
const THAI_MONTH_ABBR = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function buddhistYear2Digit(gregorianYear) {
  return String((gregorianYear + 543) % 100).padStart(2, '0')
}

function buildCmpLabels(n = CMP_LABEL_COUNT, today = new Date()) {
  return Array.from({ length: n }, (_, i) => {
    const monthsAgo = n - 1 - i
    const date = new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1)
    const monthAbbr = THAI_MONTH_ABBR[date.getMonth()]
    const showYear = i === 0 || i === n - 1 || date.getMonth() === 0
    return showYear ? `${monthAbbr} ${buddhistYear2Digit(date.getFullYear())}` : monthAbbr
  })
}

export const CMP_LABELS = buildCmpLabels()
export const COMPARE_COLORS = ['#2456d8', '#0e9f6e', '#e0a411', '#7a5af5', '#e2557a', '#0891b2', '#f04438']
export const COMPARE_DASH = [[], [8, 3], [3, 2], [10, 3, 2, 3], [6, 2], [2, 2], [12, 3]]
const MAX_SELECTED = 7

// Deterministic pseudo-random walk, seeded so charts are stable across
// renders/reloads instead of re-randomizing (same approach as the prototype).
// Still used for the fixed benchmark reference line drawn on these charts
// (SET TRI / MSCI ACWI / พอร์ตผสม 60/40) — those returns are hardcoded
// constants with no live API field backing them yet, a separate open item
// from the real per-scope lines below.
export function performanceSeries(seed, fin, n = CMP_LABELS.length) {
  let s = seed
  const noise = [0]
  for (let i = 1; i < n; i++) {
    s = (s * 9301 + 49297) % 233280
    noise.push((s / 233280 - 0.5) * 10 + Math.sin(i * 0.9 + (seed % 5)) * 2.8)
  }
  const end = noise[n - 1]
  return noise.map((v, i) => +(100 + (fin * i) / (n - 1) + v - (end * i) / (n - 1)).toFixed(1))
}

// ==========================================================================
// Real cumulative-return checkpoints (fund.retPRaw — m1/q1/y1/y3/y5/y10, null
// when genuinely unavailable rather than fudged) turned into an index series
// (base 100 = today), sampled onto the CMP_LABELS timeline via linear
// interpolation between real anchors. Every anchor point is real; the line
// between two anchors is a straight-line approximation, not real daily data.
// Shared by useFundinfoInsight.js (single fund/master) and the scope-based
// composables below (averaged across each scope's member funds).
// ==========================================================================
const RETURN_CHECKPOINT_DAYS = { m1: 30, q1: 90, y1: 365, y3: 1095, y5: 1825, y10: 3650 }
const CMP_STEP_DAYS = 365 / 12 // CMP_LABELS spans ~12 months in 13 points

export function checkpointSeries(retPRaw, n = CMP_LABELS.length) {
  if (!retPRaw) return null

  const anchors = Object.entries(RETURN_CHECKPOINT_DAYS)
    .map(([key, days]) => ({ days, ret: retPRaw[key] }))
    .filter((p) => typeof p.ret === 'number' && Number.isFinite(p.ret))
    .sort((a, b) => b.days - a.days) // oldest (largest days-ago) first
    .map((p) => ({ days: p.days, value: 100 / (1 + p.ret / 100) }))

  if (!anchors.length) return null
  anchors.push({ days: 0, value: 100 }) // today

  const series = []
  for (let i = 0; i < n; i++) {
    const targetDays = (n - 1 - i) * CMP_STEP_DAYS
    series.push(interpolateAnchors(anchors, targetDays))
  }
  return series
}

function interpolateAnchors(anchors, targetDays) {
  if (targetDays >= anchors[0].days) return +anchors[0].value.toFixed(1)
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    if (targetDays <= a.days && targetDays >= b.days) {
      const ratio = (a.days - targetDays) / (a.days - b.days)
      return +(a.value + (b.value - a.value) * ratio).toFixed(1)
    }
  }
  return +anchors[anchors.length - 1].value.toFixed(1)
}

// Averages member funds' real checkpoint returns (skipping funds missing a
// given period) into one scope-level retPRaw, then builds its series — used
// by the scope-grouped charts (Theme Pulse / Market Lens / Exposure Trend)
// in place of the old seeded-noise fabrication.
function averageRetPRaw(members) {
  const result = {}
  for (const key of Object.keys(RETURN_CHECKPOINT_DAYS)) {
    const values = (members || [])
      .map((m) => m.retPRaw?.[key])
      .filter((v) => typeof v === 'number' && Number.isFinite(v))
    result[key] = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null
  }
  return result
}

export function membersTrendSeries(members, n = CMP_LABELS.length) {
  return checkpointSeries(averageRetPRaw(members), n)
}

function trendSeries(scope) {
  // Real data can't fill every scope for every horizon (a niche theme with
  // only a couple of very new member funds) — fall back to a flat 0%-change
  // line rather than leaving the sparkline/chart with nothing, same "default
  // a missing period to a neutral value" convention retP already uses below.
  return membersTrendSeries(scope.members) || new Array(CMP_LABELS.length).fill(100)
}

// Group feeder funds by theme (master fund's INSIGHT theme, or first tag).
function computeThemeScopes(funds) {
  const groups = {}
  funds.forEach((fund) => {
    const key = (INSIGHT[fund.master] || {}).theme || fund.themes[0]
    if (!key) return
    ;(groups[key] = groups[key] || []).push(fund)
  })
  return Object.entries(groups).map(([key, members], idx) => ({
    id: key,
    title: key,
    idx,
    members,
    perf: +(members.reduce((sum, f) => sum + f.perf, 0) / members.length).toFixed(1),
    flow: members.reduce((sum, f) => sum + f.netbuy, 0),
  }))
}

function themePulseStats(scope) {
  const series = trendSeries(scope)
  const members = scope.members
  const last = series.length - 1
  const m1 = +(members.reduce((sum, f) => sum + f.retP.m1, 0) / members.length).toFixed(1)
  const q1 = +(members.reduce((sum, f) => sum + f.retP.q1, 0) / members.length).toFixed(1)
  const prior = +(series[last - 3] - series[last - 6]).toFixed(1)
  const momentum = +(series[last] - series[last - 3]).toFixed(1)
  const flow = members.reduce((sum, f) => sum + f.flowP.m1, 0)

  return {
    scope,
    series,
    m1,
    q1,
    prior,
    momentum,
    accel: +(momentum - prior).toFixed(1),
    flow,
    vsGlobal: +(scope.perf - GLOBAL_RETURN).toFixed(1),
    fundCount: members.length,
    sparkColor: scope.perf >= 0 ? '#0e9f6e' : '#dc2626',
  }
}

export function themeStatus(s) {
  if (s.momentum > 0 && s.accel > 1) return { label: '↗ เร่งขึ้น', bg: '#ecfdf3', color: '#047857' }
  if (s.momentum > 0 && s.accel < -1) return { label: '→ บวกแต่ชะลอ', bg: '#f4f0ff', color: '#6941c6' }
  if (s.momentum < 0 && s.accel > 1) return { label: '↗ เริ่มฟื้น', bg: '#fff7e6', color: '#b45309' }
  if (s.momentum < 0) return { label: '↘ อ่อนตัว', bg: '#fef3f2', color: '#dc2626' }
  return { label: '→ ทรงตัว', bg: 'var(--surf2)', color: 'var(--sub)' }
}

// เงินไหลเข้า/ออกแบบย่อ (ล้านบาท -> พันล้านบาท เมื่อเกิน 1,000 ลบ.)
export function formatFlow(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  return abs >= 1000 ? `${(n / 1000).toFixed(2)} พันล.` : `${n.toFixed(0)} ลบ.`
}

export function useFundinfoThemeTrend(type = 'feeder') {
  // Store-backed (fundinfoStore.js -> fundinfoApi.js): reads local mock data
  // today, will read the real backend once VITE_FUNDINFO_API_MODE flips.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const funds = computed(() => fundinfoStore.getFundsByType(type))

  const scopes = computed(() => computeThemeScopes(funds.value))
  const stats = computed(() => scopes.value.map(themePulseStats))

  const state = reactive({
    view: 'interesting', // 'interesting' (top 3 by momentum) | 'all' (searchable)
    search: '',
    selected: [],
  })

  // Open with the strongest themes already selected, so the comparison
  // workspace provides useful information at first glance. Seeded once, the
  // first time stats has data — a later store refresh must not clobber
  // whatever the person has since selected.
  let selectionSeeded = false
  watch(
    stats,
    (value) => {
      if (selectionSeeded || !value.length) return
      selectionSeeded = true
      state.selected = [...value]
        .sort((a, b) => b.q1 - a.q1 || b.flow - a.flow)
        .slice(0, 3)
        .map((s) => s.scope.id)
    },
    { immediate: true },
  )

  const selectedStats = computed(() =>
    state.selected.map((id) => stats.value.find((s) => s.scope.id === id)).filter(Boolean),
  )

  // Scoped to the themes currently plotted on the comparison chart
  // (selectedStats), not every theme that exists — the summary badges above
  // the chart should read "of what you're looking at", not "of everything".
  const positiveCount = computed(() => selectedStats.value.filter((s) => s.scope.perf > 0).length)
  const acceleratingCount = computed(() => selectedStats.value.filter((s) => s.accel > 1).length)
  const outperformCount = computed(() => selectedStats.value.filter((s) => s.vsGlobal > 0).length)

  const interesting = computed(() => [...stats.value].sort((a, b) => b.q1 - a.q1 || b.flow - a.flow).slice(0, 3))

  const visibleStats = computed(() => {
    const base = state.view === 'interesting' ? interesting.value : stats.value
    const q = state.search.trim().toLowerCase()
    if (!q) return base
    return base.filter((s) =>
      `${s.scope.title} ${s.scope.members.map((f) => f.master || f.name).join(' ')}`
        .toLowerCase()
        .includes(q),
    )
  })

  const maxReached = computed(() => state.selected.length >= MAX_SELECTED)

  function orderOf(id) {
    return state.selected.indexOf(id)
  }

  function toggle(id) {
    const at = state.selected.indexOf(id)
    if (at > -1) {
      state.selected.splice(at, 1)
    } else if (state.selected.length < MAX_SELECTED) {
      state.selected.push(id)
    }
  }

  function clear() {
    state.selected = []
  }

  function setView(view) {
    state.view = view
  }

  return {
    stats,
    state,
    visibleStats,
    selectedStats,
    positiveCount,
    acceleratingCount,
    outperformCount,
    maxReached,
    maxSelected: MAX_SELECTED,
    orderOf,
    toggle,
    clear,
    setView,
  }
}
