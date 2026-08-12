import { computed, reactive } from 'vue'
import { fundsByType, INSIGHT } from '../data/fundinfoData'

// ==========================================================================
// Section ① Theme / Sector Trend — "Theme Pulse" (Feeder Fund)
// Ported from renderThemePulse() + computeScopes()/themePulseStats() in the
// fundinfo v3.2.1 HTML prototype. Groups feeder funds by INSIGHT[master].theme
// (falls back to the fund's first tag), then computes momentum/acceleration
// stats per theme so the person can pick up to 7 themes and compare them on
// a single chart.
// ==========================================================================

const GLOBAL_RETURN = 12.8
export const CMP_LABELS = ['ก.ค. 68', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค. 69', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค. 69']
export const COMPARE_COLORS = ['#2456d8', '#0e9f6e', '#e0a411', '#7a5af5', '#e2557a', '#0891b2', '#f04438']
export const COMPARE_DASH = [[], [8, 3], [3, 2], [10, 3, 2, 3], [6, 2], [2, 2], [12, 3]]
const MAX_SELECTED = 7

// Deterministic pseudo-random walk, seeded so charts are stable across
// renders/reloads instead of re-randomizing (same approach as the prototype).
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

function seedFromId(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 71)
}

function trendSeries(scope) {
  return performanceSeries(seedFromId(scope.id), scope.perf)
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
  const funds = fundsByType(type)
  const scopes = computeThemeScopes(funds)
  const stats = scopes.map(themePulseStats)

  const state = reactive({
    view: 'interesting', // 'interesting' (top 3 by momentum) | 'all' (searchable)
    search: '',
    // Open with the strongest themes already selected, so the comparison
    // workspace provides useful information at first glance.
    selected: [...stats]
      .sort((a, b) => b.q1 - a.q1 || b.flow - a.flow)
      .slice(0, 3)
      .map((s) => s.scope.id),
  })

  const positiveCount = stats.filter((s) => s.scope.perf > 0).length
  const acceleratingCount = stats.filter((s) => s.accel > 1).length
  const outperformCount = stats.filter((s) => s.vsGlobal > 0).length

  const interesting = [...stats].sort((a, b) => b.q1 - a.q1 || b.flow - a.flow).slice(0, 3)

  const visibleStats = computed(() => {
    const base = state.view === 'interesting' ? interesting : stats
    const q = state.search.trim().toLowerCase()
    if (!q) return base
    return base.filter((s) =>
      `${s.scope.title} ${s.scope.members.map((f) => f.master || f.name).join(' ')}`
        .toLowerCase()
        .includes(q),
    )
  })

  const selectedStats = computed(() =>
    state.selected.map((id) => stats.find((s) => s.scope.id === id)).filter(Boolean),
  )

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
