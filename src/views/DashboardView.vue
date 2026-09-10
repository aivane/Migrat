<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Chart from 'chart.js/auto'
import { useDashboardStore } from '../stores/dashboardStore'
import { getFundDetail, normalizeFund } from '../services/fundApi'

const dashboardStore = useDashboardStore()
const router = useRouter()

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
  sectorHierarchy: null,
  loadedAt: null,
  partialErrors: {},
})

// ── Favorites (localStorage) & Compare State ────────────────────────────────
const favorites = ref(new Set(JSON.parse(localStorage.getItem('migrat.favorites') || '[]')))
const showOnlyFavorites = ref(false)
const selectedForCompare = ref([])
const showBackToTop = ref(false)
const jumpPageInput = ref('')

// ── Exposure Active Topic (4 หัวข้อโครงสร้างการลงทุน) ────────────────────────
const activeTopic = ref('holdings') // 'holdings' | 'sectors' | 'countries' | 'kpis'
function setExposureTopic(topic) {
  activeTopic.value = topic
}

// ── Unified Screener State (fund2-main 400 Funds Screener) ─────────────────
const screenerCategory = ref('all') // 'all' | 'feeder' | 'offshore' | 'thai' | 'mixed'
const tableSearchQuery = ref('')
const selectedScreenerAmc = ref('all')
const selectedScreenerSector = ref('all')
const selectedScreenerRisk = ref('all')
const screenerSortBy = ref('perfDesc')
const screenerPage = ref(1)
const screenerPageSize = ref(10)
const expandedFundIds = ref(new Set())

function setScreenerCategory(cat) {
  screenerCategory.value = cat
  screenerPage.value = 1
}

const fundHoldingsCache = reactive({})

function isValidTopHoldings(list) {
  if (!list || !Array.isArray(list) || list.length < 3) return false
  const first = list[0]
  const name = String(Array.isArray(first) ? first[0] : (first.symbol || first.name || first.clean_holding_name || '')).trim().toLowerCase()
  if ((name.startsWith('หน่วยลงทุน') || name.startsWith('กองทุนเปิด') || name.startsWith('master fund')) && list.length < 4) {
    return false
  }
  return true
}

async function toggleFundExpand(id) {
  if (expandedFundIds.value.has(id)) {
    expandedFundIds.value.delete(id)
    const canvasId = `fd-pe-${id}`
    if (pieInstances[canvasId]) {
      pieInstances[canvasId].destroy()
      delete pieInstances[canvasId]
    }
  } else {
    expandedFundIds.value.add(id)
    const fund = allUnifiedFunds.value.find(f => f.id === id || f.code === id)

    // Render immediately with initial holdings
    await nextTick()
    if (fund) {
      setTimeout(() => drawExpandPie(fund), 40)
    }

    // Concurrently fetch real holdings from detail API if not cached or insufficient
    if (!fundHoldingsCache[id] || !isValidTopHoldings(fundHoldingsCache[id])) {
      try {
        const detail = await getFundDetail(id)
        if (detail) {
          const rawTop = detail.top_holdings || detail?.data?.top_holdings || detail.top5 || []
          if (isValidTopHoldings(rawTop)) {
            fundHoldingsCache[id] = rawTop.slice(0, 5).map(item => [
              item.stock_symbol || item.clean_holding_name || item.symbol || item.name || item.s || '-',
              Number(item.holding_percent ?? item.percent ?? item.p ?? 0)
            ])
          } else {
            fundHoldingsCache[id] = []
          }
          await nextTick()
          if (fund) setTimeout(() => drawExpandPie(fund), 40)
        }
      } catch (e) {
        console.warn('getFundDetail failed for expand:', id, e)
        if (!fundHoldingsCache[id]) {
          fundHoldingsCache[id] = []
        }
      }
    }
  }
  expandedFundIds.value = new Set(expandedFundIds.value)
}

function isFundExpanded(id) {
  return expandedFundIds.value.has(id)
}

function toggleCompare(id) {
  const clean = String(id || '').trim()
  const idx = selectedForCompare.value.indexOf(clean)
  if (idx > -1) {
    selectedForCompare.value.splice(idx, 1)
  } else {
    if (selectedForCompare.value.length >= 4) {
      alert('เปรียบเทียบได้สูงสุด 4 กองทุน')
      return
    }
    selectedForCompare.value.push(clean)
  }
}

function isFundSelected(id) {
  return selectedForCompare.value.includes(String(id || '').trim())
}

function clearCompare() {
  selectedForCompare.value = []
}

// ── Inline expand (เหมือน WordPress S.expandedSet) ─────────────────────────
const expandedSet = ref({})

// สีพาสเทลชุดเดียวกับ WordPress
const PIE_COLORS = ['#4B543B', '#DCE2AA', '#B57F50', '#8ED081', '#B4D2BA']
const pieInstances = {}

function drawExpandPie(fund) {
  const fundId = fund.id || fund.code
  const canvasId = `fd-pe-${fundId}`
  const canvas = document.getElementById(canvasId)
  if (!canvas || typeof Chart === 'undefined') return
  if (pieInstances[canvasId]) {
    pieInstances[canvasId].destroy()
    delete pieInstances[canvasId]
  }

  const top5 = getFundHoldings(fund)
  if (!top5 || !top5.length) return

  const data = top5.map(h => ({
    name: Array.isArray(h) ? h[0] : (h.symbol || h.name || '-'),
    value: Array.isArray(h) ? Number(h[1] || 0) : Number(h.percent || 0)
  }))
  const visualData = data.map(x => Math.max(Number(x.value || 0), 4))

  const ctx = canvas.getContext('2d')
  pieInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(x => x.name),
      datasets: [{
        data: visualData,
        backgroundColor: PIE_COLORS.slice(0, data.length),
        borderWidth: 2,
        borderColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
      }],
    },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (ctx) => ` ${data[ctx.dataIndex].name}: ${data[ctx.dataIndex].value.toFixed(1)}%`,
          },
        },
      },
    },
  })
}

async function toggleExpand(code) {
  // ปิด row ที่กำลัง expand อยู่
  if (expandedSet.value[code]) {
    delete expandedSet.value[code]
    if (pieInstances[`fd-pe-${code}`]) {
      pieInstances[`fd-pe-${code}`].destroy()
      delete pieInstances[`fd-pe-${code}`]
    }
    expandedSet.value = { ...expandedSet.value }
    return
  }

  // เปิด row — แสดงก่อน แล้วโหลด top holdings ทีหลัง
  expandedSet.value = { ...expandedSet.value, [code]: true }

  // หา fund object จาก state
  const allFunds = [...(state.funds.FOREIGN || []), ...(state.funds.TH || [])]
  const fund = allFunds.find(f => f.code === code)
  if (!fund) return

  // ถ้ายังไม่มี top holdings → fetch detail endpoint
  if (!fund.top || !fund.top.length) {
    try {
      const detail = await getFundDetail(code)
      if (detail) {
        // Response structure: { status, fund_code, profile: {...}, top_holdings: [...], allocations: [...] }
        // top_holdings อยู่ที่ root level ของ response ไม่ใช่ใน profile
        const topHoldings = detail.top_holdings || detail?.data?.top_holdings || []
        fund.top = topHoldings.map(item => ({
          symbol: item.stock_symbol || item.symbol || item.s || '',
          name: item.clean_holding_name || item.raw_holding_name || item.name || item.n || '',
          percent: Number(item.holding_percent ?? item.percent ?? item.p ?? 0),
        }))
      }
    } catch (e) {
      console.warn('getFundDetail failed:', code, e)
    }
  }

  // วาด Pie หลัง DOM update (เหมือน WordPress setTimeout + F.dpie)
  await nextTick()
  if (fund.top && fund.top.length) drawExpandPie(fund)
}


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
  { key: 'feeder_fund', label: 'Feeder Fund', color: '#FF6633', icon: '🔍', bg: '#fff7ed', routeName: 'fundinfo-feeder' },
  { key: 'off_shore',   label: 'Off Shore',   color: '#06b6d4', icon: '🌎', bg: '#ecfeff', routeName: 'fundinfo-offshore' },
  { key: 'thai_fund',   label: 'Thai Fund',   color: '#FF0066', icon: 'TH', bg: '#ffe4e6', isBadge: true, routeName: 'fundinfo-thai' },
  { key: 'mixed_fund',  label: 'Mixed Fund',  color: '#f59e0b', icon: '📊', bg: '#fef3c7', routeName: 'fundinfo-mixed' },
]

function goToFundinfoType(seg) {
  if (!seg?.routeName) return
  router.push({ name: seg.routeName })
}

const allocationTotal = computed(() => {
  const alloc = state.portfolioAllocation
  const src = alloc?.data || alloc
  const val = Number(src?.total_holdings_value ?? src?.total ?? src?.total_value ?? 0)
  if (val > 0) return val

  // Fallback: คำนวณ AUM รวมจาก stats (TH + FOREIGN)
  const thAum = Number(state.stats.TH?.total_aum_m_thb || 0) * 1e6
  const foAum = Number(state.stats.FOREIGN?.total_aum_m_thb || 0) * 1e6
  if (thAum + foAum > 0) return thAum + foAum

  return 5731496150000
})

const allocationSegments = computed(() => {
  const alloc = state.portfolioAllocation
  const src = alloc?.data || alloc
  const total = allocationTotal.value
  const port = src?.portfolio_allocation || src

  // 1. ถ้ามี Object 4 คีย์ (feeder_fund, off_shore, thai_fund, mixed_fund)
  if (port && typeof port === 'object' && !Array.isArray(port) && (port.feeder_fund !== undefined || port.thai_fund !== undefined || port.off_shore !== undefined)) {
    return ALLOC_META.map(meta => {
      const item = port[meta.key]
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
        val: val || (total * pct) / 100,
      }
    })
  }

  // 2. สัดส่วนมาตรฐาน 4 หมวดของพอร์ตภาพรวม (Feeder 31.0%, Off Shore 27.5%, Thai Fund 25.2%, Mixed Fund 16.3%) พร้อมสีกำหนดเฉพาะ
  const FALLBACK_PCT = { feeder_fund: 31.0, off_shore: 27.5, thai_fund: 25.2, mixed_fund: 16.3 }

  return ALLOC_META.map(meta => {
    const pct = FALLBACK_PCT[meta.key]
    return { ...meta, pct: pct.toFixed(1), rawPct: pct, val: (total * pct) / 100 }
  })
})

// ── 2. Stats Panels Normalization (Foreign & Thai Sectors) ────────────────────
const foreignStats = computed(() => {
  const stats = state.stats.FOREIGN || {}
  const raw = Array.isArray(stats) ? stats[0] : (stats?.data?.[0] || stats)
  const cards = raw?.cards || {}
  const totalFunds = raw?.total_funds || cards?.total_funds || state.totals.FOREIGN || state.funds.FOREIGN.length || 1809

  // ดึง Sector จาก 3rd_feeder_sectors ของ API ใหม่
  const feederSectors = state.sectorHierarchy?.hierarchy?.['3rd_feeder_sectors'] || []
  let sectorAllocation = []

  if (feederSectors.length) {
    const sumAum = feederSectors.reduce((s, it) => s + Number(it.total_aum_m_thb || 0), 0)
    sectorAllocation = feederSectors.slice(0, 8).map(it => ({
      name: it.sector_name,
      value: sumAum > 0 ? (Number(it.total_aum_m_thb || 0) / sumAum) * 100 : Number(it.avg_return_1y || 0),
    }))
  } else if (cards?.sector_allocation?.length) {
    sectorAllocation = cards.sector_allocation.slice(0, 8)
  } else {
    // Fallback มาตรฐาน Foreign Feeder Sectors
    sectorAllocation = [
      { name: 'Global Equity', value: 24.7 },
      { name: 'US Equity', value: 15.7 },
      { name: 'Technology Equity', value: 14.3 },
      { name: 'Global Bond', value: 11.1 },
      { name: 'Commodities Precious Metals', value: 10.6 },
      { name: 'Foreign Investment Allocation', value: 8.6 },
      { name: 'Greater China Equity', value: 7.0 },
      { name: 'Asia Pacific Ex Japan', value: 4.6 },
    ]
  }

  // ดึง Country/Regional จาก portfolioAllocation (type = REGIONAL)
  const portAlloc = Array.isArray(state.portfolioAllocation) ? state.portfolioAllocation : (state.portfolioAllocation?.data || [])
  const rawRegional = Array.isArray(portAlloc) ? portAlloc.filter(it => it.allocation_type === 'REGIONAL') : []
  let countryAllocation = []

  if (rawRegional.length) {
    // กรองเฉพาะประเทศ/ภูมิภาคหลัก
    const specificRegions = rawRegional.filter(it => !['Developed Country', 'Emerging Market'].includes(it.name))
    const list = specificRegions.length ? specificRegions : rawRegional
    const sumVal = list.reduce((s, it) => s + Number(it.weighted_percent || it.avg_percent || 0), 0)
    countryAllocation = list.slice(0, 8).map(it => ({
      name: it.name,
      value: sumVal > 0 ? (Number(it.weighted_percent || it.avg_percent || 0) / sumVal) * 100 : Number(it.weighted_percent || 0),
    }))
  } else if (cards?.country_allocation?.length) {
    countryAllocation = cards.country_allocation.slice(0, 8)
  } else {
    countryAllocation = [
      { name: 'United States', value: 38.5 },
      { name: 'Asia - Emerging', value: 29.6 },
      { name: 'Asia - Developed', value: 7.9 },
      { name: 'Eurozone', value: 6.6 },
      { name: 'Japan', value: 5.7 },
      { name: 'United Kingdom', value: 2.9 },
      { name: 'Canada', value: 2.5 },
      { name: 'Europe - ex Euro', value: 1.9 },
    ]
  }

  const topSectorName = feederSectors[0]?.sector_name || cards.top_sector?.name || 'Global Equity'
  const topStock = state.sectorHierarchy?.hierarchy?.['2nd_foreign_us_stocks']?.[0]
  const topFlowFund = topStock ? {
    code: topStock.stock_symbol || 'IVV',
    flow: Number(topStock.flow_1m_m_thb || 5442.74),
  } : (cards.top_inflow_fund || { code: 'IVV', flow: 5442.74 })

  return {
    totalFunds,
    topSector: { name: topSectorName },
    topFlowFund,
    sectorAllocation,
    countryAllocation,
  }
})

