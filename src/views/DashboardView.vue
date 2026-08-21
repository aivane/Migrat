<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useDashboardStore } from '../stores/dashboardStore'

const dashboardStore = useDashboardStore()

const state = reactive({
  sortBy: 'aum',
  sortDir: 'desc',
  searchInput: '',
  searchSymbols: [],
  searchMode: false,
  searchFunds: [],
  page: 1,
  perPage: 10,
  selectedAmc: '',
  selectedFundType: '',
  selectedSector: '',
  selectedRisk: '',
  minReturn: '',
  stats: { FOREIGN: null, TH: null },
  topStocks: { FOREIGN: [], TH: [] },
  funds: { FOREIGN: [], TH: [] },
  totals: { FOREIGN: 0, TH: 0 },
  masterEtfs: [],
  thaiEtfs: [],
  portfolioAllocation: null,
  loadedAt: null,
  partialErrors: {},
})

const loading = reactive({ page: true, funds: true, search: false })
const errorMessage = ref('')

// ── Cache / Partial-error messages ──────────────────────────────────────────
const cacheMessage = computed(() => {
  if (!dashboardStore.loadedAtLabel) return ''
  const source = dashboardStore.restoredFromSession ? 'จาก session cache' : 'ในหน้านี้'
  return `ข้อมูล${source} ถูก cache ไว้ล่าสุด ${dashboardStore.loadedAtLabel}`
})

const partialErrorMessage = computed(() => {
  if (!dashboardStore.hasPartialErrors) return ''
  return `โหลดข้อมูลได้บางส่วน (${dashboardStore.partialErrorList.length} endpoint มีปัญหา) ข้อมูลที่โหลดสำเร็จยังแสดงได้ตามปกติ`
})

// ── 1. Portfolio Allocation Normalization ────────────────────────────────────
const ALLOC_META = [
  { key: 'feeder_fund', label: 'Feeder Fund', color: '#FF6633', icon: '🔍', bg: '#fff7ed' },
  { key: 'off_shore',   label: 'Off Shore',   color: '#06b6d4', icon: '🌎', bg: '#ecfeff' },
  { key: 'thai_fund',   label: 'Thai Fund',   color: '#FF0066', icon: 'TH', bg: '#ffe4e6', isBadge: true },
  { key: 'mixed_fund',  label: 'Mixed Fund',  color: '#f59e0b', icon: '📊', bg: '#fef3c7' },
]

const allocationTotal = computed(() => {
  const alloc = state.portfolioAllocation
  if (!alloc) return 0
  const src = alloc?.data || alloc
  return Number(src?.total_holdings_value ?? src?.total ?? src?.total_value ?? 0)
})

const allocationSegments = computed(() => {
  const alloc = state.portfolioAllocation
  if (!alloc) return []
  const src = alloc?.data || alloc
  const total = allocationTotal.value
  const port = src?.portfolio_allocation || src

  return ALLOC_META.map(meta => {
    const item = port?.[meta.key]
    if (item === undefined || item === null) return null

    let pct = 0
    let val = 0
    if (typeof item === 'object') {
      pct = Number(item.pct ?? item.percent ?? item.percentage ?? 0)
      val = Number(item.val ?? item.value ?? item.amount ?? 0)
    } else {
      val = Number(item || 0)
      pct = total > 0 ? (val / total) * 100 : (val <= 100 ? val : 0)
    }

    return {
      ...meta,
      pct: pct.toFixed(1),
      rawPct: pct,
      val,
    }
  }).filter(Boolean)
})

// ── 2. Stats Panels Normalization ────────────────────────────────────────────
function normalizeStats(stats) {
  const cards  = stats?.cards  ?? stats?.data?.cards  ?? {}
  const charts = stats?.charts ?? stats?.data?.charts ?? {}
  return {
    cards,
    totalFunds:       cards.total_funds ?? 0,
    topSector:        cards.top_sector ?? null,
    topFlowFund:      cards.top_inflow_fund ?? cards.top_incoming_fund_1m ?? null,
    sectorAllocation: Array.isArray(charts.sector_allocation)  ? charts.sector_allocation.slice(0, 8)  : [],
    countryAllocation:Array.isArray(charts.country_allocation) ? charts.country_allocation.slice(0, 8) : [],
  }
}

const foreignStats = computed(() => normalizeStats(state.stats.FOREIGN))
const thaiStats    = computed(() => normalizeStats(state.stats.TH))

// ── 3. Fund Tables Filtering & Sorting ───────────────────────────────────────
function filterAndSort(funds, type) {
  let rows = funds.filter(f => f.target_type === type)
  if (state.selectedAmc)      rows = rows.filter(f => String(f.amc || '').trim() === state.selectedAmc)
  if (state.selectedFundType) rows = rows.filter(f => String(f.fund_type || '').trim() === state.selectedFundType)
  if (state.selectedSector)   {
    const secTarget = state.selectedSector.trim().toLowerCase()
    rows = rows.filter(f => {
      const sec = String(f.sector || '').trim().toLowerCase()
      const typeStr = String(f.fund_type || '').trim().toLowerCase()
      const nameStr = String(f.name || '').trim().toLowerCase()
      return sec.includes(secTarget) || secTarget.includes(sec) || typeStr.includes(secTarget) || nameStr.includes(secTarget)
    })
  }
  if (state.selectedRisk) {
    rows = rows.filter(f => {
      if (state.selectedRisk === 'low')    return f.risk <= 3
      if (state.selectedRisk === 'medium') return f.risk >= 4 && f.risk <= 5
      return f.risk >= 6
    })
  }
  if (state.minReturn !== '') rows = rows.filter(f => f.ret >= Number(state.minReturn))
  return rows.sort((a, b) => {
    const l = Number(a[state.sortBy] ?? 0)
    const r = Number(b[state.sortBy] ?? 0)
    return (l - r) * (state.sortDir === 'desc' ? -1 : 1)
  })
}

const activeFundsForeign = computed(() => filterAndSort(
  state.searchMode ? state.searchFunds : state.funds.FOREIGN, 'FOREIGN'
))
const activeFundsTH = computed(() => filterAndSort(
  state.searchMode ? state.searchFunds : state.funds.TH, 'TH'
))

const totalPages = computed(() =>
  Math.max(1,
    Math.ceil(activeFundsForeign.value.length / state.perPage),
    Math.ceil(activeFundsTH.value.length     / state.perPage),
  )
)

const pagedForeignFunds = computed(() => {
  const s = (state.page - 1) * state.perPage
  return activeFundsForeign.value.slice(s, s + state.perPage)
})
const pagedThaiFunds = computed(() => {
  const s = (state.page - 1) * state.perPage
  return activeFundsTH.value.slice(s, s + state.perPage)
})

const filterOptions = computed(() => {
  const rows = state.searchMode
    ? state.searchFunds
    : [...state.funds.FOREIGN, ...state.funds.TH]
  return {
    amcs:      unique(rows.map(f => f.amc)),
    fundTypes: unique(rows.map(f => f.fund_type)),
    sectors:   unique(rows.map(f => f.sector)),
  }
})

const hasVisibleFunds = computed(() => state.funds.FOREIGN.length || state.funds.TH.length)
const totalFunds      = computed(() => (state.totals.FOREIGN || state.funds.FOREIGN.length) + (state.totals.TH || state.funds.TH.length))

const visiblePages = computed(() => {
  const pages = []
  for (let p = 1; p <= Math.min(totalPages.value, 10); p++) pages.push(p)
  return pages
})

// ── Helpers ───────────────────────────────────────────────────────────────────
function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