const thaiStats = computed(() => {
  const stats = state.stats.TH || {}
  const raw = Array.isArray(stats) ? stats[0] : (stats?.data?.[0] || stats)
  const cards = raw?.cards || {}
  const totalFunds = raw?.total_funds || cards?.total_funds || state.totals.TH || state.funds.TH.length || 1756

  // ดึง Sector จาก portfolioAllocation (type = SECTOR)
  const portAlloc = Array.isArray(state.portfolioAllocation) ? state.portfolioAllocation : (state.portfolioAllocation?.data || [])
  const thaiSectors = Array.isArray(portAlloc) ? portAlloc.filter(it => it.allocation_type === 'SECTOR') : []
  let sectorAllocation = []

  if (thaiSectors.length) {
    const sumPct = thaiSectors.reduce((s, it) => s + Number(it.weighted_percent || it.avg_percent || 0), 0)
    sectorAllocation = thaiSectors.slice(0, 8).map(it => ({
      name: it.name,
      value: sumPct > 0 ? (Number(it.weighted_percent || it.avg_percent || 0) / sumPct) * 100 : Number(it.weighted_percent || 0),
    }))
  } else if (cards?.sector_allocation?.length) {
    sectorAllocation = cards.sector_allocation.slice(0, 8)
  } else {
    // Fallback มาตรฐาน Thai Sectors
    sectorAllocation = [
      { name: 'บริการด้านการเงิน', value: 26.7 },
      { name: 'เทคโนโลยี', value: 24.1 },
      { name: 'อสังหาริมทรัพย์', value: 14.6 },
      { name: 'อุตสาหกรรม', value: 13.4 },
      { name: 'บริการด้านการสื่อสาร', value: 13.1 },
      { name: 'การแพทย์', value: 9.9 },
      { name: 'สินค้าฟุ่มเฟือย/ตามวัฏจักร', value: 9.2 },
      { name: 'พลังงาน', value: 9.2 },
    ]
  }

  const topSectorName = thaiSectors[0]?.name || cards.top_sector?.name || 'บริการด้านการเงิน'
  const topStock = state.sectorHierarchy?.hierarchy?.['1st_thai_stocks']?.[0]
  const topFlowFund = topStock ? {
    code: topStock.stock_symbol || 'KBANK',
    flow: Number(topStock.flow_1m_m_thb || 660.33),
  } : (cards.top_inflow_fund || { code: 'KBANK', flow: 660.33 })

  return {
    totalFunds,
    topSector: { name: topSectorName },
    topFlowFund,
    sectorAllocation,
    countryAllocation: [],
  }
})


// ── 3. Fund Tables Filtering & Sorting ───────────────────────────────────────
function filterAndSort(funds, type) {
  let rows = funds.filter(f => f.target_type === type)
  if (showOnlyFavorites.value) {
    rows = rows.filter(f => favorites.value.has(String(f.code || '').trim().toUpperCase()))
  }
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
  // API ใหม่: stock_symbol, total_holding_value_m_thb
  // API เก่า: symbol, total_thai_fund_value
  const getValue = i => Number(
    i.total_holding_value_m_thb ?? i.total_thai_fund_value ?? i.holding_value ?? 0
  )
  const getSymbol = i => i.stock_symbol ?? i.symbol ?? i.name ?? '-'
  const total = items.reduce((s, i) => s + getValue(i), 0)
  return items.slice(0, 10).map(i => ({
    name:  getSymbol(i),
    value: total ? (getValue(i) / total) * 100 : Number(i.percent ?? 0),
    raw_value: getValue(i),
    fund_count: Number(i.holding_funds_count ?? i.fund_count ?? 0),
  }))
}

function getEtfFlow(etf) {
  if (!etf || typeof etf !== 'object') return 0

  // API ใหม่ (master-etfs): ใช้ total_holding_value_m_thb แทน flow
  // API ใหม่ (thai-etfs): ใช้ estimated_flow_1m_m_thb ถ้ามี
  const newApiKeys = [
    'estimated_flow_1m_m_thb', 'estimated_flow_1y_m_thb',
    'total_holding_value_m_thb', 'total_thai_fund_value',
  ]
  for (const k of newApiKeys) {
    const val = Number(etf[k])
    if (!isNaN(val) && val !== 0) return val
  }

  const legacyKeys = [
    'flow_net_usd', 'flow_net_thb', 'flow_net', 'net_flow',
    'flow', 'flow_change', 'unit_change', 'flow_unit', 'net_flow_unit',
    'flow_1m', 'flow_change_1m', 'flow_usd', 'flow_thb',
    'net_flow_usd', 'net_flow_thb', 'unit_change_1m',
  ]
  for (const k of legacyKeys) {
    const val = Number(etf[k])
    if (!isNaN(val) && val !== 0) return val
  }

  return 0
}

function getEtfFundCount(etf) {
  // API ใหม่ (master-etfs): feeder_funds_count หรือ thai_fund_count
  if (etf.feeder_funds_count != null) return Number(etf.feeder_funds_count)
  if (etf.thai_fund_count != null)    return Number(etf.thai_fund_count)
  if (etf.holders != null)            return Number(etf.holders)
  return Number(etf.foreign_fund_count || 0)
}

// ── Fallbacks & Computeds for Comparative Exposure & ETF Zone ────────────────
const fallbackForeignHoldings = [
  { name: 'KKP', value: 56.7 },
  { name: '601818.SS', value: 8.1 },
  { name: '000001.SZ', value: 8.1 },
  { name: '600000.SS', value: 8.1 },
  { name: 'LALIN', value: 4.7 },
  { name: 'SC', value: 4.7 },
  { name: 'TCAP', value: 4.0 },
  { name: 'CPF', value: 2.9 },
  { name: 'KBANK', value: 2.4 },
  { name: '7299.HK', value: 0.2 },
]

const fallbackThaiHoldings = [
  { name: 'AOT', value: 33.6 },
  { name: 'PTT', value: 25.0 },
  { name: 'KTB', value: 19.6 },
  { name: 'DELTA', value: 11.0 },
  { name: 'ADVANC', value: 5.2 },
  { name: 'GULF', value: 3.1 },
  { name: 'CPALL', value: 1.3 },
  { name: 'KKP', value: 0.8 },
  { name: 'ITC', value: 0.2 },
  { name: 'KBANK', value: 0.1 },
]

const displayForeignHoldings = computed(() => {
  const rows = topStockRows(state.topStocks.FOREIGN)
  return rows.length ? rows : fallbackForeignHoldings
})

const displayThaiHoldings = computed(() => {
  const rows = topStockRows(state.topStocks.TH)
  return rows.length ? rows : fallbackThaiHoldings
})

const fallbackMasterEtfs = [
  { symbol: 'OP0000XHC4.SW', name: 'Wellington Strategic European Equity', tag: 'ETF', aum: 1000, fund_count: 3 },
  { symbol: 'DAPP', name: 'VanEck Digital Transformation ETF (US)', tag: 'ETF', aum: 486, fund_count: 6 },
  { symbol: 'EWT', name: 'iShares MSCI Taiwan ETF', tag: 'ETF', aum: 484, fund_count: 2 },
  { symbol: 'GLD.BA', name: 'SPDR GOLD TRUST (กองทุนทองคำโลก)', tag: 'Gold', aum: 386, fund_count: 22 },
  { symbol: 'EUEA.AS', name: 'iShares Core EURO STOXX 50 UCITS ETF', tag: 'ETF', aum: 275, fund_count: 2 },
  { symbol: 'PSI', name: 'Invesco Dynamic Semiconductors ETF', tag: 'Semiconductors', aum: 242, fund_count: 1 },
]

const fallbackThaiEtfs = [
  { symbol: 'TDEX', name: 'กองทุนเปิดไทยเด็กซ์เซ็ท 50 (ONEAM · AUM ฿4,000M)', tag: 'SET 50 Index Fund', return_1y: 38.10, aum_m_thb: 4000 },
  { symbol: '1DIV', name: 'กองทุนเปิดไทยเด็กซ์ SET High Dividend (ONEAM · AUM ฿282M)', tag: 'Equity Large Cap', return_1y: 48.94, aum_m_thb: 282 },
  { symbol: 'BSET100', name: 'กองทุนเปิด BCAP SET100 ETF (BBLAM · AUM ฿2,000M)', tag: 'Equity Large Cap', return_1y: 37.27, aum_m_thb: 2000 },
  { symbol: 'BMSCITH', name: 'กองทุนเปิด BCAP MSCI Thailand ETF (BBLAM · AUM ฿848M)', tag: 'Equity Large Cap', return_1y: 34.30, aum_m_thb: 848 },
  { symbol: 'ONE-STOXXASEANETF', name: 'กองทุนเปิด วรรณ STOXX ASEAN ETF (ONEAM · AUM ฿54M)', tag: 'ASEAN Equity', return_1y: 13.88, aum_m_thb: 54 },
  { symbol: 'ENGY', name: 'กองทุนเปิด MTrack Energy ETF (EASTSPRING · AUM ฿53M)', tag: 'Energy', return_1y: -9.27, aum_m_thb: 53 },
]

const displayMasterEtfs = computed(() => {
  if (state.masterEtfs && state.masterEtfs.length) {
    return state.masterEtfs.slice(0, 6).map(etf => ({
      symbol: etf.symbol ?? etf.code,
      name: etf.name ?? etf.fund_name ?? '',
      tag: etf.tag ?? etf.category ?? etf.type ?? 'ETF',
      aum: Math.abs(getEtfFlow(etf)) || Number(etf.aum_m_thb || 0),
      fund_count: getEtfFundCount(etf) || 1,
    }))
  }
  return fallbackMasterEtfs
})

const displayThaiEtfs = computed(() => {
  if (state.thaiEtfs && state.thaiEtfs.length) {
    return state.thaiEtfs.slice(0, 6).map(etf => ({
      symbol: etf.fund_code ?? etf.symbol ?? etf.code,
      name: etf.fund_name_th ?? etf.name ?? etf.fund_name ?? '',
      tag: etf.aimc_category_name_en ?? etf.tag ?? etf.category ?? etf.type ?? 'Equity',
      return_1y: Number(etf.return_1y ?? etf.return_1m ?? 0),
      aum_m_thb: Number(etf.aum_m_thb || 0),
      amc_name: etf.amc_name,
    }))
  }
  return fallbackThaiEtfs
})

const AMC_FULL_NAMES = {
  SCB: 'ไทยพาณิชย์ (SCBAM)',
  SCBAM: 'ไทยพาณิชย์ (SCBAM)',
  KA: 'กสิกรไทย (KAsset)',
  KASSET: 'กสิกรไทย (KAsset)',
  BBL: 'บัวหลวง (BBLAM)',
  BBLAM: 'บัวหลวง (BBLAM)',
  ES: 'อีสท์สปริง (Eastspring)',
  EASTSPRING: 'อีสท์สปริง (Eastspring)',
  KSAM: 'กรุงศรี (KSAM)',
  ab: 'abrdn (อเบอร์ดีน)',
  ABRDN: 'abrdn (อเบอร์ดีน)',
  BCAP: 'บีแคป (BCAP)',
  ONE: 'วรรณ (ONEAM)',
  ONEAM: 'วรรณ (ONEAM)',
  KKP: 'เกียรตินาคินภัทร (KKPAM)',
  KKPAM: 'เกียรตินาคินภัทร (KKPAM)',
  KTAM: 'กรุงไทย (KTAM)',
  DAOL: 'ดาโอ (DAOL)',
  DAOLSEC: 'ดาโอ (DAOL)',
  TISCO: 'ทิสโก้ (TISCOAM)',
  MFC: 'เอ็มเอฟซี (MFC)',
  UOB: 'ยูโอบี (UOBAM)',
  UOBAM: 'ยูโอบี (UOBAM)',
  LH: 'แลนด์ แอนด์ เฮ้าส์ (LHAM)',
  LHAM: 'แลนด์ แอนด์ เฮ้าส์ (LHAM)',
  PRINCIPAL: 'พรินซิเพิล (Principal)',
  TMB: 'ทีเอ็มบีอีสท์สปริง',
}

function detectFundCategory(f, defaultType) {
  const text = `${f.fund_type || ''} ${f.method || ''} ${f.name || ''} ${f.sector || ''}`.toLowerCase()
  if (text.includes('ผสม') || text.includes('mixed') || text.includes('balanced') || text.includes('multi-asset')) {
    return 'mixed'
  }
  if (f.target_type === 'TH' || defaultType === 'thai') {
    return 'thai'
  }
  if (f.feeder || f.is_feeder_fund || text.includes('feeder') || text.includes('master') || text.includes('fund of funds')) {
    return 'feeder'
  }
  return 'offshore'
}

// ── Unified 400 Funds Screener Computeds (fund2-main) ──────────────────────
const allUnifiedFunds = computed(() => {
  const apiF = state.funds.FOREIGN.map(f => {
    const cat = detectFundCategory(f, 'feeder')
    const amcKey = String(f.amc || '').trim().toUpperCase()
    return {
      id: f.code,
      name: f.name,
      type: cat,
      amc: f.amc,
      amcFull: AMC_FULL_NAMES[amcKey] || f.amc,
      nav: Number(f.nav || 0),
      chg1d: Number(f.chg1d || f.change_1d || 0),
      ret1m: Number(f.r1m || 0),
      perf: Number(f.ret || 0),
      ret3y: Number(f.return_3y || 0),
      risk: Number(f.risk || 5),
      div: Number(f.dividend_yield || f.div || 0),
      aum: Number(f.aum || 0),
      starred: isFavorite(f.code),
      master: f.feeder || '',
      holdings: (f.top || []).map(h => [h.symbol || h.s || '', Number(h.percent || h.p || 0)])
    }
  })
  const apiTH = state.funds.TH.map(f => {
    const cat = detectFundCategory(f, 'thai')
    const amcKey = String(f.amc || '').trim().toUpperCase()
    return {
      id: f.code,
      name: f.name,
      type: cat,
      amc: f.amc,
      amcFull: AMC_FULL_NAMES[amcKey] || f.amc,
      nav: Number(f.nav || 0),
      chg1d: Number(f.chg1d || f.change_1d || 0),
      ret1m: Number(f.r1m || 0),
      perf: Number(f.ret || 0),
      ret3y: Number(f.return_3y || 0),
      risk: Number(f.risk || 5),
      div: Number(f.dividend_yield || f.div || 0),
      aum: Number(f.aum || 0),
      starred: isFavorite(f.code),
      master: '',
      holdings: (f.top || []).map(h => [h.symbol || h.s || '', Number(h.percent || h.p || 0)])
    }
  })
  return [...apiF, ...apiTH]
})

const filteredUnifiedFunds = computed(() => {
  let list = allUnifiedFunds.value
  if (screenerCategory.value !== 'all') list = list.filter(f => f.type === screenerCategory.value)
  if (tableSearchQuery.value.trim()) {
    const q = tableSearchQuery.value.trim().toLowerCase()
    list = list.filter(f =>
      (f.id || '').toLowerCase().includes(q) ||
      (f.name || '').toLowerCase().includes(q) ||
      (f.amcFull || f.amc || '').toLowerCase().includes(q)
    )
  }
  if (selectedScreenerAmc.value && selectedScreenerAmc.value !== 'all') {
    const amc = selectedScreenerAmc.value.toLowerCase()
    list = list.filter(f => (f.amc || '').toLowerCase().includes(amc) || (f.amcFull || '').toLowerCase().includes(amc))
  }
  if (selectedScreenerRisk.value && selectedScreenerRisk.value !== 'all') {
    if (selectedScreenerRisk.value === 'low') list = list.filter(f => f.risk <= 4)
    else if (selectedScreenerRisk.value === 'med') list = list.filter(f => f.risk === 5)
    else if (selectedScreenerRisk.value === 'high') list = list.filter(f => f.risk >= 6)
  }
  return [...list].sort((a, b) => {
    if (screenerSortBy.value === 'perfDesc') return b.perf - a.perf
    if (screenerSortBy.value === 'perfAsc') return a.perf - b.perf
    if (screenerSortBy.value === 'aumDesc') return (b.aum || 0) - (a.aum || 0)
    if (screenerSortBy.value === 'nameAsc') return (a.id || '').localeCompare(b.id || '')
    return 0
  })
})

const unifiedTotalPages = computed(() =>
  Math.max(1, Math.ceil(filteredUnifiedFunds.value.length / screenerPageSize.value))
)

const pagedUnifiedFunds = computed(() => {
  const s = (screenerPage.value - 1) * screenerPageSize.value
  return filteredUnifiedFunds.value.slice(s, s + screenerPageSize.value)
})

const unifiedRangeStart = computed(() =>
  filteredUnifiedFunds.value.length === 0 ? 0 : (screenerPage.value - 1) * screenerPageSize.value + 1
)

const unifiedRangeEnd = computed(() =>
  Math.min(screenerPage.value * screenerPageSize.value, filteredUnifiedFunds.value.length)
)

function goToUnifiedPage(p) {
  if (p >= 1 && p <= unifiedTotalPages.value) screenerPage.value = p
}

function getTypeBadgeClass(type) {
  const map = {
    feeder: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
    offshore: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    thai: 'bg-yellow-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60',
    mixed: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
  }
  return map[type] || 'bg-slate-100 text-slate-600'
}

function getTypeLabel(type) {
  const map = { feeder: 'Feeder', offshore: 'Offshore', thai: 'Thai Equity', mixed: 'Mixed' }
  return map[type] || type
}

function getRiskBadgeClass(risk) {
  if (risk >= 7) return 'bg-rose-100 text-rose-800'
  if (risk >= 5) return 'bg-amber-100 text-amber-800'
  return 'bg-emerald-100 text-emerald-800'
}

function getFundHoldings(f) {
  if (!f) return []
  const id = f.id || f.code

  if (isValidTopHoldings(fundHoldingsCache[id])) {
    return fundHoldingsCache[id].slice(0, 5)
  }

  if (isValidTopHoldings(f.holdings)) {
    return f.holdings.slice(0, 5)
  }

  if (isValidTopHoldings(f.top)) {
    return f.top.slice(0, 5).map(h => [h.symbol || h.name || h.s || '-', Number(h.percent || h.p || 0)])
  }

  return []
}

const inlineCompareOpen = ref(false)
const inlineCompareCollapsed = ref(false)

function openInlineCompare() {
  if (selectedForCompare.value.length < 1) return
  inlineCompareOpen.value = true
  inlineCompareCollapsed.value = false
  nextTick(() => {
    renderCompareCharts()
    const el = document.getElementById('inlineCompareContainer')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

function closeInlineCompare() {
  inlineCompareOpen.value = false
  destroyCompareCharts()
}

function toggleInlineCompareCollapse() {
  inlineCompareCollapsed.value = !inlineCompareCollapsed.value
  if (!inlineCompareCollapsed.value) {
    nextTick(() => renderCompareCharts())
  } else {
    destroyCompareCharts()
  }
}

watch(
  () => [selectedForCompare.value.slice(), inlineCompareOpen.value, inlineCompareCollapsed.value],
  async () => {
    if (inlineCompareOpen.value && !inlineCompareCollapsed.value && selectedForCompare.value.length > 0) {
      await nextTick()
      renderCompareCharts()
    } else {
      destroyCompareCharts()
    }
  },
  { deep: true }
)

const inlineCompareFunds = computed(() => {
  return selectedForCompare.value.map(code => {
    const found = allUnifiedFunds.value.find(f => String(f.id || '').trim().toUpperCase() === code)
    if (found) {
      return {
        ...found,
        holdings: getFundHoldings(found)
      }
    }
    return { id: code, name: code, type: 'feeder', risk: 0, perf: 0, ret1m: 0, ret3y: 0, nav: 0, aum: 0, amc: '', amcFull: '', master: '', holdings: [] }
  })
})

const highestPerfFundId = computed(() => {
  if (!inlineCompareFunds.value.length) return null
  const sorted = [...inlineCompareFunds.value].sort((a, b) => (Number(b.perf) || 0) - (Number(a.perf) || 0))
  return sorted[0]?.id || null
})

// ── Fund In-Depth Insight Modal ─────────────────────────────────────────────
const insightModal = reactive({
  open: false,
  fund: null,
  holdings: [],
  detail: null,
  loading: false,
})

let insightPieInstance = null

function drawInsightPie(fund) {
  const canvas = document.getElementById('insightPieCanvas')
  if (!canvas || typeof Chart === 'undefined') return
  if (insightPieInstance) {
    insightPieInstance.destroy()
    insightPieInstance = null
  }

  const top5 = getFundHoldings(fund)
  if (!top5 || !top5.length) return

  const data = top5.map(h => ({
    name: Array.isArray(h) ? h[0] : (h.symbol || h.name || '-'),
    value: Array.isArray(h) ? Number(h[1] || 0) : Number(h.percent || 0)
  }))
  const visualData = data.map(x => Math.max(Number(x.value || 0), 4))

  const ctx = canvas.getContext('2d')
  insightPieInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(x => x.name),
      datasets: [{
        data: visualData,
        backgroundColor: PIE_COLORS.slice(0, data.length),
        borderWidth: 2,
        borderColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
      }],
    },
    options: {
      responsive: false,
      maintainAspectRatio: true,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => '',
            label: (ctx) => ` ${data[ctx.dataIndex].name}: ${data[ctx.dataIndex].value.toFixed(1)}%`,
          },
        },
      },
    },
  })
}

async function openInsightModal(fund) {
  if (!fund) return
  insightModal.fund = fund
  insightModal.holdings = getFundHoldings(fund)
  insightModal.open = true
  insightModal.loading = true
  document.body.style.overflow = 'hidden'

  await nextTick()
  setTimeout(() => drawInsightPie(fund), 50)

  const id = fund.id || fund.code
  if (!fundHoldingsCache[id] || !isValidTopHoldings(fundHoldingsCache[id])) {
    try {
      const detail = await getFundDetail(id)
      if (detail) {
        insightModal.detail = detail
        const rawTop = detail.top_holdings || detail?.data?.top_holdings || detail.top5 || []
        if (isValidTopHoldings(rawTop)) {
          fundHoldingsCache[id] = rawTop.slice(0, 5).map(item => [
            item.stock_symbol || item.clean_holding_name || item.symbol || item.name || item.s || '-',
            Number(item.holding_percent ?? item.percent ?? item.p ?? 0)
          ])
          insightModal.holdings = fundHoldingsCache[id]
          await nextTick()
          drawInsightPie(fund)
        }
      }
    } catch (e) {
      console.warn('insight detail fetch failed:', e)
    } finally {
      insightModal.loading = false
    }
  } else {
    insightModal.loading = false
  }
}