function formatCompact(value) {
  const n   = Number(value ?? 0)
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9)  return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6)  return `${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3)  return `${(n / 1e3).toFixed(0)}K`
  return n.toFixed(0)
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString('en-US')
}

function formatCurrency(value) {
  const n = Number(value ?? 0)
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(value) {
  const n = Number(value ?? 0)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function riskClass(risk) {
  if (risk <= 3) return 'risk-low'
  if (risk <= 5) return 'risk-med'
  return 'risk-high'
}

function barRows(items) {
  if (!Array.isArray(items)) return []
  const total = items.reduce((s, i) => s + Number(i.value ?? i.percent ?? 0), 0)
  return items.map(i => {
    const rawVal = Number(i.value ?? i.percent ?? 0)
    const pct = total > 100 ? (rawVal / total) * 100 : rawVal
    return {
      name:  i.name ?? i.symbol ?? '-',
      value: pct,
    }
  })
}

function topStockRows(items) {
  if (!Array.isArray(items)) return []
  const total = items.reduce((s, i) => s + Number(i.total_thai_fund_value ?? 0), 0)
  return items.slice(0, 10).map(i => ({
    name:  i.symbol ?? i.name ?? '-',
    value: total ? (Number(i.total_thai_fund_value ?? 0) / total) * 100 : Number(i.percent ?? 0),
  }))
}

function getEtfFlow(etf) {
  return Number(etf.flow_net_usd ?? etf.flow_net_thb ?? etf.flow ?? etf.flow_change ?? etf.unit_change ?? etf.value ?? 0)
}

function getEtfFundCount(etf) {
  if (etf.holders !== undefined && etf.holders !== null) return Number(etf.holders)
  const thC = Number(etf.thai_fund_count || 0)
  const foC = Number(etf.foreign_fund_count || 0)
  return thC + foC
}

// ── Search Holder Normalizer ────────────────────────────────────────────────
function detectTargetType(code, rawType, match) {
  if (rawType === 'FOREIGN' || rawType === 'TH') return rawType
  if (match?.target_type) return match.target_type

  const upper = String(code || '').toUpperCase()
  const thaiPrefixes = ['K-', 'SCB', 'B-', 'TMB', 'ONE-', 'KKP', 'LH', 'KSAM', 'AIA', 'DAOL', 'MFC', 'TISCO', 'PRINCIPAL', 'UOB', 'KF', 'M-', 'KT-', 'ASSET', 'P-', 'AB-', 'TALIS']
  if (thaiPrefixes.some(p => upper.startsWith(p))) return 'TH'

  return 'FOREIGN'
}

function normalizeSearchHolder(h, allLoadedFunds) {
  const code = String(h.code || '').trim().toUpperCase()
  const match = allLoadedFunds.find(f => String(f.code || '').trim().toUpperCase() === code)
  const targetType = detectTargetType(code, h.target_type, match)

  return {
    target_type: targetType,
    code: h.code || match?.code || code,
    name: h.name_th || h.name || match?.name || h.code || code,
    amc: h.amc || match?.amc || '',
    risk: Number(h.risk ?? match?.risk ?? 6),
    ret: Number(h.return_1y ?? h.ret ?? match?.ret ?? 0),
    r1m: Number(h.return_1m ?? match?.r1m ?? 0),
    r3m: Number(h.return_3m ?? match?.r3m ?? 0),
    nav: Number(h.nav ?? match?.nav ?? 0),
    aum: Number(h.total_value ?? h.aum ?? match?.aum ?? 0),
    method: h.method || match?.method || 'Other',
    sector: h.sector || match?.sector || '',
    fund_type: h.fund_type || match?.fund_type || '',
    top: h.top5 || h.top || match?.top || [],
    pct_nav_breakdown: Array.isArray(h.pct_nav_breakdown) ? h.pct_nav_breakdown : [],
  }
}

function getSymbolPctNav(fund, symbol) {
  const symUpper = String(symbol || '').toUpperCase()
  if (fund.pct_nav_breakdown?.length) {
    const found = fund.pct_nav_breakdown.find(x => String(x.symbol || '').toUpperCase() === symUpper)
    if (found) return Number(found.pct_nav ?? found.pct ?? found.percent ?? 0)
  }
  if (fund.top?.length) {
    const found = fund.top.find(x => String(x.symbol || x.s || '').toUpperCase() === symUpper)
    if (found) return Number(found.percent ?? found.p ?? 0)
  }
  return null
}

// ── Fund & Stock Detail Drawer ─────────────────────────────────────────────
const drawer = reactive({
  open: false,
  type: 'fund', // 'fund' | 'stock'
  fund: null,
  stockSymbol: '',
  stockHolders: [],
  loading: false,
})

function openFundDrawer(fund) {
  if (!fund) return
  drawer.type = 'fund'
  drawer.fund = fund
  drawer.open = true
  drawer.loading = false
  document.body.style.overflow = 'hidden'
}

async function handleSymbolClick(symbolOrCode) {
  if (!symbolOrCode || symbolOrCode === '—' || symbolOrCode === '-') return
  const clean = String(symbolOrCode).trim().toUpperCase()

  // 1. ลองหาว่าเป็นรหัสกองทุนที่มีข้อมูลอยู่แล้วหรือไม่
  const foundFund = [...state.funds.FOREIGN, ...state.funds.TH].find(
    f => f.code.toUpperCase() === clean
  )
  if (foundFund) {
    openFundDrawer(foundFund)
    state.searchSymbols = [clean]
    state.searchInput = ''
    runSearch()
    return
  }

  // 2. เปิดหน้าต่าง Drawer รายละเอียดหุ้น/ETF ทันทีที่กด
  drawer.type = 'stock'
  drawer.stockSymbol = clean
  drawer.stockHolders = []
  drawer.fund = null
  drawer.open = true
  drawer.loading = true
  document.body.style.overflow = 'hidden'

  // อัปเดตการค้นหาในตารางด้านล่างด้วย
  state.searchSymbols = [clean]
  state.searchInput = ''
  runSearch()

  // ดึงรายชื่อกองทุนที่ถือหุ้นนี้มาแสดงในหน้าต่าง Drawer
  try {
    const rawHolders = await dashboardStore.searchBySymbols([clean])
    const allLoaded = [...state.funds.FOREIGN, ...state.funds.TH]
    let mapped = (rawHolders || []).map(h => normalizeSearchHolder(h, allLoaded))

    if (!mapped.length) {
      const localMatches = allLoaded.filter(f => {
        const codeMatch = f.code.toUpperCase().includes(clean)
        const nameMatch = f.name.toUpperCase().includes(clean)
        const topMatch  = (f.top || []).some(t => (t.symbol || t.s || '').toUpperCase().includes(clean))
        return codeMatch || nameMatch || topMatch
      })
      mapped = localMatches
    }

    drawer.stockHolders = mapped
  } catch (e) {
    console.error(e)
  } finally {
    drawer.loading = false
  }
}

function closeDrawer() {
  drawer.open = false
  document.body.style.overflow = ''
}

const drawerTopHoldings = computed(() => {
  if (!drawer.fund?.top?.length) return []
  const total = drawer.fund.top.reduce((s, t) => s + Number(t.percent ?? t.p ?? 0), 0)
  return drawer.fund.top.slice(0, 5).map(t => ({
    symbol:  t.symbol ?? t.s ?? '-',
    name:    t.name   ?? t.n ?? '',
    percent: Number(t.percent ?? t.p ?? 0),
    pct:     total > 0 ? (Number(t.percent ?? t.p ?? 0) / total) * 100 : 0,
  }))
})

onUnmounted(() => { document.body.style.overflow = '' })

// ── Actions ───────────────────────────────────────────────────────────────────
function resetPaging() { state.page = 1 }

function setSort(col) {
  if (state.sortBy === col) {
    state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc'
  } else {
    state.sortBy  = col
    state.sortDir = 'desc'
  }
}

function filterBySector(sectorName) {
  if (!sectorName || sectorName === '-') return
  state.selectedSector = sectorName
  resetPaging()
}

function filterByStock(stockSymbol) {
  if (!stockSymbol || stockSymbol === '-') return
  state.searchInput = stockSymbol
  runSearch()
}

function applyDashboardSnapshot(snap) {
  state.portfolioAllocation = snap.portfolioAllocation
  state.stats.FOREIGN       = snap.stats.FOREIGN
  state.stats.TH            = snap.stats.TH
  state.topStocks.FOREIGN   = snap.topStocks.FOREIGN
  state.topStocks.TH        = snap.topStocks.TH
  state.masterEtfs          = snap.masterEtfs
  state.thaiEtfs            = snap.thaiEtfs
  state.funds.FOREIGN       = snap.funds.FOREIGN
  state.funds.TH            = snap.funds.TH
  state.totals.FOREIGN      = snap.totals.FOREIGN
  state.totals.TH           = snap.totals.TH
  state.loadedAt            = snap.loadedAt
  state.partialErrors       = snap.partialErrors ?? {}
}

async function loadInitialDashboard() {
  loading.page = loading.funds = true
  errorMessage.value = ''
  try {
    applyDashboardSnapshot(await dashboardStore.loadDashboard())
  } catch (e) {
    errorMessage.value = 'ไม่สามารถดึงข้อมูล Dashboard ได้ กรุณาตรวจสอบ API/CORS หรือเปลี่ยน VITE_API_MODE เป็น wordpress'
    console.error(e)
  } finally {
    loading.page = loading.funds = false
  }
}

async function runSearch() {
  let symbols = [...state.searchSymbols]

  if (state.searchInput.trim()) {
    const typed = state.searchInput.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean)
    typed.forEach(s => {
      if (!symbols.includes(s)) symbols.push(s)
    })
  }

  if (!symbols.length) return

  state.searchSymbols = symbols
  state.searchInput = ''
  loading.search = true
  errorMessage.value = ''

  try {
    const allLoaded = [...state.funds.FOREIGN, ...state.funds.TH]
    let rawHolders = []

    try {
      // ค้นหาแต่ละสัญลักษณ์แบบขนาน แล้วรวมผลลัพธ์ (Union / OR)
      const perSymbolResults = await Promise.all(
        symbols.map(sym => dashboardStore.searchBySymbols([sym]))
      )
      const holderMap = new Map()
      perSymbolResults.flat().forEach(h => {
        if (!h || !h.code) return
        const key = String(h.code).toUpperCase()
        if (!holderMap.has(key)) {
          holderMap.set(key, { ...h })
        } else {
          const existing = holderMap.get(key)
          const b1 = existing.pct_nav_breakdown || []
          const b2 = h.pct_nav_breakdown || []
          existing.pct_nav_breakdown = [...b1, ...b2]
        }
      })
      rawHolders = Array.from(holderMap.values())
    } catch (err) {
      console.warn('API search failed, falling back to in-memory search:', err)
    }

    let mapped = (rawHolders || []).map(h => normalizeSearchHolder(h, allLoaded))

    // Fallback: ถ้า API ไม่ส่งคืนผลลัพธ์ ให้ค้นหาในความจำ (loaded funds) จาก Code, Name, AMC, Sector, Top Holdings
    symbols.forEach(sym => {
      const localMatches = allLoaded.filter(f => {
        const codeMatch = f.code.toUpperCase().includes(sym)
        const nameMatch = f.name.toUpperCase().includes(sym)
        const amcMatch  = f.amc.toUpperCase().includes(sym)
        const secMatch  = f.sector.toUpperCase().includes(sym)
        const topMatch  = (f.top || []).some(t =>
          (t.symbol || t.s || '').toUpperCase().includes(sym) ||
          (t.name || t.n || '').toUpperCase().includes(sym)
        )
        return codeMatch || nameMatch || amcMatch || secMatch || topMatch
      })

      localMatches.forEach(f => {
        if (!mapped.some(m => m.code.toUpperCase() === f.code.toUpperCase())) {
          let breakdown = f.pct_nav_breakdown || []
          if (!breakdown.length && f.top?.length) {
            const tFound = f.top.find(t => (t.symbol || t.s || '').toUpperCase().includes(sym))
            if (tFound) {
              breakdown = [{ symbol: sym, pct_nav: Number(tFound.percent ?? tFound.p ?? 0) }]
            }
          }
          mapped.push({
            ...f,
            pct_nav_breakdown: breakdown,
          })
        }
      })
    })

    state.searchFunds = mapped
    state.searchMode  = true
    resetPaging()
  } catch (e) {
    errorMessage.value = 'ค้นหากองทุนไม่สำเร็จ'
    console.error(e)
  } finally {
    loading.search = false
  }
}

function removeSearchSymbol(index) {
  state.searchSymbols.splice(index, 1)
  if (!state.searchSymbols.length) {
    clearSearch()
  } else {
    runSearch()
  }
}

function clearSearch() {
  state.searchInput = ''
  state.searchSymbols = []
  state.searchMode = false
  state.searchFunds = []
  resetPaging()
}

async function refreshDashboard() {
  loading.page = loading.funds = true
  errorMessage.value = ''
  try {
    applyDashboardSnapshot(await dashboardStore.loadDashboard({ force: true }))
    resetPaging()
  } catch (e) {
    errorMessage.value = 'รีเฟรชข้อมูล Dashboard ไม่สำเร็จ'
    console.error(e)
  } finally {
    loading.page = loading.funds = false
  }
}

onMounted(loadInitialDashboard)
</script>

<template>
  <main class="fi-page">

    <!-- ── Notices ─────────────────────────────────────────────────────────── -->
    <div v-if="errorMessage" class="fi-notice fi-notice--error">
      ⚠ {{ errorMessage }}
    </div>
    <div v-if="partialErrorMessage" class="fi-notice fi-notice--warn">
      ⚠ {{ partialErrorMessage }}
    </div>

    <!-- ── 1. Portfolio Allocation ─────────────────────────────────────────── -->
    <section class="fi-card fi-alloc">
      <div class="fi-alloc__head">
        <h1 class="fi-alloc__title">
          <span class="fi-alloc__icon-emoji">📊</span>
          วิเคราะห์การถือครองหุ้นผ่านกองทุนรวม
        </h1>
        <div class="fi-alloc__total">
          <span class="fi-alloc__total-label">มูลค่าการถือครองรวม (Total Holdings Value)</span>
          <strong class="fi-alloc__total-value">
            ฿{{ allocationTotal ? formatNumber(allocationTotal) : '—' }}
          </strong>
        </div>
      </div>

      <template v-if="allocationSegments.length">
        <!-- Percentage Labels above Progress Bar -->
        <div class="fi-alloc__pct-labels">
          <div
            v-for="seg in allocationSegments"
            :key="seg.key"
            class="fi-alloc__pct-item"
            :style="{ width: seg.pct + '%', color: seg.color }"
          >
            <span>{{ seg.pct }}%</span>
            <span class="fi-alloc__pct-tick">|</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="fi-alloc__bar">
          <div
            v-for="seg in allocationSegments"
            :key="seg.key"
            class="fi-alloc__seg"
            :style="{ width: seg.pct + '%', background: seg.color }"
            :title="`${seg.label} (${seg.pct}%)`"
          ></div>
        </div>

        <!-- 4 Summary Cards Below Bar -->
        <div class="fi-alloc__cards">
          <div
            v-for="seg in allocationSegments"
            :key="seg.key"
            class="fi-alloc__card"
          >
            <div class="fi-alloc__card-icon" :style="{ background: seg.bg, color: seg.color }">
              <span v-if="seg.isBadge" class="fi-alloc__card-badge">{{ seg.icon }}</span>
              <span v-else>{{ seg.icon }}</span>
            </div>
            <div class="fi-alloc__card-info">
              <span class="fi-alloc__card-label" :style="{ color: seg.color }">
                {{ seg.label }} ({{ seg.pct }}%)
              </span>
            </div>
          </div>
        </div>
      </template>
      <p v-else class="fi-muted" style="margin: 16px 0 0;">
        {{ loading.page ? '⏳ กำลังโหลดข้อมูล Portfolio Allocation...' : 'ยังไม่มีข้อมูล Portfolio Allocation' }}
      </p>

      <div class="fi-alloc__actions">
        <span v-if="cacheMessage" class="fi-alloc__cache">{{ cacheMessage }}</span>
        <button class="fi-btn fi-btn--ghost fi-btn--sm" :disabled="loading.page" @click="refreshDashboard">
          <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"/></svg>
          {{ loading.page ? 'Refreshing...' : 'Refresh' }}
        </button>
      </div>
    </section>

    <!-- ── 2. Stats Panels ─────────────────────────────────────────────────── -->
    <section class="fi-stats-grid">

      <!-- Foreign Panel -->
      <article class="fi-card fi-stats-panel">
        <div class="fi-stats-panel__header">
          <span class="fi-stats-panel__icon">🌎</span>
          <h2>กองทุนต่างประเทศ</h2>
        </div>
        <div class="fi-kpi-row">
          <div
            class="fi-kpi fi-kpi--clickable"
            title="คลิกเพื่อดูรายละเอียด"
            @click="handleSymbolClick(state.topStocks.FOREIGN[0]?.symbol)"
          >
            <span class="fi-kpi__label">Top Holding 🔍</span>
            <strong class="fi-kpi__val">{{ state.topStocks.FOREIGN[0]?.symbol || '—' }}</strong>
            <em v-if="state.topStocks.FOREIGN[0]?.total_thai_fund_value" class="fi-kpi__sub">
              ฿{{ formatCompact(state.topStocks.FOREIGN[0].total_thai_fund_value) }}
            </em>
          </div>
          <div class="fi-kpi">
            <span class="fi-kpi__label">จำนวนกองทุน</span>
            <strong class="fi-kpi__val">
              {{ formatNumber(foreignStats.totalFunds || state.totals.FOREIGN || state.funds.FOREIGN.length) }}
            </strong>
          </div>
          <div class="fi-kpi">
            <span class="fi-kpi__label">Top Sector</span>
            <strong class="fi-kpi__val fi-kpi__val--sm">{{ foreignStats.topSector?.name || '—' }}</strong>
          </div>
          <div
            class="fi-kpi fi-kpi--clickable"
            title="คลิกเพื่อดูรายละเอียด"
            @click="handleSymbolClick(foreignStats.topFlowFund?.code)"
          >
            <span class="fi-kpi__label">Flow เข้าสูงสุด 🔍</span>
            <template v-if="foreignStats.topFlowFund?.code">
              <strong class="fi-kpi__val fi-kpi__val--sm">{{ foreignStats.topFlowFund.code }}</strong>
              <em class="fi-kpi__sub fi-pos">
                {{ (foreignStats.topFlowFund.flow ?? foreignStats.topFlowFund.flow_change_1m ?? 0) >= 0 ? '+' : '' }}฿{{ formatCompact(foreignStats.topFlowFund.flow ?? foreignStats.topFlowFund.flow_change_1m) }}
              </em>
            </template>
            <strong v-else class="fi-kpi__val">—</strong>
          </div>
        </div>

        <div class="fi-mini-tables">
          <div class="fi-mini-table">
            <p class="fi-mini-table__title">SECTOR</p>
            <template v-if="foreignStats.sectorAllocation.length">
              <div
                v-for="row in barRows(foreignStats.sectorAllocation)"
                :key="row.name"
                class="fi-mini-row fi-mini-row--clickable"
                @click="filterBySector(row.name)"
              >
                <span class="fi-mini-row__name" :title="row.name">{{ row.name }}</span>
                <div class="fi-mini-row__bar"><i :style="{ width: Math.max(row.value, 2) + '%' }"></i></div>
                <strong class="fi-mini-row__val">{{ row.value.toFixed(1) }}%</strong>
              </div>
            </template>
            <p v-else class="fi-muted">—</p>
          </div>

          <div class="fi-mini-table">
            <p class="fi-mini-table__title">COUNTRY</p>
            <template v-if="foreignStats.countryAllocation.length">
              <div v-for="row in barRows(foreignStats.countryAllocation)" :key="row.name" class="fi-mini-row">
                <span class="fi-mini-row__name" :title="row.name">{{ row.name }}</span>
                <div class="fi-mini-row__bar"><i :style="{ width: Math.max(row.value, 2) + '%' }"></i></div>
                <strong class="fi-mini-row__val">{{ row.value.toFixed(1) }}%</strong>
              </div>
            </template>
            <p v-else class="fi-muted">—</p>
          </div>

          <div class="fi-mini-table">
            <p class="fi-mini-table__title">TOP HOLDINGS</p>
            <template v-if="state.topStocks.FOREIGN.length">
              <div
                v-for="row in topStockRows(state.topStocks.FOREIGN)"
                :key="row.name"
                class="fi-mini-row fi-mini-row--clickable"
                title="คลิกเพื่อดูรายละเอียดหุ้น/ETF"
                @click="handleSymbolClick(row.name)"
              >
                <span class="fi-mini-row__name" :title="row.name">{{ row.name }}</span>
                <div class="fi-mini-row__bar"><i :style="{ width: Math.max(row.value, 2) + '%' }"></i></div>
                <strong class="fi-mini-row__val">{{ row.value.toFixed(1) }}%</strong>
              </div>
            </template>
            <p v-else class="fi-muted">—</p>
          </div>
        </div>
      </article>

      <!-- Thai Panel -->
      <article class="fi-card fi-stats-panel">
        <div class="fi-stats-panel__header">
          <span class="fi-stats-panel__icon">🇹🇭</span>
          <h2>กองทุนไทย</h2>
        </div>
        <div class="fi-kpi-row">
          <div
            class="fi-kpi fi-kpi--clickable"
            title="คลิกเพื่อดูรายละเอียด"
            @click="handleSymbolClick(state.topStocks.TH[0]?.symbol)"
          >
            <span class="fi-kpi__label">Top Holding 🔍</span>
            <strong class="fi-kpi__val">{{ state.topStocks.TH[0]?.symbol || '—' }}</strong>
            <em v-if="state.topStocks.TH[0]?.total_thai_fund_value" class="fi-kpi__sub">
              ฿{{ formatCompact(state.topStocks.TH[0].total_thai_fund_value) }}
            </em>
          </div>
          <div class="fi-kpi">
            <span class="fi-kpi__label">จำนวนกองทุน</span>
            <strong class="fi-kpi__val">
              {{ formatNumber(thaiStats.totalFunds || state.totals.TH || state.funds.TH.length) }}
            </strong>
          </div>
          <div class="fi-kpi">
            <span class="fi-kpi__label">Top Sector</span>
            <strong class="fi-kpi__val fi-kpi__val--sm">{{ thaiStats.topSector?.name || '—' }}</strong>
          </div>
          <div
            class="fi-kpi fi-kpi--clickable"
            title="คลิกเพื่อดูรายละเอียด"
            @click="handleSymbolClick(thaiStats.topFlowFund?.code)"
          >
            <span class="fi-kpi__label">Flow เข้าสูงสุด 🔍</span>
            <template v-if="thaiStats.topFlowFund?.code">
              <strong class="fi-kpi__val fi-kpi__val--sm">{{ thaiStats.topFlowFund.code }}</strong>
              <em class="fi-kpi__sub fi-pos">
                {{ (thaiStats.topFlowFund.flow ?? thaiStats.topFlowFund.flow_change_1m ?? 0) >= 0 ? '+' : '' }}฿{{ formatCompact(thaiStats.topFlowFund.flow ?? thaiStats.topFlowFund.flow_change_1m) }}
              </em>
            </template>
            <strong v-else class="fi-kpi__val">—</strong>
          </div>
        </div>

        <div class="fi-mini-tables fi-mini-tables--2col">
          <div class="fi-mini-table">
            <p class="fi-mini-table__title">SECTOR</p>
            <template v-if="thaiStats.sectorAllocation.length">
              <div
                v-for="row in barRows(thaiStats.sectorAllocation)"
                :key="row.name"
                class="fi-mini-row fi-mini-row--clickable"
                @click="filterBySector(row.name)"
              >
                <span class="fi-mini-row__name" :title="row.name">{{ row.name }}</span>
                <div class="fi-mini-row__bar"><i :style="{ width: Math.max(row.value, 2) + '%' }"></i></div>
                <strong class="fi-mini-row__val">{{ row.value.toFixed(1) }}%</strong>
              </div>
            </template>
            <p v-else class="fi-muted">—</p>
          </div>

          <div class="fi-mini-table">
            <p class="fi-mini-table__title">TOP HOLDINGS</p>
            <template v-if="state.topStocks.TH.length">
              <div
                v-for="row in topStockRows(state.topStocks.TH)"
                :key="row.name"
                class="fi-mini-row fi-mini-row--clickable"
                title="คลิกเพื่อดูรายละเอียดหุ้น/ETF"
                @click="handleSymbolClick(row.name)"
              >
                <span class="fi-mini-row__name" :title="row.name">{{ row.name }}</span>
                <div class="fi-mini-row__bar"><i :style="{ width: Math.max(row.value, 2) + '%' }"></i></div>
                <strong class="fi-mini-row__val">{{ row.value.toFixed(1) }}%</strong>
              </div>
            </template>
            <p v-else class="fi-muted">—</p>
          </div>
        </div>
      </article>

    </section>

    <!-- ── 3. ETF Zone ─────────────────────────────────────────────────────── -->
    <section class="fi-etf-grid">

      <!-- Master ETFs -->
      <article class="fi-card fi-etf-panel">
        <div class="fi-etf-panel__zone">
          <span class="fi-etf-zone-tag">ETF ZONE</span>
          <span class="fi-etf-zone-type">Master ETFs</span>
        </div>
        <h2 class="fi-etf-panel__title">Top Master ETFs — Flow (Unit Change)</h2>
        <div v-if="state.masterEtfs.length" class="fi-etf-cards">
          <div
            v-for="etf in state.masterEtfs.slice(0, 6)"
            :key="etf.symbol ?? etf.code"
            class="fi-etf-card"
          >
            <div class="fi-etf-card__head">
              <div class="fi-etf-card__info">
                <strong class="fi-etf-card__symbol">{{ etf.symbol ?? etf.code }}</strong>
                <p class="fi-etf-card__name" :title="etf.name ?? etf.fund_name">{{ etf.name ?? etf.fund_name ?? '' }}</p>
              </div>
              <span class="fi-etf-card__cat">{{ etf.tag ?? etf.category ?? etf.type ?? 'Global' }}</span>
            </div>
            <div
              class="fi-etf-card__flow"
              :class="getEtfFlow(etf) >= 0 ? 'fi-pos' : 'fi-neg'"
            >
              {{ getEtfFlow(etf) >= 0 ? '▲ ' : '▼ ' }}
              {{ formatCompact(Math.abs(getEtfFlow(etf))) }}
            </div>
            <div class="fi-etf-card__meta">
              <span>{{ getEtfFundCount(etf) ? getEtfFundCount(etf) + ' กองทุน' : '' }}</span>
            </div>
          </div>
        </div>
        <p v-else class="fi-muted">
          {{ loading.page ? '⏳ กำลังโหลด Master ETFs...' : 'ยังไม่มีข้อมูล Master ETFs' }}
        </p>
      </article>

      <!-- Thai ETFs -->
      <article class="fi-card fi-etf-panel">
        <div class="fi-etf-panel__zone">
          <span class="fi-etf-zone-tag">ETF ZONE</span>
          <span class="fi-etf-zone-type">Thai ETFs</span>
        </div>
        <h2 class="fi-etf-panel__title">Top Traded Thai ETFs — Flow (฿)</h2>
        <div v-if="state.thaiEtfs.length" class="fi-etf-cards">
          <div
            v-for="etf in state.thaiEtfs.slice(0, 6)"
            :key="etf.symbol ?? etf.code"
            class="fi-etf-card"
          >
            <div class="fi-etf-card__head">
              <div class="fi-etf-card__info">
                <strong class="fi-etf-card__symbol">{{ etf.symbol ?? etf.code }}</strong>
                <p class="fi-etf-card__name" :title="etf.name ?? etf.fund_name">{{ etf.name ?? etf.fund_name ?? '' }}</p>
              </div>
              <span class="fi-etf-card__cat">{{ etf.tag ?? etf.category ?? etf.type ?? 'Equity' }}</span>
            </div>
            <div
              class="fi-etf-card__flow"
              :class="getEtfFlow(etf) >= 0 ? 'fi-pos' : 'fi-neg'"
            >
              {{ getEtfFlow(etf) >= 0 ? '▲ ' : '▼ ' }}
              ฿{{ formatCompact(Math.abs(getEtfFlow(etf))) }}
            </div>
            <div class="fi-etf-card__meta">
              <span>{{ getEtfFundCount(etf) ? getEtfFundCount(etf) + ' กองทุน' : '' }}</span>
            </div>
          </div>
        </div>
        <p v-else class="fi-muted">
          {{ loading.page ? '⏳ กำลังโหลด Thai ETFs...' : 'ยังไม่มีข้อมูล Thai ETFs' }}
        </p>
      </article>

    </section>

    <!-- ── 4. Fund List ─────────────────────────────────────────────────────── -->
<section class="fi-card fi-fundsec">

      <!-- Breadcrumb -->
      <p class="fi-fundsec__crumb">
        <span>หน้าหลัก</span>
        <span class="fi-fundsec__crumb-sep"> &rsaquo; </span>
        <span>กองทุนรวมทั้งหมด {{ formatNumber(totalFunds) }} กองทุน</span>
      </p>

      <div class="fi-fundsec__head">
        <h2 class="fi-fundsec__count">กองทุนรวมทั้งหมด {{ formatNumber(totalFunds) }} กองทุน</h2>
        <div class="fi-fundsec__toolbar">
          <select v-model="state.selectedFundType" class="fi-select" @change="resetPaging">
            <option value="">ประเภทกองทุน: ทั้งหมด</option>
            <option v-for="t in filterOptions.fundTypes" :key="t" :value="t">{{ t }}</option>
          </select>
          <select v-model="state.selectedAmc" class="fi-select" @change="resetPaging">
            <option value="">บลจ.: ทั้งหมด</option>
            <option v-for="a in filterOptions.amcs" :key="a" :value="a">{{ a }}</option>
          </select>
          <select v-model="state.selectedSector" class="fi-select" @change="resetPaging">
            <option value="">Sector: ทั้งหมด</option>
            <option v-for="s in filterOptions.sectors" :key="s" :value="s">{{ s }}</option>
          </select>
          <button class="fi-btn fi-btn--ghost fi-btn--sm">+ Advanced</button>

          <form class="fi-search-form" @submit.prevent="runSearch">
            <input
              v-model="state.searchInput"
              class="fi-search-input"
              placeholder="พิมพ์ชื่อหุ้น เช่น AAPL"
            />
            <button type="submit" class="fi-btn fi-btn--primary fi-btn--sm" :disabled="loading.search">
              {{ loading.search ? '...' : '+ เพิ่ม' }}
            </button>
            <button
              v-if="state.searchMode"
              type="button"
              class="fi-btn fi-btn--ghost fi-btn--sm"
              @click="clearSearch"
            >ล้างค้นหา</button>
          </form>
        </div>
      </div>

      <!-- Search Chips Bar -->
      <div v-if="state.searchSymbols.length" class="fi-search-tags">
        <span class="fi-search-tags__title">หุ้นค้นหา:</span>
        <span
          v-for="(sym, idx) in state.searchSymbols"
          :key="sym"
          class="fi-search-tag"
        >
          {{ sym }}
          <button class="fi-search-tag__x" @click="removeSearchSymbol(idx)">✕</button>
        </span>
        <button class="fi-btn fi-btn--ghost fi-btn--xs fi-search-tags__clear" @click="clearSearch">
          ล้างค้นหา
        </button>
      </div>

      <!-- Dual Tables -->
      <div class="fi-fund-tables">

        <!-- Foreign Funds Table -->
        <div class="fi-fund-col">
          <p class="fi-fund-col__label">
            กองทุนต่างประเทศทั้งหมด <strong>{{ formatNumber(state.totals.FOREIGN || activeFundsForeign.length) }}</strong> กองทุน
          </p>
          <div class="fi-fund-col__wrap">
            <table class="fi-table">
              <thead>
                <tr>
                  <th class="fi-th--left">กองทุน</th>
                  <th>RISK</th>
                  <th class="fi-th--sort" :class="{ 'fi-th--active': state.sortBy === 'ret' }" @click="setSort('ret')">
                    1Y<span v-if="state.sortBy==='ret'">{{ state.sortDir==='desc'?' ↓':' ↑' }}</span>
                  </th>
                  <th class="fi-th--sort" :class="{ 'fi-th--active': state.sortBy === 'nav' }" @click="setSort('nav')">
                    NAV<span v-if="state.sortBy==='nav'">{{ state.sortDir==='desc'?' ↓':' ↑' }}</span>
                  </th>
                  <th class="fi-th--sort" :class="{ 'fi-th--active': state.sortBy === 'aum' }" @click="setSort('aum')">
                    AUM<span>{{ state.sortBy==='aum' ? (state.sortDir==='desc'?' ↓':' ↑') : ' ↓' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading.funds && !hasVisibleFunds">
                  <td colspan="5" class="fi-td--center">กำลังโหลดข้อมูล...</td>
                </tr>
                <tr v-else-if="!pagedForeignFunds.length">
                  <td colspan="5" class="fi-td--center">ไม่พบข้อมูล</td>
                </tr>
                <tr v-for="fund in pagedForeignFunds" :key="`F-${fund.code}`" class="fi-tr fi-tr--clickable" @click="openFundDrawer(fund)">
                  <td class="fi-td--fund">
                    <strong>{{ fund.code || '-' }}</strong>
                    <span>{{ fund.name || '-' }}</span>
                    <em v-if="fund.amc">{{ fund.amc }}</em>
                  </td>
                  <td><span class="fi-risk" :class="riskClass(fund.risk)">{{ fund.risk || '-' }}</span></td>
                  <td :class="fund.ret >= 0 ? 'fi-pos' : 'fi-neg'">{{ formatPercent(fund.ret) }}</td>
                  <td>฿{{ formatCurrency(fund.nav) }}</td>
                  <td>฿{{ formatCompact(fund.aum) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Thai Funds Table -->
        <div class="fi-fund-col">
          <p class="fi-fund-col__label">
            กองทุนไทยทั้งหมด <strong>{{ formatNumber(state.totals.TH || activeFundsTH.length) }}</strong> กองทุน
          </p>
          <div class="fi-fund-col__wrap">
            <table class="fi-table">
              <thead>
                <tr>
                  <th class="fi-th--left">กองทุน</th>
                  <th>RISK</th>
                  <th class="fi-th--sort" :class="{ 'fi-th--active': state.sortBy === 'ret' }" @click="setSort('ret')">
                    1Y<span v-if="state.sortBy==='ret'">{{ state.sortDir==='desc'?' ↓':' ↑' }}</span>
                  </th>
                  <th class="fi-th--sort" :class="{ 'fi-th--active': state.sortBy === 'nav' }" @click="setSort('nav')">
                    NAV<span v-if="state.sortBy==='nav'">{{ state.sortDir==='desc'?' ↓':' ↑' }}</span>
                  </th>
                  <th class="fi-th--sort" :class="{ 'fi-th--active': state.sortBy === 'aum' }" @click="setSort('aum')">
                    AUM<span>{{ state.sortBy==='aum' ? (state.sortDir==='desc'?' ↓':' ↑') : ' ↓' }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="loading.funds && !hasVisibleFunds">
                  <td colspan="5" class="fi-td--center">กำลังโหลดข้อมูล...</td>
                </tr>
                <tr v-else-if="!pagedThaiFunds.length">
                  <td colspan="5" class="fi-td--center">ไม่พบข้อมูล</td>
                </tr>
                <tr v-for="fund in pagedThaiFunds" :key="`T-${fund.code}`" class="fi-tr fi-tr--clickable" @click="openFundDrawer(fund)">
                  <td class="fi-td--fund">
                    <strong>{{ fund.code || '-' }}</strong>
                    <span>{{ fund.name || '-' }}</span>
                    <em v-if="fund.amc">{{ fund.amc }}</em>
                  </td>
                  <td><span class="fi-risk" :class="riskClass(fund.risk)">{{ fund.risk || '-' }}</span></td>
                  <td :class="fund.ret >= 0 ? 'fi-pos' : 'fi-neg'">{{ formatPercent(fund.ret) }}</td>
                  <td>฿{{ formatCurrency(fund.nav) }}</td>
                  <td>฿{{ formatCompact(fund.aum) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div><!-- /fi-fund-tables -->

      <!-- Pagination -->
      <div class="fi-pagination">
        <button class="fi-page-btn" :disabled="state.page <= 1" @click="state.page -= 1">PREVIOUS</button>
        <button
          v-for="p in visiblePages"
          :key="p"
          class="fi-page-btn"
          :class="{ 'fi-page-btn--active': p === state.page }"
          @click="state.page = p"
        >{{ p }}</button>
        <button class="fi-page-btn" :disabled="state.page >= totalPages" @click="state.page += 1">ถัดไป</button>
      </div>

    </section>

    <!-- ── Detail Drawer (Fund & Stock/ETF) ────────────────────────────── -->
    <Transition name="drawer-fade">
      <div v-if="drawer.open" class="fi-drawer-overlay" @click.self="closeDrawer">
        <aside class="fi-drawer">

          <!-- MODE 1: FUND DETAIL -->
          <template v-if="drawer.type === 'fund'">
            <!-- Header -->
            <div class="fi-drawer__header">
              <div class="fi-drawer__header-info">
                <span
                  class="fi-drawer__type-badge"
                  :class="drawer.fund?.target_type === 'FOREIGN' ? 'fi-drawer__type-badge--foreign' : 'fi-drawer__type-badge--th'"
                >
                  {{ drawer.fund?.target_type === 'FOREIGN' ? '🌎 FOREIGN' : '🇹🇭 TH' }}
                </span>
                <h2 class="fi-drawer__code">{{ drawer.fund?.code }}</h2>
                <p class="fi-drawer__name">{{ drawer.fund?.name }}</p>
                <p class="fi-drawer__amc">{{ drawer.fund?.amc }}</p>
              </div>
              <button class="fi-drawer__close" @click="closeDrawer" aria-label="ปิด">✕</button>
            </div>

            <!-- KPI Grid -->
            <div class="fi-drawer__kpis">
              <div class="fi-drawer__kpi">
                <span>Risk Level</span>
                <strong>
                  <span class="fi-risk" :class="riskClass(drawer.fund?.risk ?? 0)">
                    {{ drawer.fund?.risk || '-' }}
                  </span>
                </strong>
              </div>
              <div class="fi-drawer__kpi">
                <span>1Y Return</span>
                <strong :class="(drawer.fund?.ret ?? 0) >= 0 ? 'fi-pos' : 'fi-neg'">
                  {{ formatPercent(drawer.fund?.ret) }}
                </strong>
              </div>
              <div class="fi-drawer__kpi">
                <span>NAV</span>
                <strong>฿{{ formatCurrency(drawer.fund?.nav) }}</strong>
              </div>
              <div class="fi-drawer__kpi">
                <span>AUM</span>
                <strong>฿{{ formatCompact(drawer.fund?.aum) }}</strong>
              </div>
            </div>

            <!-- Tags Row -->
            <div class="fi-drawer__tags">
              <span v-if="drawer.fund?.sector" class="fi-drawer__tag fi-drawer__tag--sector">📂 {{ drawer.fund.sector }}</span>
              <span v-if="drawer.fund?.fund_type" class="fi-drawer__tag">{{ drawer.fund.fund_type }}</span>
              <span v-if="drawer.fund?.method" class="fi-drawer__tag">{{ drawer.fund.method }}</span>
            </div>

            <hr class="fi-drawer__divider" />

            <!-- Top 5 Holdings -->
            <div class="fi-drawer__section">
              <h3 class="fi-drawer__section-title">Top 5 Holdings</h3>
              <template v-if="drawerTopHoldings.length">
                <div
                  v-for="(h, i) in drawerTopHoldings"
                  :key="h.symbol"
                  class="fi-drawer__holding fi-drawer__holding--clickable"
                  title="คลิกเพื่อดูรายชื่อกองทุนที่ถือหุ้นนี้"
                  @click="handleSymbolClick(h.symbol)"
                >
                  <div class="fi-drawer__holding-left">
                    <span class="fi-drawer__holding-dot" :style="{ background: ['#4B543B','#DCE2AA','#B57F50','#8ED081','#B4D2BA'][i] }"></span>
                    <div>
                      <strong>{{ h.symbol }} 🔍</strong>
                      <span v-if="h.name" class="fi-drawer__holding-name">{{ h.name }}</span>
                    </div>
                  </div>
                  <div class="fi-drawer__holding-bar-wrap">
                    <div class="fi-drawer__holding-bar">
                      <div
                        class="fi-drawer__holding-bar-fill"
                        :style="{ width: Math.max(h.pct, 3) + '%', background: ['#4B543B','#DCE2AA','#B57F50','#8ED081','#B4D2BA'][i] }"
                      ></div>
                    </div>
                    <span class="fi-drawer__holding-pct">{{ h.percent.toFixed(2) }}%</span>
                  </div>
                </div>
              </template>
              <p v-else class="fi-muted">ไม่พบข้อมูล Top Holdings</p>
            </div>
          </template>

          <!-- MODE 2: STOCK / ETF DETAIL -->
          <template v-else-if="drawer.type === 'stock'">
            <div class="fi-drawer__header">
              <div class="fi-drawer__header-info">
                <span class="fi-drawer__type-badge fi-drawer__type-badge--stock">📈 STOCK / ETF</span>
                <h2 class="fi-drawer__code">{{ drawer.stockSymbol }}</h2>
                <p class="fi-drawer__name">
                  {{ drawer.loading ? 'กำลังดึงข้อมูล...' : `พบใน ${drawer.stockHolders.length} กองทุน` }}
                </p>
              </div>
              <button class="fi-drawer__close" @click="closeDrawer" aria-label="ปิด">✕</button>
            </div>

            <div class="fi-drawer__section">
              <h3 class="fi-drawer__section-title">กองทุนที่ถือหุ้น / ETF นี้</h3>

              <div v-if="drawer.loading" class="fi-drawer__loading">
                <div class="fi-spinner"></div>
                <span>กำลังค้นหากองทุนที่ถือหุ้น {{ drawer.stockSymbol }}...</span>
              </div>

              <template v-else-if="drawer.stockHolders.length">
                <div class="fi-drawer__stock-list">
                  <div
                    v-for="holder in drawer.stockHolders"
                    :key="holder.code"
                    class="fi-drawer__stock-item"
                    title="คลิกเพื่อดูรายละเอียดกองทุน"
                    @click="openFundDrawer(holder)"
                  >
                    <div class="fi-drawer__stock-item-head">
                      <strong>{{ holder.code }}</strong>
                      <span class="fi-risk" :class="riskClass(holder.risk)">Risk {{ holder.risk }}</span>
                    </div>
                    <p class="fi-drawer__stock-item-name">{{ holder.name }} · {{ holder.amc }}</p>
                    <div class="fi-drawer__stock-item-metrics">
                      <span :class="holder.ret >= 0 ? 'fi-pos' : 'fi-neg'">1Y: {{ formatPercent(holder.ret) }}</span>
                      <span>NAV: ฿{{ formatCurrency(holder.nav) }}</span>
                      <span>AUM: ฿{{ formatCompact(holder.aum) }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <p v-else class="fi-muted">ไม่พบข้อมูลกองทุนที่ถือหุ้น {{ drawer.stockSymbol }}</p>
            </div>
          </template>

        </aside>
      </div>
    </Transition>

  </main>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════
   Page Shell
═══════════════════════════════════════════════════════════ */
.fi-page {
  width: 100%;
  padding: 14px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
}

/* ═══════════════════════════════════════════════════════════
   Card Base
═══════════════════════════════════════════════════════════ */
.fi-card {
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  border: 1px solid #f1f5f9;
  padding: 20px 24px;
}

/* ═══════════════════════════════════════════════════════════
   Notices
═══════════════════════════════════════════════════════════ */
.fi-notice {
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
}
.fi-notice--error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.fi-notice--warn  { background: #fffbeb; color: #92400e; border: 1px solid #fde68a; }

/* ═══════════════════════════════════════════════════════════
   Shared Helpers
═══════════════════════════════════════════════════════════ */
.fi-pos   { color: #059669; font-weight: 600; }
.fi-neg   { color: #dc2626; font-weight: 600; }
.fi-muted { color: #94a3b8; font-size: 12px; margin: 0; }

/* ═══════════════════════════════════════════════════════════
   Portfolio Allocation
═══════════════════════════════════════════════════════════ */
.fi-alloc__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.fi-alloc__title {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 10px;
}
.fi-alloc__icon-emoji {
  font-size: 22px;
}
.fi-alloc__total { text-align: right; }
.fi-alloc__total-label { font-size: 13px; color: #64748b; font-weight: 600; display: block; }
.fi-alloc__total-value { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }

/* Percentage labels above bar */
.fi-alloc__pct-labels {
  display: flex;
  width: 100%;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 800;
  height: 24px;
  align-items: flex-end;
}
.fi-alloc__pct-item {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.fi-alloc__pct-tick {
  font-size: 10px;
  font-weight: normal;
  opacity: 0.6;
  margin-top: 1px;
}

/* Progress Bar */
.fi-alloc__bar {
  height: 12px;
  border-radius: 6px;
  display: flex;
  overflow: hidden;
  margin-bottom: 20px;
  background: #e2e8f0;
}
.fi-alloc__seg {
  height: 100%;
  transition: opacity 0.2s;
}
.fi-alloc__seg:hover { opacity: 0.85; }

/* 4 Cards Below Bar */
.fi-alloc__cards {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  width: 100%;
}
.fi-alloc__card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid #f1f5f9;
  flex: 1;
  min-width: 200px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}
.fi-alloc__card-icon {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}
.fi-alloc__card-badge {
  font-size: 13px;
  font-weight: 800;
}
.fi-alloc__card-info {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}
.fi-alloc__card-label {
  font-size: 14px;
  font-weight: 800;
}

.fi-alloc__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
.fi-alloc__cache {
  font-size: 11px;
  color: #94a3b8;
}

/* ═══════════════════════════════════════════════════════════
   Stats Grid
═══════════════════════════════════════════════════════════ */
.fi-stats-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.fi-stats-panel__header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.fi-stats-panel__header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
  color: #0f172a;
}
.fi-stats-panel__icon {
  font-size: 22px;
}

/* KPI Row */
.fi-kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid #f1f5f9;
  border-bottom: 1px solid #f1f5f9;
  margin-bottom: 16px;
}
.fi-kpi {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fi-kpi__label {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}
.fi-kpi__val {
  font-size: 16px;
  font-weight: 800;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fi-kpi__val--sm {
  font-size: 13px;
}
.fi-kpi__sub {
  font-size: 11px;
  color: #64748b;
  font-style: normal;
  font-weight: 600;
}

/* Mini Tables */
.fi-mini-tables {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.fi-mini-tables--2col { grid-template-columns: repeat(2, 1fr); }

.fi-mini-table__title {
  margin: 0 0 8px;
  font-size: 11px;
  font-weight: 800;
  color: #475569;
  letter-spacing: 0.5px;
}
.fi-mini-row {
  display: grid;
  grid-template-columns: 80px 1fr 40px;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}
.fi-mini-row--clickable {
  cursor: pointer;
}
.fi-mini-row--clickable:hover .fi-mini-row__name {
  color: #2563eb;
  text-decoration: underline;
}
.fi-mini-row__name {
  font-size: 12px;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fi-mini-row__bar {
  height: 7px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.fi-mini-row__bar i {
  display: block;
  height: 100%;
  background: #3b82f6;
  border-radius: 4px;
}
.fi-mini-row__val {
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
  text-align: right;
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════════════
   ETF Zone
═══════════════════════════════════════════════════════════ */
.fi-etf-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
}

.fi-etf-panel {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.fi-etf-panel__zone {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.fi-etf-zone-tag {
  background: #1e293b;
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}
.fi-etf-zone-type {
  font-size: 15px;
  font-weight: 600;
  color: #475569;
}
.fi-etf-panel__title {
  margin: 0 0 16px;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  padding-bottom: 10px;
  border-bottom: 1px solid #cbd5e1;
}

.fi-etf-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.fi-etf-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.fi-etf-card:hover {
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  border-color: #cbd5e1;
}

.fi-etf-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}
.fi-etf-card__symbol {
  font-size: 15px;
  font-weight: 800;
  color: #2563eb;
}
.fi-etf-card__name {
  margin: 2px 0 0;
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}
.fi-etf-card__cat {
  background: #f1f5f9;
  color: #64748b;
  font-size: 9px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.fi-etf-card__flow {
  font-size: 16px;
  font-weight: 900;
  margin: 6px 0 8px;
}
.fi-etf-card__meta {
  font-size: 10px;
  color: #64748b;
  font-weight: 700;
}

/* ═══════════════════════════════════════════════════════════
   Fund List Section
═══════════════════════════════════════════════════════════ */
.fi-fundsec__crumb {
  margin: 0 0 12px;
  font-size: 12px;
  color: #94a3b8;
}
.fi-fundsec__crumb-sep { margin: 0 4px; }

.fi-fundsec__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
.fi-fundsec__count {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #0f172a;
}
.fi-fundsec__toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

/* Selects & Buttons */
.fi-select {
  border: 1px solid #dfe7ef;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  color: #334155;
  background: #ffffff;
  outline: none;
  cursor: pointer;
}
.fi-select:focus { border-color: #3b82f6; }

.fi-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}
.fi-btn--primary { background: #2563eb; color: #ffffff; padding: 7px 14px; font-size: 13px; }
.fi-btn--primary:hover:not(:disabled) { background: #1d4ed8; }
.fi-btn--ghost { background: #f1f5f9; color: #475569; padding: 7px 12px; font-size: 13px; border: 1px solid #e2e8f0; }
.fi-btn--ghost:hover:not(:disabled) { background: #e2e8f0; }
.fi-btn--sm { padding: 6px 11px; font-size: 12px; }

.fi-search-form {
  display: flex;
  gap: 6px;
  align-items: center;
}
.fi-search-input {
  border: 1px solid #dfe7ef;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 13px;
  width: 160px;
  outline: none;
}
.fi-search-input:focus { border-color: #3b82f6; }

/* Dual Tables Layout */
.fi-fund-tables {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  width: 100%;
}

.fi-fund-col {
  min-width: 0;
  width: 100%;
}

.fi-fund-col__label {
  margin: 0 0 8px;
  font-size: 13px;
  color: #64748b;
}
.fi-fund-col__label strong { color: #0f172a; }

.fi-fund-col__wrap {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 540px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  width: 100%;
}

.fi-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}
.fi-table thead { position: sticky; top: 0; z-index: 1; }
.fi-table th {
  padding: 10px 6px;
  text-align: right;
  font-size: 11px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}
.fi-th--left  { text-align: left; }
.fi-th--sort  { cursor: pointer; user-select: none; }
.fi-th--sort:hover { color: #1e293b; }
.fi-th--active { color: #2563eb !important; }

.fi-table th:nth-child(1), .fi-table td:nth-child(1) { width: 38%; text-align: left; }
.fi-table th:nth-child(2), .fi-table td:nth-child(2) { width: 14%; text-align: center; }
.fi-table th:nth-child(3), .fi-table td:nth-child(3) { width: 16%; }
.fi-table th:nth-child(4), .fi-table td:nth-child(4) { width: 16%; }
.fi-table th:nth-child(5), .fi-table td:nth-child(5) { width: 16%; }

.fi-table td {
  padding: 8px 6px;
  text-align: right;
  vertical-align: middle;
  border-bottom: 1px solid #f1f5f9;
  color: #334155;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fi-td--center { text-align: center; color: #94a3b8; padding: 24px; }

.fi-tr:hover td { background: #f8fafc; }
.fi-tr--clickable { cursor: pointer; }
.fi-tr--clickable:hover td { background: #eff6ff; }

.fi-td--fund {
  text-align: left;
  overflow: hidden;
}
.fi-td--fund strong {
  display: block;
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fi-td--fund span {
  display: block;
  font-size: 11px;
  color: #64748b;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
.fi-td--fund em {
  display: block;
  font-size: 10px;
  color: #94a3b8;
  font-style: normal;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Risk Badge */
.fi-risk {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 800;
  color: #ffffff;
}
.risk-low  { background: #059669; }
.risk-med  { background: #f59e0b; }
.risk-high { background: #dc2626; }

/* ═══════════════════════════════════════════════════════════
   Pagination
═══════════════════════════════════════════════════════════ */
.fi-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.fi-page-btn {
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  border-radius: 6px;
  padding: 7px 13px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.fi-page-btn:hover:not(:disabled) { border-color: #2563eb; color: #2563eb; }
.fi-page-btn:disabled { opacity: 0.4; cursor: default; }
.fi-page-btn--active {
  background: #2563eb;
  border-color: #2563eb;
  color: #ffffff;
  font-weight: 800;
}

/* ═══════════════════════════════════════════════════════════
   Responsive Breakdown
═══════════════════════════════════════════════════════════ */
@media (max-width: 1024px) {
  .fi-stats-grid,
  .fi-etf-grid,
  .fi-fund-tables { grid-template-columns: 1fr; }
  .fi-kpi-row { grid-template-columns: repeat(2, 1fr); }
  .fi-mini-tables { grid-template-columns: 1fr 1fr; }
  .fi-mini-tables--2col { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .fi-page { padding: 10px; }
  .fi-alloc__head { flex-direction: column; }
  .fi-alloc__total { text-align: left; }
  .fi-fundsec__head { flex-direction: column; align-items: flex-start; }
  .fi-etf-cards { grid-template-columns: 1fr; }
  .fi-drawer { width: 100% !important; }
}

/* ═══════════════════════════════════════════════════════════
   Fund Detail Drawer
═══════════════════════════════════════════════════════════ */
.fi-drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(2px);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.fi-drawer {
  width: 420px;
  max-width: 95vw;
  height: 100%;
  background: #ffffff;
  box-shadow: -4px 0 32px rgba(15, 23, 42, 0.14);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.fi-drawer__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 24px 22px 18px;
  border-bottom: 1px solid #f1f5f9;
  gap: 12px;
}

.fi-drawer__header-info { flex: 1; min-width: 0; }

.fi-drawer__type-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 20px;
  margin-bottom: 8px;
  letter-spacing: 0.5px;
}
.fi-drawer__type-badge--foreign { background: #eff6ff; color: #2563eb; }
.fi-drawer__type-badge--th { background: #ecfdf5; color: #059669; }

.fi-drawer__code {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 900;
  color: #0f172a;
  letter-spacing: -0.5px;
}
.fi-drawer__name {
  margin: 0 0 4px;
  font-size: 13px;
  color: #475569;
  font-weight: 500;
  line-height: 1.5;
}
.fi-drawer__amc {
  margin: 0;
  font-size: 11px;
  color: #94a3b8;
  font-weight: 600;
}

.fi-drawer__close {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  background: #f8fafc;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.fi-drawer__close:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

.fi-drawer__kpis {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 1px;
  background: #f1f5f9;
  margin: 0;
}
.fi-drawer__kpi {
  background: #fff;
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.fi-drawer__kpi span {
  font-size: 10px;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}
.fi-drawer__kpi strong {
  font-size: 15px;
  font-weight: 800;
  color: #0f172a;
}

.fi-drawer__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 14px 22px;
}
.fi-drawer__tag {
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  background: #f1f5f9;
  color: #475569;
}
.fi-drawer__tag--sector {
  background: #eff6ff;
  color: #2563eb;
}

.fi-drawer__divider {
  border: 0;
  border-top: 1px solid #f1f5f9;
  margin: 0;
}

.fi-drawer__section {
  padding: 20px 22px;
  flex: 1;
}
.fi-drawer__section-title {
  margin: 0 0 16px;
  font-size: 13px;
  font-weight: 800;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.fi-drawer__holding {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f8fafc;
}
.fi-drawer__holding:last-child { border-bottom: 0; }

.fi-drawer__holding-left {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 140px;
  flex-shrink: 0;
}
.fi-drawer__holding-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}
.fi-drawer__holding-left strong {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
  display: block;
}
.fi-drawer__holding-name {
  font-size: 10px;
  color: #94a3b8;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100px;
}

.fi-drawer__holding-bar-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.fi-drawer__holding-bar {
  flex: 1;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}
.fi-drawer__holding-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}
.fi-drawer__holding-pct {
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
  white-space: nowrap;
  width: 44px;
  text-align: right;
}

.fi-kpi--clickable {
  cursor: pointer;
  transition: all 0.15s ease;
}
.fi-kpi--clickable:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  transform: translateY(-1px);
}

.fi-etf-card--clickable {
  cursor: pointer;
  transition: all 0.15s ease;
}
.fi-etf-card--clickable:hover {
  transform: translateY(-2px);
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.12);
}

.fi-drawer__type-badge--stock {
  background: #fef3c7;
  color: #d97706;
}

.fi-drawer__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.fi-drawer__stock-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fi-drawer__stock-item {
  padding: 12px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  transition: all 0.15s ease;
}
.fi-drawer__stock-item:hover {
  background: #eff6ff;
  border-color: #93c5fd;
  transform: translateX(3px);
}

.fi-drawer__stock-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.fi-drawer__stock-item-head strong {
  font-size: 14px;
  color: #0f172a;
  font-weight: 800;
}
.fi-drawer__stock-item-name {
  margin: 0 0 8px;
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fi-drawer__stock-item-metrics {
  display: flex;
  gap: 12px;
  font-size: 11px;
  font-weight: 700;
  color: #475569;
}

.fi-drawer__holding--clickable {
  cursor: pointer;
  border-radius: 6px;
  padding: 8px;
  transition: background 0.15s;
}
.fi-drawer__holding--clickable:hover {
  background: #eff6ff;
}

.fi-search-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.fi-search-tags__title {
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}
.fi-search-tag {
  background: #e0f2fe;
  color: #0369a1;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.fi-search-tag__x {
  background: transparent;
  border: 0;
  color: #0369a1;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
}
.fi-search-tag__x:hover { opacity: 1; }
.fi-search-tags__clear {
  color: #dc2626;
  border-color: #fca5a5;
  background: #fef2f2;
}

.fi-btn--xs {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 12px;
}

/* Drawer Slide Transition */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.22s ease;
}
.drawer-fade-enter-active .fi-drawer,
.drawer-fade-leave-active .fi-drawer {
  transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}
.drawer-fade-enter-from .fi-drawer {
  transform: translateX(100%);
}
.drawer-fade-leave-to .fi-drawer {
  transform: translateX(100%);
}
</style>