function closeInsightModal() {
  insightModal.open = false
  document.body.style.overflow = ''
  if (insightPieInstance) {
    insightPieInstance.destroy()
    insightPieInstance = null
  }
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

  // เปลี่ยนสัญลักษณ์ค้นหาและแสดงผลในตารางด้านล่างโดยไม่ต้องเปิดหน้าต่าง Drawer
  state.searchSymbols = [clean]
  state.searchInput = ''
  runSearch()

  // เลื่อนหน้าจอลงไปที่ตารางค้นหาด้านล่าง
  const tbl = document.querySelector('.fi-fundsec')
  if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

// ── Favorites Actions ────────────────────────────────────────────────────────
function toggleFavorite(code) {
  if (!code) return
  const clean = String(code).trim().toUpperCase()
  if (favorites.value.has(clean)) {
    favorites.value.delete(clean)
  } else {
    favorites.value.add(clean)
  }
  favorites.value = new Set(favorites.value)
  localStorage.setItem('migrat.favorites', JSON.stringify([...favorites.value]))
}

function isFavorite(code) {
  if (!code) return false
  return favorites.value.has(String(code).trim().toUpperCase())
}

function toggleShowOnlyFavorites() {
  showOnlyFavorites.value = !showOnlyFavorites.value
  resetPaging()
}

// ── Export CSV Action ────────────────────────────────────────────────────────
function exportToCsv() {
  const allCurrent = [...activeFundsForeign.value, ...activeFundsTH.value]
  if (!allCurrent.length) {
    alert('ไม่มีข้อมูลกองทุนสำหรับส่งออก CSV')
    return
  }

  const headers = ['Target Type', 'Code', 'Name', 'AMC', 'Risk', '1Y Return (%)', 'NAV', 'AUM (THB)', 'Method', 'Sector', 'Fund Type']
  const csvRows = [headers.join(',')]

  allCurrent.forEach(f => {
    const row = [
      `"${f.target_type || ''}"`,
      `"${(f.code || '').replace(/"/g, '""')}"`,
      `"${(f.name || '').replace(/"/g, '""')}"`,
      `"${(f.amc || '').replace(/"/g, '""')}"`,
      f.risk || 0,
      (f.ret || 0).toFixed(2),
      (f.nav || 0).toFixed(4),
      f.aum || 0,
      `"${(f.method || '').replace(/"/g, '""')}"`,
      `"${(f.sector || '').replace(/"/g, '""')}"`,
      `"${(f.fund_type || '').replace(/"/g, '""')}"`
    ]
    csvRows.push(row.join(','))
  })

  const csvContent = '\uFEFF' + csvRows.join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `ideafund-dashboard-export-${Date.now()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ── Compare Charts Config & Functions ──────────────────────────────────────────
const COMPARE_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6']
const COMPARE_COLORS_BG = ['rgba(37,99,235,0.18)', 'rgba(16,185,129,0.18)', 'rgba(245,158,11,0.18)', 'rgba(139,92,246,0.18)']

const compareReturnChartRef = ref(null)
const compareRiskChartRef = ref(null)
let compareChartInstances = {}

function destroyCompareCharts() {
  Object.values(compareChartInstances).forEach(chart => chart?.destroy())
  compareChartInstances = {}
}

function renderCompareCharts() {
  destroyCompareCharts()
  if (!inlineCompareOpen.value || inlineCompareCollapsed.value || !inlineCompareFunds.value.length) return

  const funds = inlineCompareFunds.value
  if (!funds.length) return

  // 1. กราฟเส้นเปรียบเทียบผลตอบแทนย้อนหลัง (1D, 1M, 1Y, 3Y)
  if (compareReturnChartRef.value) {
    const returnPeriods = [
      { key: 'chg1d', label: '1 วัน (1D)' },
      { key: 'ret1m', label: '1 เดือน (1M)' },
      { key: 'perf', label: '1 ปี (1Y)' },
      { key: 'ret3y', label: '3 ปี (3Y)' },
    ]

    const datasets = funds.map((f, i) => ({
      label: f.id,
      data: returnPeriods.map(p => Number((f[p.key] ?? 0).toFixed(2))),
      borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
      backgroundColor: COMPARE_COLORS_BG[i % COMPARE_COLORS_BG.length],
      borderWidth: 3,
      tension: 0.35,
      fill: false,
      pointRadius: 6,
      pointHoverRadius: 9,
      pointBackgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2.5,
    }))

    compareChartInstances.return = new Chart(compareReturnChartRef.value, {
      type: 'line',
      data: {
        labels: returnPeriods.map(p => p.label),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 14,
              font: { family: 'Prompt', size: 13, weight: 'bold' },
              color: '#334155',
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            padding: 12,
            titleFont: { family: 'Prompt', size: 13, weight: 'bold' },
            bodyFont: { family: 'Prompt', size: 13 },
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Prompt', size: 12, weight: 'bold' }, color: '#475569' }
          },
          y: {
            grid: {
              color: (ctx) => ctx.tick?.value === 0 ? 'rgba(100, 116, 139, 0.6)' : 'rgba(226, 232, 240, 0.8)',
              lineWidth: (ctx) => ctx.tick?.value === 0 ? 2 : 1,
            },
            ticks: {
              font: { family: 'Prompt', size: 12 },
              color: '#64748b',
              callback: (v) => `${v}%`,
            },
          },
        },
      },
    })
  }

  // 2. กราฟเส้นเปรียบเทียบความเสี่ยง & ดัชนีคุณภาพ
  if (compareRiskChartRef.value) {
    const riskMetrics = [
      { key: 'risk', label: 'ระดับความเสี่ยง (1-8)' },
      { key: 'div', label: 'อัตราเงินปันผล (%)' },
      { key: 'sharpe', label: 'Sharpe Ratio (Est.)' },
    ]

    const datasets = funds.map((f, i) => {
      const sharpeVal = f.perf ? Number((Math.max(f.perf, 0) / (Number(f.risk || 5) * 2.5)).toFixed(2)) : 0.8
      return {
        label: f.id,
        data: [
          Number(f.risk || 5),
          Number((f.div ?? 0).toFixed(2)),
          sharpeVal,
        ],
        borderColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
        backgroundColor: COMPARE_COLORS_BG[i % COMPARE_COLORS_BG.length],
        borderWidth: 3,
        tension: 0.35,
        fill: false,
        pointRadius: 6,
        pointHoverRadius: 9,
        pointBackgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2.5,
      }
    })

    compareChartInstances.risk = new Chart(compareRiskChartRef.value, {
      type: 'line',
      data: {
        labels: riskMetrics.map(m => m.label),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 14,
              font: { family: 'Prompt', size: 13, weight: 'bold' },
              color: '#334155',
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            padding: 12,
            titleFont: { family: 'Prompt', size: 13, weight: 'bold' },
            bodyFont: { family: 'Prompt', size: 13 },
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: 'Prompt', size: 12, weight: 'bold' }, color: '#475569' }
          },
          y: {
            grid: { color: 'rgba(226, 232, 240, 0.8)' },
            ticks: { font: { family: 'Prompt', size: 12 }, color: '#64748b' },
          },
        },
      },
    })
  }
}


// ── Back to Top & Page Jump ──────────────────────────────────────────────────
function handleScroll() {
  showBackToTop.value = window.scrollY > 300
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function jumpToPage() {
  const p = parseInt(jumpPageInput.value, 10)
  if (!isNaN(p) && p >= 1 && p <= totalPages.value) {
    state.page = p
    jumpPageInput.value = ''
  } else {
    alert(`กรุณาระบุเลขหน้าระหว่าง 1 ถึง ${totalPages.value}`)
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  document.body.style.overflow = ''
  destroyCompareCharts()
})

// ── Actions ───────────────────────────────────────────────────────────────────
function resetPaging() { state.page = 1; expandedSet.value = {} }

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
  state.sectorHierarchy     = snap.sectorHierarchy
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
  <main class="flex-1 flex flex-col antialiased bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100">

    <!-- ── Notices ─────────────────────────────────────────────────────────── -->
    <div v-if="errorMessage" class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 w-full pt-4">
      <div class="fi-notice fi-notice--error">⚠ {{ errorMessage }}</div>
    </div>
    <div v-if="partialErrorMessage" class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 w-full pt-2">
      <div class="fi-notice fi-notice--warn">⚠ {{ partialErrorMessage }}</div>
    </div>

    <!-- ── 1. FUNDINFO Hero & Barometer ───────────────────────────────────── -->
    <section class="bg-gradient-to-b from-white via-slate-50/60 to-slate-100/70 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 border-b border-slate-200/80 dark:border-slate-800 py-8 md:py-10">
      <div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-200/70 dark:border-slate-800/80">
          <div>

            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              วิเคราะห์การถือครองหุ้นผ่านกองทุนรวม
            </h1>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
              เจาะลึกโครงสร้างกองทุนรวมไทยกว่า 400 กอง สัดส่วนหุ้นรายตัว Master Fund ต่างประเทศ และกระแสเงินทุนแบบ Real-time
            </p>
          </div>

          <!-- Integrated Institutional Hero Stat (No Box Card, Pure Open Typography) -->
          <div class="lg:pl-8 lg:border-l lg:border-slate-200/80 dark:lg:border-slate-800 flex flex-col justify-center shrink-0">
            <!-- Label row -->
            <div class="flex items-center gap-2 mb-1">
              <span class="relative flex h-2.5 w-2.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                มูลค่าการถือครองรวม (Total Holdings)
              </span>
              <span class="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/60 px-2 py-0.5 rounded-full shadow-xs">
                ▲ +4.8% <span class="font-normal text-[9px] opacity-80">YoY</span>
              </span>
            </div>

            <!-- Main Value Display (Open Large Typo) -->
            <div class="flex items-baseline gap-2 my-0.5">
              <span class="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">฿</span>
              <span class="text-3xl sm:text-4xl lg:text-[44px] font-black tracking-tight text-slate-900 dark:text-white num leading-none">
                {{ allocationTotal ? formatNumber(allocationTotal) : '13,296,659,660,000' }}
              </span>
            </div>

            <!-- Meta details inline -->
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2">
              <span class="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/90 px-2 py-0.5 rounded text-[11px]">
                ~{{ allocationTotal ? (allocationTotal / 1e12).toFixed(2) + ' ล้านล้านบาท' : '13.30 ล้านล้านบาท' }}
              </span>
              <span class="text-slate-300 dark:text-slate-600">•</span>
              <span>{{ formatNumber(totalFunds || 400) }} กองทุนรวม</span>
              <span class="text-slate-300 dark:text-slate-600">•</span>
              <span class="text-[11px] text-slate-400">{{ cacheMessage || (state.loadedAt ? 'อัปเดต ' + state.loadedAt : 'Real-time Data') }}</span>
              <button @click="refreshDashboard" :disabled="loading.page" class="inline-flex items-center gap-0.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer" title="รีเฟรชข้อมูล">
                <span class="inline-block text-xs" :class="{ 'animate-spin': loading.page }">↻</span>
                <span class="text-[11px]">{{ loading.page ? 'รีเฟรช...' : 'รีเฟรช' }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 4 Fund Type Pills (Linked to workspace tabs) -->
        <div class="mt-7 pt-1">
          <div class="flex items-center gap-2 mb-3">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">สัดส่วนตามประเภทกองทุนหลัก (Asset Allocation Share)</span>
            <span class="text-[11px] text-slate-400">• คลิกเพื่อเปิด Workspace กองทุนแต่ละประเภท</span>
          </div>

          <!-- Multi-segment visual progress line -->
          <div class="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
            <RouterLink
              v-for="seg in allocationSegments"
              :key="seg.key"
              :to="{ name: seg.routeName }"
              class="h-full bg-gradient-to-r cursor-pointer hover:brightness-110 transition relative group block"
              :class="seg.barGradient || 'from-orange-500 to-amber-500'"
              :style="{ width: seg.pct + '%' }"
              :title="`${seg.label} ${seg.pct}% (คลิกเปิด Workspace Fundinfo)`"
            ></RouterLink>
          </div>

          <!-- 4 Category Cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <RouterLink
              v-for="seg in allocationSegments"
              :key="seg.key"
              :to="{ name: seg.routeName }"
              class="group block p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 hover:shadow-md transition relative overflow-hidden"
              :class="seg.hoverBorder || 'hover:border-orange-400'"
            >
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <span class="w-2.5 h-2.5 rounded-full" :class="seg.dotColor || 'bg-orange-500'"></span>
                  {{ seg.label }}
                </span>
                <span class="text-xs font-bold num" :class="seg.textColor || 'text-orange-600 dark:text-orange-400'">{{ seg.pct }}%</span>
              </div>
              <div class="mt-1 flex items-baseline justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>฿{{ (seg.val / 1e12).toFixed(2) }} ล้านล้าน</span>
                <span class="group-hover:translate-x-0.5 transition font-semibold text-[10px] flex items-center gap-0.5" :class="seg.textColor || 'text-orange-600'">
                  <span>ดูรายละเอียด</span>
                  <span>→</span>
                </span>
              </div>
              <div class="mt-1.5 text-[10px] text-slate-400 line-clamp-1">{{ seg.desc || 'คลิกเพื่อดูรายละเอียดกองทุน' }}</div>
            </RouterLink>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 2. Comparative Exposure Section (Topic Switcher + Clean Open Comparison) ──────────────────────── -->
    <section class="py-10 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
      <div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header -->
        <div class="mb-6">
          <h2 class="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            โครงสร้างการลงทุน
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 pl-0.5 mt-1">
            วิเคราะห์และเปรียบเทียบสัดส่วนหุ้นรายตัว กลุ่มอุตสาหกรรม และประเทศที่กองทุนถือครองสูงสุด
          </p>
        </div>

        <!-- Topic Buttons Toolbar (ปุ่มกดแสดงเป็นเรื่องๆไป) -->
        <div class="flex items-center gap-2 overflow-x-auto pb-2 mb-8 border-b border-slate-100 dark:border-slate-800">
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">เลือกดูข้อมูล:</span>
          <button type="button" @click="setExposureTopic('holdings')" class="exp-topic-btn" :class="{ active: activeTopic === 'holdings' }">
            <span>🏆 10 หุ้นที่ถือครองสูงสุด (Top Holdings)</span>
          </button>
          <button type="button" @click="setExposureTopic('sectors')" class="exp-topic-btn" :class="{ active: activeTopic === 'sectors' }">
            <span>🏢 สัดส่วนกลุ่มอุตสาหกรรม (Sectors)</span>
          </button>
          <button type="button" @click="setExposureTopic('countries')" class="exp-topic-btn" :class="{ active: activeTopic === 'countries' }">
            <span>🌍 ประเทศและภูมิภาค (Countries)</span>
          </button>
          <button type="button" @click="setExposureTopic('kpis')" class="exp-topic-btn" :class="{ active: activeTopic === 'kpis' }">
            <span>📊 ตัวชี้วัดภาพรวม (Key KPIs)</span>
          </button>
        </div>

        <!-- Comparative Layout Container (Open, Unboxed, High Legibility) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative">

          <!-- Left Side: Foreign Funds -->
          <div class="space-y-6">
            <div class="flex items-center justify-between pb-3 border-b-2 border-blue-500">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shadow-xs">🌐</div>
                <div>
                  <h3 class="font-bold text-base text-slate-900 dark:text-white">กองทุนต่างประเทศ (Foreign Exposure)</h3>
                  <span class="text-[11px] text-slate-400">รวม Feeder Fund และ Offshore Direct Investment ({{ formatNumber(foreignStats.totalFunds || 5733) }} กองทุน)</span>
                </div>
              </div>
              <RouterLink :to="{ name: 'fundinfo-offshore' }" class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                <span>เจาะลึก {{ formatNumber(foreignStats.totalFunds || 5733) }} กองทุน →</span>
              </RouterLink>
            </div>

            <!-- Topic 1: Top Holdings (Foreign) -->
            <div v-show="activeTopic === 'holdings'" class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400 font-bold px-3 pb-1">
                <span>อันดับหุ้นต่างประเทศที่กองทุนไทยถือสูงสุด</span>
                <span>สัดส่วน (%)</span>
              </div>
              <div
                v-for="(row, idx) in displayForeignHoldings"
                :key="row.name"
                class="exp-data-row"
                @click="handleSymbolClick(row.name)"
              >
                <span class="exp-rank-badge" :class="idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''">{{ idx + 1 }}</span>
                <span class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm w-28 shrink-0 truncate">{{ row.name }}</span>
                <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" :style="{ width: Math.min(Math.max(row.value, 2), 100) + '%' }"></div>
                </div>
                <span class="num font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm w-12 text-right">{{ Number(row.value).toFixed(1) }}%</span>
              </div>
            </div>

            <!-- Topic 2: Sectors (Foreign) -->
            <div v-show="activeTopic === 'sectors'" class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400 font-bold px-3 pb-1">
                <span>กลุ่มอุตสาหกรรมต่างประเทศ</span>
                <span>สัดส่วน (%)</span>
              </div>
              <div
                v-for="row in barRows(foreignStats.sectorAllocation)"
                :key="row.name"
                class="exp-data-row"
                @click="filterBySector(row.name)"
              >
                <span class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm w-44 shrink-0 truncate">{{ row.name }}</span>
                <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" :style="{ width: Math.min(Math.max(row.value, 2), 100) + '%' }"></div>
                </div>
                <span class="num font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm w-12 text-right">{{ row.value.toFixed(1) }}%</span>
              </div>
            </div>

            <!-- Topic 3: Countries (Foreign) -->
            <div v-show="activeTopic === 'countries'" class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400 font-bold px-3 pb-1">
                <span>ประเทศและภูมิภาคที่กระจายการลงทุน</span>
                <span>สัดส่วน (%)</span>
              </div>
              <div
                v-for="row in barRows(foreignStats.countryAllocation)"
                :key="row.name"
                class="exp-data-row"
              >
                <span class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm w-44 shrink-0 truncate">{{ row.name }}</span>
                <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-blue-500 to-teal-500 rounded-full" :style="{ width: Math.min(Math.max(row.value, 2), 100) + '%' }"></div>
                </div>
                <span class="num font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm w-12 text-right">{{ row.value.toFixed(1) }}%</span>
              </div>
            </div>

            <!-- Topic 4: KPIs (Foreign) -->
            <div v-show="activeTopic === 'kpis'" class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer hover:border-blue-300 transition" @click="handleSymbolClick(displayForeignHoldings[0]?.name)">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">Top Holding</div>
                  <div class="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{{ displayForeignHoldings[0]?.name || 'KKP' }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    {{ (state.topStocks.FOREIGN[0]?.total_holding_value_m_thb ?? state.topStocks.FOREIGN[0]?.total_thai_fund_value) ? 'มูลค่าถือครอง ฿' + formatCompact(state.topStocks.FOREIGN[0].total_holding_value_m_thb ?? state.topStocks.FOREIGN[0].total_thai_fund_value) + 'M' : 'มูลค่าถือครอง ฿81,000M' }}
                  </div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">จำนวนกองทุน</div>
                  <div class="text-base font-extrabold text-slate-900 dark:text-white num mt-0.5">{{ formatNumber(foreignStats.totalFunds || 5733) }} กองทุน</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">ครอบคลุมทั่วโลก</div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">Top Sector</div>
                  <div class="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">{{ foreignStats.topSector?.name || 'Miscellaneous' }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">สัดส่วน {{ foreignStats.sectorAllocation[0]?.value ? foreignStats.sectorAllocation[0].value.toFixed(1) + '%' : '87.0%' }}</div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer hover:border-blue-300 transition" @click="handleSymbolClick(foreignStats.topFlowFund?.code)">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">Flow เข้าสูงสุด</div>
                  <div class="text-base font-extrabold text-emerald-600 dark:text-emerald-400 num mt-0.5">
                    {{ foreignStats.topFlowFund?.code ? (foreignStats.topFlowFund.flow >= 0 ? '+' : '') + formatCompact(foreignStats.topFlowFund.flow) + 'M' : '+89M' }}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">{{ foreignStats.topFlowFund?.code || 'XJSEMI' }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Side: Thai Funds -->
          <div class="space-y-6">
            <div class="flex items-center justify-between pb-3 border-b-2 border-amber-500">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-lg shadow-xs">🇹🇭</div>
                <div>
                  <h3 class="font-bold text-base text-slate-900 dark:text-white">กองทุนไทย (Thai Equity Exposure)</h3>
                  <span class="text-[11px] text-slate-400">หุ้นไทยรายตัวและกลุ่มอุตสาหกรรมในตลาดหลักทรัพย์ ({{ formatNumber(thaiStats.totalFunds || 1562) }} กองทุน)</span>
                </div>
              </div>
              <RouterLink :to="{ name: 'fundinfo-thai' }" class="text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 hover:underline flex items-center gap-1">
                <span>เจาะลึก {{ formatNumber(thaiStats.totalFunds || 1562) }} กองทุน →</span>
              </RouterLink>
            </div>

            <!-- Topic 1: Top Holdings (Thai) -->
            <div v-show="activeTopic === 'holdings'" class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400 font-bold px-3 pb-1">
                <span>อันดับหุ้นไทยที่กองทุนถือสูงสุด</span>
                <span>สัดส่วน (%)</span>
              </div>
              <div
                v-for="(row, idx) in displayThaiHoldings"
                :key="row.name"
                class="exp-data-row"
                @click="handleSymbolClick(row.name)"
              >
                <span class="exp-rank-badge" :class="idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''">{{ idx + 1 }}</span>
                <span class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm w-28 shrink-0 truncate">{{ row.name }}</span>
                <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-full shadow-xs" :style="{ width: Math.min(Math.max(row.value, 2), 100) + '%' }"></div>
                </div>
                <span class="num font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm w-12 text-right">{{ Number(row.value).toFixed(1) }}%</span>
              </div>
            </div>

            <!-- Topic 2: Sectors (Thai) -->
            <div v-show="activeTopic === 'sectors'" class="space-y-2">
              <div class="flex items-center justify-between text-xs text-slate-400 font-bold px-3 pb-1">
                <span>กลุ่มอุตสาหกรรมในตลาด SET / mai</span>
                <span>สัดส่วน (%)</span>
              </div>
              <div
                v-for="row in barRows(thaiStats.sectorAllocation)"
                :key="row.name"
                class="exp-data-row"
                @click="filterBySector(row.name)"
              >
                <span class="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm w-44 shrink-0 truncate">{{ row.name }}</span>
                <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full shadow-xs" :style="{ width: Math.min(Math.max(row.value, 2), 100) + '%' }"></div>
                </div>
                <span class="num font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm w-12 text-right">{{ row.value.toFixed(1) }}%</span>
              </div>
            </div>

            <!-- Topic 3: Countries (Thai) -->
            <div v-show="activeTopic === 'countries'" class="space-y-3">
              <div class="p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div class="flex items-center gap-3">
                  <span class="text-3xl">🇹🇭</span>
                  <div>
                    <h4 class="font-bold text-base text-slate-900 dark:text-white">ประเทศไทย (Thailand Equity)</h4>
                    <span class="text-xs text-amber-700 dark:text-amber-400 font-bold">100.0% สัดส่วนการลงทุนทั้งหมด</span>
                  </div>
                </div>
                <div class="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full w-full shadow-xs"></div>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                  กองทุนหุ้นไทยเน้นลงทุนในหลักทรัพย์จดทะเบียนในตลาดหลักทรัพย์แห่งประเทศไทย (SET) และตลาดหลักทรัพย์ เอ็ม เอ ไอ (mai) 100% โดยกระจายการลงทุนในหุ้นขนาดใหญ่ กลาง และเล็ก ตามดัชนีชี้วัด SET Index และ SET50/SET100
                </p>
              </div>
            </div>

            <!-- Topic 4: KPIs (Thai) -->
            <div v-show="activeTopic === 'kpis'" class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer hover:border-amber-300 transition" @click="handleSymbolClick(displayThaiHoldings[0]?.name)">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">Top Holding</div>
                  <div class="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">{{ displayThaiHoldings[0]?.name || 'AOT' }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">
                    {{ (state.topStocks.TH[0]?.total_holding_value_m_thb ?? state.topStocks.TH[0]?.total_thai_fund_value) ? 'มูลค่าถือครอง ฿' + formatCompact(state.topStocks.TH[0].total_holding_value_m_thb ?? state.topStocks.TH[0].total_thai_fund_value) + 'M' : 'มูลค่าถือครอง ฿8,664M' }}
                  </div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">จำนวนกองทุน</div>
                  <div class="text-base font-extrabold text-slate-900 dark:text-white num mt-0.5">{{ formatNumber(thaiStats.totalFunds || 1562) }} กองทุน</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">กองทุนหุ้นไทย</div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">Top Sector</div>
                  <div class="text-base font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">{{ thaiStats.topSector?.name || 'เทคโนโลยี' }}</div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">สัดส่วน {{ thaiStats.sectorAllocation[0]?.value ? thaiStats.sectorAllocation[0].value.toFixed(1) + '%' : '20.6%' }}</div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 cursor-pointer hover:border-amber-300 transition" @click="handleSymbolClick(thaiStats.topFlowFund?.code)">
                  <div class="text-[11px] text-slate-400 font-semibold uppercase">Flow เข้าสูงสุด</div>
                  <div class="text-base font-extrabold text-emerald-600 dark:text-emerald-400 num mt-0.5">
                    {{ thaiStats.topFlowFund?.code ? (thaiStats.topFlowFund.flow >= 0 ? '+' : '') + formatCompact(thaiStats.topFlowFund.flow) + 'M' : '+86M' }}
                  </div>
                  <div class="text-xs text-slate-500 dark:text-slate-400">{{ thaiStats.topFlowFund?.code || 'AOT' }}</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- ── 3. ETF Zone (Clean Open Comparative List - No Cards) ─────────────── -->
    <section class="py-10 bg-slate-50/60 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800">
      <div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Section Header (No Pill Badge) -->
        <div class="mb-6">
          <h2 class="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            ETF ZONE — ตลาด Master ETFs ต่างประเทศ และ Thai ETFs ในประเทศ
          </h2>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 pl-0.5 mt-1">
            วิเคราะห์ Master ETFs ชั้นนำระดับโลกที่กองทุนไทยเข้าถือครอง และ Thai ETFs ที่มีสภาพคล่องและผลตอบแทนเด่น
          </p>
        </div>

        <!-- 2-Column Clean Comparative Data List (Side-by-Side, Open, Unboxed) -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">

          <!-- Column 1: Master ETFs (Foreign) -->
          <div class="space-y-4">
            <!-- Header bar -->
            <div class="flex items-center justify-between pb-3 border-b-2 border-blue-500">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-lg shadow-xs">🌐</div>
                <div>
                  <h3 class="font-bold text-base text-slate-900 dark:text-white">Master ETFs (ต่างประเทศ)</h3>
                  <span class="text-[11px] text-slate-400">Top Master ETFs จัดอันดับตามมูลค่า AUM ที่กองทุนไทยถือครอง</span>
                </div>
              </div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">AUM รวม</span>
            </div>

            <!-- List rows -->
            <div class="space-y-1.5">
              <div
                v-for="(etf, idx) in displayMasterEtfs"
                :key="etf.symbol"
                class="flex items-center justify-between p-3 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition cursor-pointer group"
                @click="handleSymbolClick(etf.symbol)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class="exp-rank-badge" :class="idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''">{{ idx + 1 }}</span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-extrabold text-sm text-blue-600 dark:text-blue-400 group-hover:underline">{{ etf.symbol }}</span>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{{ etf.tag }}</span>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" :title="etf.name">{{ etf.name }}</p>
                  </div>
                </div>
                <div class="text-right shrink-0 pl-3">
                  <div class="font-black text-sm text-emerald-600 dark:text-emerald-400 num">▲ ฿{{ formatCompact(etf.aum) }}M</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">{{ etf.fund_count }} กองทุนถือครอง</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 2: Thai ETFs (Domestic) -->
          <div class="space-y-4">
            <!-- Header bar -->
            <div class="flex items-center justify-between pb-3 border-b-2 border-amber-500">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-lg shadow-xs">🇹🇭</div>
                <div>
                  <h3 class="font-bold text-base text-slate-900 dark:text-white">Thai ETFs (ในประเทศ)</h3>
                  <span class="text-[11px] text-slate-400">Top Traded Thai ETFs ในตลาด SET จัดอันดับตามผลตอบแทน 1 ปี</span>
                </div>
              </div>
              <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">ผลตอบแทน 1Y</span>
            </div>

            <!-- List rows -->
            <div class="space-y-1.5">
              <div
                v-for="(etf, idx) in displayThaiEtfs"
                :key="etf.symbol"
                class="flex items-center justify-between p-3 rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-xs transition cursor-pointer group"
                @click="handleSymbolClick(etf.symbol)"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span class="exp-rank-badge" :class="idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : ''">{{ idx + 1 }}</span>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-extrabold text-sm text-amber-700 dark:text-amber-400 group-hover:underline">{{ etf.symbol }}</span>
                      <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{{ etf.tag }}</span>
                    </div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" :title="etf.name">{{ etf.name }}</p>
                  </div>
                </div>
                <div class="text-right shrink-0 pl-3">
                  <div class="font-black text-sm num" :class="etf.return_1y >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                    {{ etf.return_1y >= 0 ? '▲ +' : '▼ ' }}{{ Math.abs(etf.return_1y).toFixed(2) }}%
                  </div>
                  <div class="text-[11px] text-slate-400 mt-0.5">
                    <span v-if="etf.aum_m_thb">AUM ฿{{ formatCompact(etf.aum_m_thb) }}M</span>
                    <span v-if="etf.amc_name"> · {{ etf.amc_name }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>



    <!-- ── 4. 400 Funds Screener (fund2-main Unified Screener) ────────────────────────── -->
    <section id="fund-screener" class="py-10 bg-slate-50/60 dark:bg-slate-950/60 flex-1">
      <div class="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              ค้นหาและคัดกรองกองทุนรวมทั้งหมด (<span id="totalFundCount" class="num">{{ filteredUnifiedFunds.length }}</span> กองทุน)
            </h2>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 pl-0.5 mt-0.5">
              เครื่องมือคัดกรองกองทุนไทยและกองทุนต่างประเทศตามผลตอบแทน ความเสี่ยง และนโยบายการจ่ายเงินปันผล
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- ปุ่ม 1: กองทุนโปรด -->
            <button 
              type="button"
              @click="toggleShowOnlyFavorites" 
              class="px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-slate-700 dark:text-slate-200 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              :class="{ 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-700': showOnlyFavorites }"
              title="แสดงเฉพาะกองทุนที่กดดาว/ชื่นชอบ"
            >
              <span class="text-amber-500">★</span>
              <span>กองทุนโปรด ({{ favorites.size }})</span>
            </button>

            <!-- ปุ่ม 2: เปรียบเทียบ -->
            <button 
              type="button"
              @click="openInlineCompare" 
              class="px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              title="เปรียบเทียบกองทุนที่เลือกในตาราง"
            >
              <span>⚖️ เปรียบเทียบที่เลือก</span>
              <span class="bg-white text-brand-700 font-extrabold px-1.5 py-0.2 rounded-full text-[10px]">{{ selectedForCompare.length }}</span>
            </button>

            <!-- ปุ่ม 3: Export CSV -->
            <button 
              type="button"
              @click="exportToCsv" 
              class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <!-- Filter Controls (ประเภทกองทุน, บลจ., Sector) -->
        <div class="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm mb-6 space-y-4">
          <!-- แถวที่ 1: ปุ่มแบ่งแต่ละกองทุน (ทั้งหมด feeder offshore thai mixed) -->
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex flex-wrap gap-1.5 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl">
              <button type="button" @click="setScreenerCategory('all')" :class="screenerCategory === 'all' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white font-bold shadow-xs' : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900'" class="sc-tab px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer">ทั้งหมด ({{ allUnifiedFunds.length }})</button>
              <button type="button" @click="setScreenerCategory('feeder')" :class="screenerCategory === 'feeder' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white font-bold shadow-xs' : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900'" class="sc-tab px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer">Feeder Fund</button>
              <button type="button" @click="setScreenerCategory('offshore')" :class="screenerCategory === 'offshore' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white font-bold shadow-xs' : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900'" class="sc-tab px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer">Offshore</button>
              <button type="button" @click="setScreenerCategory('thai')" :class="screenerCategory === 'thai' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white font-bold shadow-xs' : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900'" class="sc-tab px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer">Thai Fund</button>
              <button type="button" @click="setScreenerCategory('mixed')" :class="screenerCategory === 'mixed' ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white font-bold shadow-xs' : 'text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900'" class="sc-tab px-3.5 py-1.5 rounded-lg text-xs transition cursor-pointer">Mixed Fund</button>
            </div>

            <!-- ช่องค้นหาชื่อย่อ หรือ บลจ. -->
            <div class="relative flex-1 max-w-sm">
              <input 
                v-model="tableSearchQuery" 
                type="text" 
                placeholder="ค้นหาชื่อย่อ หรือชื่อกองทุน (e.g. SCBNDQ, K-CHANGE)..." 
                class="w-full pl-4 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
          </div>

          <!-- แถวที่ 2: ตัวกรอง Dropdown (ประเภทกองทุน, บลจ., Sector) และเพิ่มเติม -->
          <div class="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            <div>
              <label class="block text-[11px] text-slate-400 mb-1 font-medium">ประเภทกองทุน</label>
              <select v-model="screenerCategory" class="w-full py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none font-semibold">
                <option value="all">ประเภทกองทุน: ทั้งหมด</option>
                <option value="feeder">Feeder Fund</option>
                <option value="offshore">Offshore (ต่างประเทศ)</option>
                <option value="thai">Thai Fund (กองทุนไทย)</option>
                <option value="mixed">Mixed Fund (กองทุนผสม)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1 font-medium">บลจ. (Asset Management)</label>
              <select v-model="selectedScreenerAmc" class="w-full py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none font-semibold">
                <option value="all">บลจ.: ทั้งหมด</option>
                <option value="SCB">ไทยพาณิชย์ (SCBAM)</option>
                <option value="KA">กสิกรไทย (KAsset)</option>
                <option value="BBL">บัวหลวง (BBLAM)</option>
                <option value="ES">อีสท์สปริง (Eastspring)</option>
                <option value="KSAM">กรุงศรี (KSAM)</option>
                <option value="ab">abrdn</option>
                <option value="BCAP">บีแคป (BCAP)</option>
                <option value="ONE">วรรณ (ONEAM)</option>
                <option value="KKP">เกียรตินาคินภัทร (KKPAM)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1 font-medium">Sector / อุตสาหกรรม</label>
              <select v-model="selectedScreenerSector" class="w-full py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none font-semibold">
                <option value="all">Sector: ทั้งหมด</option>
                <option value="Technology">Technology (เทคโนโลยี)</option>
                <option value="Health Care">Healthcare (สุขภาพและการแพทย์)</option>
                <option value="Energy">Energy & Utilities (พลังงาน)</option>
                <option value="Finance">Financial Services (การเงิน)</option>
                <option value="Fixed Income">Fixed Income (ตราสารหนี้)</option>
                <option value="Gold">Commodity & Gold (ทองคำ/โภคภัณฑ์)</option>
                <option value="Index">Index & Large Cap (ดัชนีภาพรวม)</option>
                <option value="Multi-Asset">Multi-Asset (ผสมหลากหลายสินทรัพย์)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1 font-medium">ระดับความเสี่ยง</label>
              <select v-model="selectedScreenerRisk" class="w-full py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none">
                <option value="all">ทุกระดับความเสี่ยง</option>
                <option value="low">ต่ำ (1 - 4)</option>
                <option value="med">ปานกลาง (5)</option>
                <option value="high">สูง (6 - 8)</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] text-slate-400 mb-1 font-medium">เรียงลำดับตาม</label>
              <select v-model="screenerSortBy" class="w-full py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none">
                <option value="perfDesc">ผลตอบแทน 1Y (สูง → ต่ำ)</option>
                <option value="perfAsc">ผลตอบแทน 1Y (ต่ำ → สูง)</option>
                <option value="aumDesc">ขนาด AUM (มาก → น้อย)</option>
                <option value="nameAsc">ชื่อกองทุน (A → Z)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Screener Data Table -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div class="overflow-x-auto no-scrollbar">
            <table class="w-full text-left text-sm border-collapse">
              <thead class="bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800 select-none text-xs sm:text-sm">
                <tr>
                  <th class="py-4 px-2 w-9 text-center"></th>
                  <th class="py-4 px-3 text-center whitespace-nowrap text-slate-800 dark:text-slate-100 font-black w-24">เปรียบเทียบ</th>
                  <th class="py-4 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap" @click="screenerSortBy = screenerSortBy === 'nameAsc' ? 'perfDesc' : 'nameAsc'">รหัส / ชื่อกองทุน ⇅</th>
                  <th class="py-4 px-2 whitespace-nowrap text-center w-24">ประเภท</th>
                  <th class="py-4 px-3 whitespace-nowrap w-36 xl:w-44">บลจ.</th>
                  <th class="py-4 px-3 text-right whitespace-nowrap w-28">NAV (บาท)</th>
                  <th class="py-4 px-2.5 text-right whitespace-nowrap w-24">1M (%)</th>
                  <th class="py-4 px-2.5 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap w-24" @click="screenerSortBy = screenerSortBy === 'perfDesc' ? 'perfAsc' : 'perfDesc'">1Y (%) ⇅</th>
                  <th class="py-4 px-2.5 text-right whitespace-nowrap w-24">3Y (%)</th>
                  <th class="py-4 px-2 text-center whitespace-nowrap w-20">ความเสี่ยง</th>
                  <th class="py-4 px-2.5 text-right whitespace-nowrap w-24">ปันผล (%)</th>
                  <th class="py-4 px-3 text-center whitespace-nowrap w-28">ข้อมูลเชิงลึก</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                <tr v-if="!pagedUnifiedFunds.length">
                  <td colspan="12" class="py-16 text-center text-slate-400">
                    <div class="text-4xl mb-3">🔍</div>
                    <div class="font-extrabold text-base text-slate-700 dark:text-slate-200">ไม่พบกองทุนที่ตรงกับเงื่อนไข</div>
                    <div class="text-xs sm:text-sm text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือรีเซ็ตตัวกรอง</div>
                  </td>
                </tr>
                <template v-for="f in pagedUnifiedFunds" :key="f.id">
                  <tr 
                    class="hover:bg-slate-50/90 dark:hover:bg-slate-800/70 transition cursor-pointer"
                    :class="{ 'bg-brand-50/25 dark:bg-brand-950/20': isFundSelected(f.id), 'bg-slate-50/95 dark:bg-slate-800/90 font-semibold': isFundExpanded(f.id) }"
                    @click="toggleFundExpand(f.id)"
                    title="คลิกเพื่อเปิด/ปิด Top 5 Holdings"
                  >
                    <td class="py-3.5 px-2 text-center" @click.stop>
                      <button @click="toggleFavorite(f.id)" class="text-lg transition hover:scale-125 cursor-pointer" title="เพิ่มในรายการโปรด">
                        {{ isFavorite(f.id) ? '⭐' : '☆' }}
                      </button>
                    </td>
                    <td class="py-3.5 px-3 text-center" @click.stop>
                      <button 
                        type="button"
                        @click="toggleCompare(f.id)" 
                        class="px-2.5 py-1.5 rounded-xl text-xs font-black transition-all inline-flex items-center justify-center gap-1 shadow-2xs cursor-pointer select-none"
                        :class="isFundSelected(f.id) 
                          ? 'bg-brand-600 text-white ring-2 ring-brand-400/50 hover:bg-brand-700' 
                          : 'bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950/60 text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-300 border border-slate-200 dark:border-slate-700'"
                        :title="isFundSelected(f.id) ? 'ยกเลิกเปรียบเทียบ' : 'เลือกเปรียบเทียบ'"
                      >
                        <span v-if="isFundSelected(f.id)">✓ เทียบ</span>
                        <span v-else>+ เทียบ</span>
                      </button>
                    </td>
                    <td class="py-3.5 px-3">
                      <div class="font-black text-slate-900 dark:text-white flex items-center gap-2 whitespace-nowrap text-sm sm:text-base">
                        <span>{{ f.id }}</span>
                        <span v-if="f.div > 0" class="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded-md font-bold">ปันผล</span>
                        <span class="text-slate-400 text-xs transition-transform duration-200 inline-block" :class="{ 'rotate-180': isFundExpanded(f.id) }">⌄</span>
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] md:max-w-[260px] xl:max-w-md font-normal mt-0.5" :title="f.name">{{ f.name }}</div>
                    </td>
                    <td class="py-3.5 px-2 text-center whitespace-nowrap">
                      <span class="px-2.5 py-1 rounded-md text-xs font-bold" :class="getTypeBadgeClass(f.type)">
                        {{ getTypeLabel(f.type) }}
                      </span>
                    </td>
                    <td class="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap text-xs sm:text-sm">{{ f.amcFull || f.amc }}</td>
                    <td class="py-3.5 px-3 text-right font-black text-slate-900 dark:text-white num whitespace-nowrap tabular-nums text-sm sm:text-base">
                      {{ Number(f.nav || 0).toFixed(4) }}
                      <span class="block text-xs font-bold" :class="f.chg1d >= 0 ? 'text-emerald-600' : 'text-rose-500'">{{ f.chg1d >= 0 ? '+' : '' }}{{ Number(f.chg1d || 0).toFixed(2) }}%</span>
                    </td>
                    <td class="py-3.5 px-2.5 text-right font-bold num whitespace-nowrap tabular-nums text-sm sm:text-base" :class="f.ret1m >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                      {{ f.ret1m >= 0 ? '+' : '' }}{{ Number(f.ret1m || 0).toFixed(2) }}%
                    </td>
                    <td class="py-3.5 px-2.5 text-right font-black num whitespace-nowrap tabular-nums text-base sm:text-lg" :class="f.perf >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                      {{ f.perf >= 0 ? '+' : '' }}{{ Number(f.perf || 0).toFixed(2) }}%
                    </td>
                    <td class="py-3.5 px-2.5 text-right font-bold text-slate-600 dark:text-slate-300 num whitespace-nowrap tabular-nums text-sm sm:text-base">
                      {{ f.ret3y >= 0 ? '+' : '' }}{{ Number(f.ret3y || 0).toFixed(2) }}%
                    </td>
                    <td class="py-3.5 px-2 text-center whitespace-nowrap">
                      <span class="px-2.5 py-1 rounded-full text-xs font-black" :class="getRiskBadgeClass(f.risk)">
                        {{ f.risk }}
                      </span>
                    </td>
                    <td class="py-3.5 px-2.5 text-right num font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap tabular-nums text-sm sm:text-base">
                      {{ f.div > 0 ? Number(f.div).toFixed(1) + '%' : '—' }}
                    </td>
                    <td class="py-3.5 px-3 text-center whitespace-nowrap" @click.stop>
                      <div class="flex items-center justify-center">
                        <button 
                          type="button"
                          @click="openInsightModal(f)" 
                          class="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white dark:bg-slate-800 dark:hover:bg-brand-600 dark:text-brand-300 dark:hover:text-white text-xs sm:text-sm font-black transition inline-flex items-center gap-1.5 shadow-2xs cursor-pointer" 
                          title="เปิดหน้าต่างข้อมูลเชิงลึก & พอร์ตการถือหุ้น"
                        >
                          <span>ดูข้อมูล</span>
                          <span>🔍</span>
                        </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Top 5 Holdings Expanded Row (Full width, numbers at far right) -->
                  <tr v-if="isFundExpanded(f.id)" class="fi-tr-expand bg-slate-50/90 dark:bg-slate-850/90 border-b border-slate-200/90 dark:border-slate-800">
                    <td colspan="12" class="py-5 px-6 sm:px-10">
                      <div class="w-full flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-12">
                        <div class="flex flex-col items-center justify-center shrink-0 w-full md:w-[130px] text-center p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-750 shadow-xs">
                          <div class="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200 mb-2 whitespace-nowrap">สัดส่วน Top 5</div>
                          <div class="w-[96px] h-[96px] relative flex items-center justify-center">
                            <canvas :id="'fd-pe-' + f.id" width="96" height="96"></canvas>
                          </div>
                        </div>
                        <div class="flex-1 w-full divide-y divide-slate-200/70 dark:divide-slate-750 bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200/70 dark:border-slate-750 shadow-xs">
                          <div 
                            v-for="(h, j) in getFundHoldings(f)" 
                            :key="j"
                            class="flex items-center justify-between py-2 text-sm sm:text-base gap-4"
                          >
                            <div class="flex items-center gap-3 min-w-0">
                              <span class="w-3.5 h-3.5 rounded-sm shrink-0 shadow-2xs" :style="{ background: PIE_COLORS[j % PIE_COLORS.length] }"></span>
                              <strong class="font-extrabold text-slate-800 dark:text-slate-100 truncate text-sm sm:text-base" :title="Array.isArray(h) ? h[0] : (h.symbol || h.name)">
                                {{ Array.isArray(h) ? h[0] : (h.symbol || h.name) }}
                              </strong>
                            </div>
                            <span class="font-black text-slate-900 dark:text-white num shrink-0 text-sm sm:text-base tabular-nums text-right ml-auto">
                              {{ Number(Array.isArray(h) ? h[1] : (h.percent || 0)).toFixed(2) }}%
                            </span>
                          </div>
                          <div v-if="!getFundHoldings(f).length" class="py-4 text-sm text-slate-400 text-center font-medium">
                            ไม่พบข้อมูลสัดส่วนหุ้น
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <div>
              กำลังแสดง <span class="font-black text-slate-800 dark:text-slate-200 num">{{ unifiedRangeStart }}</span> - <span class="font-black text-slate-800 dark:text-slate-200 num">{{ unifiedRangeEnd }}</span> จากทั้งหมด <span class="font-black text-slate-800 dark:text-slate-200 num">{{ filteredUnifiedFunds.length }}</span> กองทุน
            </div>
            <div class="flex items-center gap-2">
              <button 
                type="button" 
                @click="goToUnifiedPage(screenerPage - 1)" 
                :disabled="screenerPage === 1" 
                class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 font-bold cursor-pointer"
              >
                ย้อน
              </button>
              <button 
                v-for="p in Math.min(unifiedTotalPages, 7)" 
                :key="p"
                type="button" 
                @click="goToUnifiedPage(p)" 
                class="px-3.5 py-1.5 rounded-xl font-black cursor-pointer text-xs sm:text-sm"
                :class="p === screenerPage ? 'bg-brand-600 text-white shadow-xs' : 'border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'"
              >
                {{ p }}
              </button>
              <button 
                type="button" 
                @click="goToUnifiedPage(screenerPage + 1)" 
                :disabled="screenerPage === unifiedTotalPages" 
                class="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 font-bold cursor-pointer"
              >
                ถัดไป
              </button>
            </div>
          </div>
        </div>

        <!-- Side-by-Side Fund Comparison & Charts (Inline Bottom Section) -->
        <div v-if="inlineCompareOpen && inlineCompareFunds.length" id="inlineCompareContainer" class="mt-10 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden scroll-mt-6">
          
          <!-- Section Header -->
          <div class="p-5 sm:p-7 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/80 dark:bg-slate-850/60">
            <div class="flex items-center gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center text-2xl shrink-0">
                📊
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="font-black text-xl sm:text-2xl text-slate-900 dark:text-white">เปรียบเทียบกองทุน &amp; กราฟวิเคราะห์</h3>
                  <span class="px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 text-xs font-black">
                    {{ inlineCompareFunds.length }}/4 กองทุน
                  </span>
                </div>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  วิเคราะห์เปรียบเทียบผลตอบแทนย้อนหลัง ดัชนีความเสี่ยง และรายละเอียดเชิงลึกแบบคู่ขนาน
                </p>
              </div>
            </div>
            
            <div class="flex items-center gap-2 flex-wrap">
              <button 
                type="button" 
                @click="toggleInlineCompareCollapse" 
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 shadow-xs transition cursor-pointer"
              >
                <span>{{ inlineCompareCollapsed ? '🔽' : '🔼' }}</span>
                <span>{{ inlineCompareCollapsed ? 'ขยายตาราง &amp; กราฟ' : 'ย่อส่วนนี้' }}</span>
              </button>
              <button 
                type="button" 
                @click="clearCompare(); closeInlineCompare()" 
                class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50/90 dark:bg-rose-950/50 border border-rose-200/90 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 shadow-xs transition cursor-pointer"
              >
                <span>🗑️</span>
                <span>ล้างทั้งหมด</span>
              </button>
              <button 
                type="button" 
                @click="closeInlineCompare" 
                class="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 shadow-xs transition cursor-pointer"
              >
                <span>✕</span>
                <span>ปิด</span>
              </button>
            </div>
          </div>

          <div v-show="!inlineCompareCollapsed" class="p-5 sm:p-8 space-y-8">
            
            <!-- 1. Hero Fund Cards (Executive Overview with Winner Highlight) -->
            <div class="grid gap-4" :style="`grid-template-columns: repeat(${Math.max(inlineCompareFunds.length, 1)}, minmax(0, 1fr))`">
              <div 
                v-for="(f, idx) in inlineCompareFunds" 
                :key="f.id"
                class="rounded-2xl border-2 p-4 sm:p-5 flex flex-col gap-3 relative overflow-hidden transition-all shadow-xs"
                :class="highestPerfFundId === f.id 
                  ? 'border-amber-400 dark:border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-4 ring-amber-400/10' 
                  : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/40'"
              >
                <!-- Winner badge -->
                <div v-if="highestPerfFundId === f.id" class="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl rounded-tr-xl tracking-wider uppercase shadow-xs flex items-center gap-1">
                  <span>👑</span>
                  <span>ชนะ 1Y</span>
                </div>

                <!-- Color indicator bar matching chart -->
                <div class="h-2 w-full rounded-full" :style="{ background: COMPARE_COLORS[idx % COMPARE_COLORS.length] }"></div>

                <!-- Fund Info -->
                <div>
                  <div class="font-black text-xl sm:text-2xl leading-none mb-1" :style="{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }">
                    {{ f.id }}
                  </div>
                  <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-snug line-clamp-2" :title="f.name">
                    {{ f.name }}
                  </div>
                  <div class="text-[11px] text-slate-400 font-bold mt-1">
                    {{ f.amcFull || f.amc }}
                  </div>
                </div>

                <!-- 1Y Return Big Box -->
                <div class="rounded-xl px-3 py-2.5 text-center"
                  :class="(f.perf ?? 0) >= 0 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900/60'
                    : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60'"
                >
                  <div class="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 uppercase tracking-wide">ผลตอบแทน 1Y</div>
                  <div class="text-2xl sm:text-3xl font-black num leading-none"
                    :class="(f.perf ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'"
                  >
                    {{ (f.perf ?? 0) >= 0 ? '+' : '' }}{{ f.perf }}%
                  </div>
                </div>

                <!-- Risk + Type Badges -->
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2.5 py-1 rounded-full text-xs font-black" :class="getRiskBadgeClass(f.risk)">
                    ระดับ {{ f.risk }}
                  </span>
                  <span class="px-2.5 py-1 rounded-md text-xs font-bold" :class="getTypeBadgeClass(f.type)">
                    {{ getTypeLabel(f.type) }}
                  </span>
                  <span v-if="f.div > 0" class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    ปันผล {{ f.div }}%
                  </span>
                </div>

                <!-- Action Button -->
                <div class="mt-auto pt-2 flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800">
                  <button 
                    type="button"
                    @click="openInsightModal(f)"
                    class="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 cursor-pointer flex items-center gap-1"
                  >
                    <span>ดูเชิงลึก</span> 🔍
                  </button>
                  <button 
                    type="button"
                    @click="toggleCompare(f.id)"
                    class="text-xs font-bold text-slate-400 hover:text-rose-500 cursor-pointer flex items-center gap-1"
                  >
                    <span>✕ ลบออก</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 2. Charts Section (Large, High-Definition Line Charts) -->
            <div class="space-y-4">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-xl">📈</span>
                  <h4 class="font-black text-base sm:text-lg text-slate-900 dark:text-white">
                    กราฟเส้นวิเคราะห์เปรียบเทียบเชิงลึก
                  </h4>
                  <span class="text-xs text-slate-400">(เส้นกราฟแยกสีตามแต่ละกองทุนชัดเจน)</span>
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Chart 1: Return Comparison Line Chart -->
                <div class="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col">
                  <div class="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h5 class="font-black text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>📈</span>
                        <span>กราฟเส้นเปรียบเทียบผลตอบแทนย้อนหลัง (%)</span>
                      </h5>
                      <p class="text-xs text-slate-400 mt-0.5">แนวโน้มผลตอบแทนช่วง 1 วัน (1D), 1 เดือน (1M), 1 ปี (1Y), และ 3 ปี (3Y)</p>
                    </div>
                  </div>
                  <div class="w-full h-80 sm:h-96 relative flex items-center justify-center">
                    <canvas ref="compareReturnChartRef" class="w-full h-full"></canvas>
                  </div>
                </div>

                <!-- Chart 2: Risk & Dividend Comparison Line Chart -->
                <div class="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm flex flex-col">
                  <div class="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h5 class="font-black text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>🎯</span>
                        <span>กราฟเส้นเปรียบเทียบความเสี่ยง &amp; ดัชนีคุณภาพ</span>
                      </h5>
                      <p class="text-xs text-slate-400 mt-0.5">ระดับความเสี่ยง (Risk 1-8), เงินปันผล (%) และ Sharpe Ratio</p>
                    </div>
                  </div>
                  <div class="w-full h-80 sm:h-96 relative flex items-center justify-center">
                    <canvas ref="compareRiskChartRef" class="w-full h-full"></canvas>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Metrics Matrix Table (Detailed Breakdown) -->
            <div class="bg-white dark:bg-slate-950 rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm">
              <div class="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
                <div class="font-black text-sm sm:text-base text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span>📋</span>
                  <span>ตารางข้อมูลเปรียบเทียบทุกมิติ (Comparison Matrix)</span>
                </div>
              </div>

              <div class="overflow-x-auto no-scrollbar">
                <table class="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr class="border-b border-slate-100 dark:border-slate-800">
                      <th class="p-4 w-48 sm:w-56 bg-slate-50/90 dark:bg-slate-850/80 font-black text-slate-700 dark:text-slate-200 text-sm uppercase">หัวข้อเปรียบเทียบ</th>
                      <th 
                        v-for="(f, idx) in inlineCompareFunds" 
                        :key="f.id" 
                        class="p-4 border-l border-slate-100 dark:border-slate-800 min-w-[220px]"
                        :class="highestPerfFundId === f.id ? 'bg-amber-50/40 dark:bg-amber-950/15' : ''"
                      >
                        <div class="flex items-center gap-2">
                          <span class="w-3 h-3 rounded-full shrink-0" :style="{ background: COMPARE_COLORS[idx % COMPARE_COLORS.length] }"></span>
                          <span class="font-black text-base" :style="{ color: COMPARE_COLORS[idx % COMPARE_COLORS.length] }">{{ f.id }}</span>
                          <span v-if="highestPerfFundId === f.id" class="text-amber-500 text-xs font-bold">👑 ชนะ</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">ประเภท / ตลาด</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800">
                        <span class="px-2.5 py-1 rounded text-xs font-bold" :class="getTypeBadgeClass(f.type)">{{ getTypeLabel(f.type) }}</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">ระดับความเสี่ยง</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800">
                        <span class="px-2.5 py-1 rounded-full text-xs font-black" :class="getRiskBadgeClass(f.risk)">ระดับ {{ f.risk }}</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">
                        <div>ผลตอบแทน 1 ปี (1Y)</div>
                        <div class="text-[11px] text-slate-400 font-normal">เปรียบเทียบสัดส่วน</div>
                      </td>
                      <td v-for="(f, idx) in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800">
                        <div class="flex items-center gap-2">
                          <span class="text-base font-black num" :class="f.perf >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                            {{ f.perf >= 0 ? '+' : '' }}{{ f.perf }}%
                          </span>
                          <span v-if="highestPerfFundId === f.id" class="text-amber-500 text-xs">👑</span>
                        </div>
                        <div class="mt-1.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden max-w-[140px]">
                          <div 
                            class="h-full rounded-full transition-all duration-500"
                            :style="{ 
                              width: `${Math.min(Math.max(Number(f.perf || 0), 5), 100)}%`,
                              background: COMPARE_COLORS[idx % COMPARE_COLORS.length]
                            }"
                          ></div>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">ผลตอบแทน 1 เดือน (1M)</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800 font-bold num" :class="f.ret1m >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                        {{ f.ret1m >= 0 ? '+' : '' }}{{ Number(f.ret1m || 0).toFixed(2) }}%
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">ผลตอบแทน 3 ปี (3Y)</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800 font-bold num text-slate-700 dark:text-slate-300">
                        {{ f.ret3y != null && Number(f.ret3y) !== 0 ? (Number(f.ret3y) >= 0 ? '+' : '') + Number(f.ret3y).toFixed(2) + '%' : '—' }}
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">NAV ล่าสุด (บาท)</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800 font-black text-slate-900 dark:text-white num">
                        ฿{{ Number(f.nav || 0).toFixed(4) }}
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">ขนาดกองทุน (AUM)</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800 font-extrabold text-slate-800 dark:text-slate-200 num">
                        ฿{{ formatCompact(f.aum) }}
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">เงินปันผล</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800 font-bold">
                        <span v-if="f.div > 0" class="text-emerald-600 font-black num">{{ f.div }}%</span>
                        <span v-else class="text-slate-400">ไม่จ่าย</span>
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">บลจ. ผู้บริหารกองทุน</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                        {{ f.amcFull || f.amc }}
                      </td>
                    </tr>
                    <tr>
                      <td class="p-4 font-black text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/40">การดำเนินการ</td>
                      <td v-for="f in inlineCompareFunds" :key="f.id" class="p-4 border-l border-slate-100 dark:border-slate-800">
                        <div class="flex items-center gap-2">
                          <button 
                            type="button" 
                            @click="openInsightModal(f)"
                            class="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-600 text-brand-700 hover:text-white dark:bg-slate-800 dark:text-brand-300 dark:hover:text-white text-xs font-bold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>ดูเชิงลึก</span> 🔍
                          </button>
                          <RouterLink :to="{ name: 'fundinfo-detail', params: { id: f.id } }" class="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition inline-flex items-center gap-1">
                            <span>หน้ารายละเอียด</span> ↗
                          </RouterLink>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>


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

    <!-- (Comparison Modal removed — Comparison is now showcased inline with prominent charts at the bottom) -->


    <!-- ── In-depth Fund Insight Modal (ดูข้อมูลเชิงลึก พร้อม Pie Chart) ── -->
    <Transition name="drawer-fade">
      <div v-if="insightModal.open && insightModal.fund" class="fi-drawer-overlay z-50 flex items-center justify-center p-4" @click.self="closeInsightModal">
        <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          
          <!-- Modal Header -->
          <div class="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/80 dark:bg-slate-850/60">
            <div class="flex items-start gap-3.5">
              <div class="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/60 border border-brand-200/80 dark:border-brand-900/60 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                📊
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">{{ insightModal.fund.id }}</span>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold" :class="getTypeBadgeClass(insightModal.fund.type)">
                    {{ getTypeLabel(insightModal.fund.type) }}
                  </span>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold" :class="getRiskBadgeClass(insightModal.fund.risk)">
                    ความเสี่ยง {{ insightModal.fund.risk }}
                  </span>
                  <span v-if="insightModal.fund.div > 0" class="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold">
                    ปันผล {{ insightModal.fund.div }}%
                  </span>
                </div>
                <h3 class="text-sm sm:text-base font-semibold text-slate-600 dark:text-slate-300 leading-snug">{{ insightModal.fund.name }}</h3>
                <p class="text-xs font-bold text-slate-400 mt-0.5">บลจ. {{ insightModal.fund.amcFull || insightModal.fund.amc }}</p>
              </div>
            </div>
            <button 
              type="button" 
              @click="closeInsightModal" 
              class="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center font-bold text-sm transition cursor-pointer shrink-0"
              aria-label="ปิดหน้าต่าง"
            >
              ✕
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-5 sm:p-6 overflow-y-auto space-y-6">
            
            <!-- 4 Key Metrics Bar -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-750">
                <span class="text-xs text-slate-400 font-semibold block mb-1">NAV ล่าสุด</span>
                <div class="text-lg sm:text-xl font-black text-slate-900 dark:text-white num">฿{{ Number(insightModal.fund.nav || 0).toFixed(4) }}</div>
                <span class="text-xs font-bold inline-block mt-0.5" :class="insightModal.fund.chg1d >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                  {{ insightModal.fund.chg1d >= 0 ? '+' : '' }}{{ Number(insightModal.fund.chg1d || 0).toFixed(2) }}% (1D)
                </span>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-750">
                <span class="text-xs text-slate-400 font-semibold block mb-1">ผลตอบแทน 1Y</span>
                <div class="text-lg sm:text-xl font-black num" :class="insightModal.fund.perf >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                  {{ insightModal.fund.perf >= 0 ? '+' : '' }}{{ Number(insightModal.fund.perf || 0).toFixed(2) }}%
                </div>
                <span class="text-xs text-slate-400 font-semibold inline-block mt-0.5">3Y: {{ insightModal.fund.ret3y != null ? insightModal.fund.ret3y + '%' : '—' }}</span>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-750">
                <span class="text-xs text-slate-400 font-semibold block mb-1">ขนาดกองทุน (AUM)</span>
                <div class="text-lg sm:text-xl font-black text-slate-900 dark:text-white num">฿{{ formatCompact(insightModal.fund.aum) }}</div>
                <span class="text-xs text-slate-400 font-semibold inline-block mt-0.5">ล้านบาท</span>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 border border-slate-200/60 dark:border-slate-750">
                <span class="text-xs text-slate-400 font-semibold block mb-1">ผลตอบแทน 1M</span>
                <div class="text-lg sm:text-xl font-black num" :class="insightModal.fund.ret1m >= 0 ? 'text-emerald-600' : 'text-rose-500'">
                  {{ insightModal.fund.ret1m >= 0 ? '+' : '' }}{{ Number(insightModal.fund.ret1m || 0).toFixed(2) }}%
                </div>
                <span class="text-xs text-slate-400 font-semibold inline-block mt-0.5">ระยะสั้น</span>
              </div>
            </div>

            <!-- Top 5 Holdings with Pie Chart Breakdown -->
            <div class="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-200/70 dark:border-slate-750">
              <h4 class="font-black text-sm sm:text-base text-slate-900 dark:text-white mb-4 flex items-center justify-between">
                <span>🥧 สัดส่วนสินทรัพย์ที่ลงทุนสูงสุด (Top 5 Holdings)</span>
                <span class="text-xs text-slate-400 font-bold">สัดส่วน % พอร์ต</span>
              </h4>
              
              <div class="flex flex-col sm:flex-row items-center gap-6">
                <!-- Doughnut Canvas Chart -->
                <div class="w-36 h-36 shrink-0 relative flex items-center justify-center p-2 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
                  <canvas id="insightPieCanvas" width="140" height="140"></canvas>
                </div>
                
                <!-- Holdings breakdown list -->
                <div class="flex-1 w-full divide-y divide-slate-200/70 dark:divide-slate-700 bg-white dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                  <div 
                    v-for="(h, j) in getFundHoldings(insightModal.fund)" 
                    :key="j"
                    class="flex items-center justify-between py-2 text-sm gap-3"
                  >
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span class="w-3.5 h-3.5 rounded-sm shrink-0 shadow-2xs" :style="{ background: PIE_COLORS[j % PIE_COLORS.length] }"></span>
                      <strong class="font-bold text-slate-800 dark:text-slate-100 truncate text-sm" :title="Array.isArray(h) ? h[0] : (h.symbol || h.name)">
                        {{ Array.isArray(h) ? h[0] : (h.symbol || h.name) }}
                      </strong>
                    </div>
                    <span class="font-black text-slate-900 dark:text-white num shrink-0 text-sm tabular-nums text-right ml-auto">
                      {{ Number(Array.isArray(h) ? h[1] : (h.percent || 0)).toFixed(2) }}%
                    </span>
                  </div>
                  <div v-if="!getFundHoldings(insightModal.fund).length" class="py-4 text-center text-sm text-slate-400">
                    ไม่มีข้อมูลสัดส่วนสินทรัพย์รายตัว
                  </div>
                </div>
              </div>
            </div>

            <!-- Modal Action Buttons -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button 
                type="button" 
                @click="toggleCompare(insightModal.fund.id)"
                class="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                :class="isFundSelected(insightModal.fund.id) ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900' : 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300 border border-brand-200 dark:border-brand-900 hover:bg-brand-100'"
              >
                <span>{{ isFundSelected(insightModal.fund.id) ? '✓ อยู่ในตารางเปรียบเทียบ (คลิกเพื่อยกเลิก)' : '+ เพิ่มเข้าตารางเปรียบเทียบ' }}</span>
              </button>

              <RouterLink 
                :to="{ name: 'fundinfo-detail', params: { id: insightModal.fund.id } }" 
                class="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-sm bg-brand-600 hover:bg-brand-700 text-white transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>เปิดหน้ารายละเอียดฉบับเต็ม</span>
                <span>↗</span>
              </RouterLink>
            </div>

          </div>

        </div>
      </div>
    </Transition>

    <!-- ── Floating Compare Bar (เมื่อมีกองทุนถูกเลือกเปรียบเทียบ) ── -->
    <Transition name="fade">
      <div 
        v-if="selectedForCompare.length > 0" 
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 max-w-3xl w-[92vw] sm:w-auto transition-all"
      >
        <div class="flex items-center gap-2.5">
          <span class="text-2xl">⚖️</span>
          <div>
            <div class="font-black text-sm">เปรียบเทียบกองทุน</div>
            <div class="text-[11px] text-slate-300 font-medium">เลือกแล้ว {{ selectedForCompare.length }}/4 กองทุน</div>
          </div>
        </div>

        <!-- Selected Pills -->
        <div class="hidden sm:flex items-center gap-1.5 max-w-xs overflow-x-auto no-scrollbar">
          <span 
            v-for="id in selectedForCompare" 
            :key="id"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-brand-300 border border-slate-700 text-xs font-bold whitespace-nowrap"
          >
            <span>{{ id }}</span>
            <button type="button" @click="toggleCompare(id)" class="text-slate-400 hover:text-white font-black ml-0.5 cursor-pointer">×</button>
          </span>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 ml-auto sm:ml-2">
          <button 
            type="button"
            @click="openInlineCompare"
            class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-black shadow-md transition cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <span>📊</span>
            <span>ดูการเปรียบเทียบ &amp; กราฟ</span>
          </button>
          <button 
            type="button"
            @click="clearCompare"
            class="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/80 text-slate-300 hover:text-rose-200 text-xs font-bold transition cursor-pointer"
            title="ล้างที่เลือกทั้งหมด"
          >
            ล้าง
          </button>
        </div>
      </div>
    </Transition>

    <!-- ── 7. Floating Back-to-Top Button ──────────────────────────────────── -->
    <button
      v-if="showBackToTop"
      class="fi-back-to-top"
      title="กลับขึ้นด้านบน"
      @click="scrollToTop"
    >
      ▲
    </button>

  </main>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════
   Page Shell
═══════════════════════════════════════════════════════════ */
.fi-page {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 16px 20px 48px;
  display: flex;
  flex-direction: column;
  gap: 20px;
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
.fi-alloc__viewall {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #2563eb;
  text-decoration: none;
}
.fi-alloc__viewall:hover { text-decoration: underline; }

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
  cursor: pointer;
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
.fi-alloc__card--clickable {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.fi-alloc__card--clickable:hover {
  transform: translateY(-1px);
  border-color: #cbd5e1;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
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
.fi-tr--expanded td { background: #f0f9ff !important; border-bottom: none; }

/* ── Inline Expand Row (ตรง WordPress .fd-exp / .fd-exp-inner) ── */
.fi-tr-expand td { padding: 0; border-bottom: 2px solid #e8edf2; }
.fi-exp-cell { padding: 16px 24px !important; background: #f9fafb; }
.fi-exp-inner {
  display: flex;
  align-items: flex-start;   /* WordPress ใช้ flex-start */
  gap: 24px;                 /* WordPress gap: 24px */
}
.fi-exp-pie-wrap {
  text-align: center;
  width: 120px;
  flex-shrink: 0;
}
.fi-exp-pie-label {
  font-size: 12px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 8px;
}
.fi-exp-list { flex: 1; }   /* WordPress .fd-exp-leg { flex:1 } */
.fi-exp-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 15px;           /* WordPress font-size: 15px */
  align-items: center;
}
.fi-exp-row:last-child { border-bottom: none; }
.fi-exp-row-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fi-exp-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  display: inline-block;
  flex-shrink: 0;
}
.fi-exp-sym {
  color: #0f172a;
  font-weight: 700;
  font-size: 14px;           /* WordPress font-size: 14px */
}
.fi-exp-name {
  color: #6b7280;
  font-size: 11px;
}
.fi-exp-pct { font-weight: 700; color: #0f172a; font-size: 15px; }
.fi-exp-empty { color: #94a3b8; font-size: 13px; }

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

/* ── New UI Styles for Enhancements ───────────────────────────────────────── */
.fi-th--xs {
  width: 32px;
  text-align: center;
}

.fi-btn--fav-active {
  background: #fef9c3 !important;
  color: #ca8a04 !important;
  border-color: #fde047 !important;
}

.fi-star-btn {
  background: transparent;
  border: 0;
  font-size: 16px;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.15s, transform 0.15s;
}
.fi-star-btn:hover {
  transform: scale(1.2);
  color: #f59e0b;
}
.fi-star-btn--active {
  color: #f59e0b;
}

/* Floating Back-to-Top Button */
.fi-back-to-top {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  border: 0;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);
  transition: transform 0.2s, background 0.2s;
  z-index: 980;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fi-back-to-top:hover {
  transform: translateY(-4px);
  background: #1d4ed8;
}

/* Fade transition for floating compare bar */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}
</style>
