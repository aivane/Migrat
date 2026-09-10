// useFundinfoExposureTrend.js
import { computed, reactive, watch } from 'vue'
import {
  FUND_TYPES,
  STOCK_META,
  THAI_INDUSTRY_GROUPS,
  OFFSHORE_REGION_GROUPS,
  OFFSHORE_THEME_GROUPS,
} from '../data/fundinfoConstants'
import { useFundinfoStore } from '../stores/fundinfoStore'
import { membersTrendSeries, CMP_LABELS } from './useFundinfoThemeTrend'

// ==========================================================================
// Section ① Region / Industry Exposure — "Stock Exposure" (Offshore & Thai)
// Unlike Feeder "Theme Pulse" cards, these scopes are built from Top Holdings
// stock weights (STOCK_META), not fund-level performance — cards show an
// exposure bar instead of a 1Y sparkline.
// ==========================================================================

// Matches Feeder/Ranking Card compare caps (useFundinfoThemeTrend.js /
// useFundinfoRanking.js) — no reason to cap Offshore/Thai 2 lower.
const MAX_SELECTED = 7

// ret: null — no live market-index return field exists, see
// [[project-fundinfo-known-gaps]]. name/short document the intended
// comparison index; outperformCount below returns null, not a fabricated count.
const BENCHMARKS = {
  thai: { name: 'SET TRI', ret: null, short: 'SET' },
  offshore: { name: 'MSCI ACWI', ret: null, short: 'Global' },
}

// ไอคอนต่อหมวด (ครอบคลุมเฉพาะหมวดที่ใช้จริงใน THAI_INDUSTRY_GROUPS / OFFSHORE_REGION_GROUPS / OFFSHORE_THEME_GROUPS)
const HOLDING_ICON = {
  // Thai SET industry groups
  'เกษตรและอุตสาหกรรมอาหาร': '🌾',
  'สินค้าอุปโภคบริโภค': '🛍️',
  'ธุรกิจการเงิน': '🏦',
  'สินค้าอุตสาหกรรม': '🏭',
  'อสังหาริมทรัพย์และก่อสร้าง': '🏗️',
  'ทรัพยากร': '⚡',
  'บริการ': '🧩',
  'เทคโนโลยี': '💻',
  // Offshore region groups
  'หุ้นโลก': '🌐',
  'หุ้นสหรัฐฯ': '🇺🇸',
  'หุ้นจีน': '🇨🇳',
  'หุ้นเวียดนาม': '🇻🇳',
  'หุ้นอินเดีย': '🇮🇳',
  'หุ้นญี่ปุ่น': '🇯🇵',
  'หุ้นยุโรป': '🇪🇺',
  'หุ้นเกาหลี': '🇰🇷',
  'ตลาดเกิดใหม่': '🌍',
  // Offshore theme groups
  'เทคโนโลยีภาพรวม': '💻',
  'ปัญญาประดิษฐ์และหุ่นยนต์': '🤖',
  'เซมิคอนดักเตอร์': '🔌',
  'นวัตกรรมสุขภาพ': '🧬',
  'พลังงานสะอาดและรถยนต์ไฟฟ้า': '⚡',
  'สินค้าแบรนด์เนมและสินค้าฟุ่มเฟือย': '💎',
  'ความปลอดภัยทางไซเบอร์': '🛡️',
  'โครงสร้างพื้นฐานทั่วโลก': '🏗️',
  'อสังหาริมทรัพย์ทั่วโลก': '🏢',
}

export function holdingIcon(title) {
  return HOLDING_ICON[title] || '◼'
}

// Real checkpoint returns averaged across member funds (see
// useFundinfoThemeTrend.js); falls back to a flat 0% line only if none have data.
export function trendSeries(scope) {
  return membersTrendSeries(scope.members, CMP_LABELS.length) || new Array(CMP_LABELS.length).fill(100)
}

function taxonomyFor(type, scopeMode) {
  if (type === 'thai') return THAI_INDUSTRY_GROUPS
  return scopeMode === 'theme' ? OFFSHORE_THEME_GROUPS : OFFSHORE_REGION_GROUPS
}

// ---- Offshore-only persistence ----
// Offshore auto-selects on first entry and persists across navigation and
// region/theme switches (kept separately per mode); thai stays fresh reactive() each time.
const OFFSHORE_STORAGE_KEY = 'fundinfo:exposureTrend:offshore'
let offshoreStateCache = null

function readOffshorePersisted() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(OFFSHORE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

function persistOffshoreState(state) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(
      OFFSHORE_STORAGE_KEY,
      JSON.stringify({ scopeMode: state.scopeMode, selectedByMode: state.selectedByMode }),
    )
  } catch (e) {
    // private mode / quota — เงียบไว้ ไม่กระทบการใช้งาน
  }
}

function getOffshoreState() {
  if (!offshoreStateCache) {
    const saved = readOffshorePersisted()
    const savedByMode = saved?.selectedByMode || {}
    offshoreStateCache = reactive({
      scopeMode: saved?.scopeMode || 'region',
      selectedByMode: {
        region: savedByMode.region || [],
        theme: savedByMode.theme || [],
      },
      selected: [],
      initialized: !!saved,
    })
    // sync selected ให้ตรงกับโหมดปัจจุบันตั้งแต่สร้าง state
    offshoreStateCache.selected = offshoreStateCache.selectedByMode[offshoreStateCache.scopeMode].slice()
  }
  return offshoreStateCache
}

export function useFundinfoExposureTrend(type = 'offshore') {
  // Store-backed (fundinfoStore.js -> fundinfoApi.js): reads the real backend.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const allFunds = computed(() => fundinfoStore.getFundsByType(type))
  const stockMarket = type === 'thai' ? 'TH' : 'FOREIGN'

  fundinfoStore.loadTopStocksByMarket(stockMarket)
  fundinfoStore.loadPortfolioAllocation({ marketType: stockMarket })

  const apiStocks = computed(() => fundinfoStore.getTopStocksByMarket(stockMarket))
  const portfolioAllocation = computed(() => fundinfoStore.getPortfolioAllocation({ marketType: stockMarket }))
  // Previously fell back to a STOCK_META-only mock path when apiStocks was empty,
  // fabricating exposure numbers instead of showing "no data" — that path is gone;
  // stocksLoading/stocksError below now surface load state honestly instead.
  const stocksLoading = computed(() => fundinfoStore.isLoading(`stocks:${stockMarket}`))
  const stocksError = computed(() => fundinfoStore.getError(`stocks:${stockMarket}`))
  function retryStocks() {
    fundinfoStore.loadTopStocksByMarket(stockMarket, { force: true })
    fundinfoStore.loadPortfolioAllocation({ marketType: stockMarket }, { force: true })
  }

  const bench = BENCHMARKS[type] || BENCHMARKS.offshore
  const accent = FUND_TYPES[type]?.accent || '#2456d8'
  const foreign = type === 'offshore'

  // offshore: ใช้ state ที่ persist ข้ามหน้า / thai (และอื่นๆ): reactive สดใหม่เหมือนของเดิม
  const state = foreign ? getOffshoreState() : reactive({ scopeMode: 'region', selected: [] })

  function scopesFor(scopeMode) {
    return computeApiScopes(allFunds.value, apiStocks.value, portfolioAllocation.value, type, scopeMode)
  }

  const allScopes = computed(() => scopesFor(state.scopeMode))
  const scopes = computed(() => allScopes.value.filter((s) => s.hasData))
  const unavailable = computed(() => allScopes.value.filter((s) => !s.hasData))
  const maxExposure = computed(() => Math.max(...scopes.value.map((s) => s.exposure), 1))

  const stockEntities = computed(() => buildApiStockEntities(apiStocks.value))
  const mostHeld = computed(
    () => [...stockEntities.value].sort((a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight)[0],
  )
  const topExposure = computed(() => [...scopes.value].sort((a, b) => b.exposure - a.exposure)[0])
  const leaderPerf = computed(() => [...scopes.value].sort((a, b) => b.perf - a.perf)[0])
  const outperformCount = computed(() => (bench.ret === null ? null : scopes.value.filter((s) => s.perf > bench.ret).length))

  const selectedStats = computed(() =>
    state.selected.map((id) => scopes.value.find((s) => s.id === id)).filter(Boolean),
  )

  const label = computed(() => {
    if (type === 'thai') return 'กลุ่มอุตสาหกรรม SET'
    return state.scopeMode === 'theme' ? 'เมกะเทรนด์และอุตสาหกรรม' : 'ภูมิภาคและประเทศ'
  })

  const method = computed(() =>
    foreign && state.scopeMode === 'region'
      ? 'จัดกลุ่มกองทุนตามนโยบายภูมิภาค/ประเทศ แล้วคำนวณจากหุ้นหลักของกองทุนในหมวดนั้น'
      : 'จัดหุ้นใน Top Holdings เข้าหมวดตาม taxonomy ที่เลือก แล้วคำนวณผลตอบแทนถ่วงน้ำหนัก',
  )

  const example = computed(() =>
    topExposure.value
      ? `ตัวอย่าง: ${topExposure.value.title} มีน้ำหนักหุ้นรวม ${topExposure.value.exposure.toFixed(1)}% จากหุ้นหลักของ ${topExposure.value.members.length} กองทุน`
      : 'นำเปอร์เซ็นต์หุ้นมารวมกัน',
  )

  // Offshore: sync state.selected into selectedByMode and persist synchronously
  // (not via async watch) so a toggle right before navigating isn't lost.
  function syncOffshore() {
    if (!foreign) return
    state.selectedByMode[state.scopeMode] = state.selected.slice()
    persistOffshoreState(state)
  }

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
    syncOffshore()
  }

  function clear() {
    state.selected = []
    syncOffshore()
  }

  function setScopeMode(mode) {
    if (mode === state.scopeMode) return
    if (foreign) {
      // เก็บรายการที่เลือกไว้ของโหมดปัจจุบันก่อนสลับ (ไม่ล้างทิ้ง) แล้วดึงรายการของโหมดใหม่กลับมา
      state.selectedByMode[state.scopeMode] = state.selected.slice()
      state.scopeMode = mode
      const targetScopes = scopesFor(mode).filter((s) => s.hasData)
      const validIds = new Set(targetScopes.map((s) => s.id))
      const restored = (state.selectedByMode[mode] || []).filter((id) => validIds.has(id))
      state.selected = restored.length ? restored : targetScopes.slice(0, MAX_SELECTED).map((s) => s.id)
      syncOffshore()
    } else {
      state.scopeMode = mode
      state.selected = []
    }
  }

  // Store-backed funds resolve asynchronously, so `scopes` is empty on the first
  // sync evaluation — seeding must wait for real data. `seeded` gates it to fire
  // once per composable call (once per component mount).
  let seeded = false
  watch(
    scopes,
    (value) => {
      if (seeded || !value.length) return
      seeded = true

      if (foreign) {
        if (!state.initialized) {
          // No prior state (no cache/sessionStorage) — set the initial default once.
          state.selected = value.slice(0, MAX_SELECTED).map((scope) => scope.id)
          state.initialized = true
        } else {
          // Existing state — keep prior selection, dropping ids no longer present.
          const validIds = new Set(value.map((s) => s.id))
          state.selected = state.selected.filter((id) => validIds.has(id))
        }
        syncOffshore()
      } else {
        // thai: คงพฤติกรรมเดิมทุกอย่าง (เลือก 2 อันดับแรกให้เป็นตัวอย่าง, รีเซ็ตทุกครั้งที่ mount)
        state.selected = value.slice(0, 2).map((scope) => scope.id)
      }
    },
    { immediate: true },
  )

  return {
    foreign,
    accent,
    bench,
    label,
    method,
    example,
    state,
    scopes,
    unavailable,
    maxExposure,
    mostHeld,
    topExposure,
    leaderPerf,
    outperformCount,
    selectedStats,
    maxSelected: MAX_SELECTED,
    orderOf,
    toggle,
    clear,
    setScopeMode,
    stocksLoading,
    stocksError,
    retryStocks,
  }
}

const THAI_SCOPE_BY_TICKER = Object.freeze({
  KBANK: 'FINCIAL', KTB: 'FINCIAL', TISCO: 'FINCIAL', BBL: 'FINCIAL', SCB: 'FINCIAL', TTB: 'FINCIAL', BAY: 'FINCIAL',
  DELTA: 'TECH', ADVANC: 'TECH', INTUCH: 'TECH', TRUE: 'TECH',
  GULF: 'RESOURC', PTT: 'RESOURC', PTTEP: 'RESOURC', TOP: 'RESOURC', BCP: 'RESOURC',
  AOT: 'SERVICE', CPALL: 'SERVICE', BJC: 'SERVICE', COM7: 'SERVICE', BCH: 'SERVICE', SPA: 'SERVICE',
  TPIPL: 'INDUS',
  AMATA: 'PROP',
})

const THAI_SCOPE_BY_SECTOR = Object.freeze({
  'การเงิน': 'FINCIAL',
  'พลังงานและสาธารณูปโภค': 'RESOURC',
  'เทคโนโลยีและสื่อสาร': 'TECH',
  'อิเล็กทรอนิกส์': 'TECH',
  'ขนส่งและท่องเที่ยว': 'SERVICE',
  'พาณิชย์': 'SERVICE',
  'การแพทย์': 'SERVICE',
  'นิคมอุตสาหกรรม': 'PROP',
})

const OFFSHORE_SCOPE_RULES = Object.freeze({
  REG_GLOBAL: /global|world|international|multi[ -]?country/i,
  REG_US: /(?:^|\W)(?:us|u\.?s\.?|united states|america|american)(?:$|\W)/i,
  REG_CHINA: /china|hong kong|greater china/i,
  REG_VIETNAM: /vietnam/i,
  REG_INDIA: /india/i,
  REG_JAPAN: /japan/i,
  REG_EUROPE: /europe|eurozone|european/i,
  REG_KOREA: /korea/i,
  REG_EM: /emerging|asean|asia ex[ -]?japan|latin america|frontier/i,
  MEGA_TECH: /technology|tech|digital|internet|software|communication/i,
  MEGA_AI: /artificial intelligence|(?:^|\W)ai(?:$|\W)|robot|automation/i,
  MEGA_SEMI: /semiconductor|chip/i,
  MEGA_HEALTH: /health|biotech|medical|pharma/i,
  MEGA_CLEANEV: /clean energy|renewable|electric vehicle|(?:^|\W)ev(?:$|\W)|climate/i,
  MEGA_LUXURY: /luxury|consumer discretionary|brand/i,
  MEGA_CYBER: /cyber/i,
  MEGA_INFRA: /infrastructure/i,
  MEGA_REIT: /(?:^|\W)reit(?:$|\W)|real estate|property/i,
})

const OFFSHORE_SCOPE_BY_TICKER = Object.freeze({
  MSFT: ['MEGA_TECH', 'MEGA_AI'], META: ['MEGA_TECH', 'MEGA_AI'], NVDA: ['MEGA_TECH', 'MEGA_AI', 'MEGA_SEMI'],
  TSM: ['MEGA_TECH', 'MEGA_SEMI'], TSMC: ['MEGA_TECH', 'MEGA_SEMI'], AVGO: ['MEGA_TECH', 'MEGA_SEMI'],
  LLY: ['MEGA_HEALTH'], UNH: ['MEGA_HEALTH'], NVO: ['MEGA_HEALTH'], JNJ: ['MEGA_HEALTH'], ABBV: ['MEGA_HEALTH'],
  CATL: ['MEGA_CLEANEV'], BYD: ['MEGA_CLEANEV'],
  MC: ['MEGA_LUXURY'],
  'MBB.VN': ['REG_VIETNAM'], 'ACB.VN': ['REG_VIETNAM'], 'MWG11': ['REG_VIETNAM'],
  '9988N.MX': ['REG_CHINA'],
})

const STOCK_META_BY_TICKER = Object.freeze(
  Object.values(STOCK_META).reduce((byTicker, meta) => {
    byTicker[meta.ticker] = meta
    return byTicker
  }, {}),
)

const THAI_ALLOCATION_MATCHERS = Object.freeze({
  FINCIAL: /การเงิน/i,
  INDUS: /อุตสาหกรรม|วัสดุ/i,
  PROP: /อสังหาริมทรัพย์/i,
  RESOURC: /พลังงาน|อรรถประโยชน์|สาธารณูปโภค/i,
  SERVICE: /สินค้า|การแพทย์/i,
  TECH: /เทคโนโลยี|สื่อสาร/i,
})

const OFFSHORE_REGION_ALLOCATION_MATCHERS = Object.freeze({
  REG_GLOBAL: /developed country/i,
  REG_US: /united states/i,
  REG_CHINA: /china|hong kong/i,
  REG_VIETNAM: /vietnam/i,
  REG_INDIA: /india/i,
  REG_JAPAN: /^japan$/i,
  REG_EUROPE: /eurozone|europe/i,
  REG_KOREA: /korea/i,
  REG_EM: /^emerging market$/i,
})

function allocationExposureForScope(allocation, type, scopeMode, scopeId) {
  if (!allocation.length || (type === 'offshore' && scopeMode !== 'region')) return null

  const matcher = type === 'thai'
    ? THAI_ALLOCATION_MATCHERS[scopeId]
    : OFFSHORE_REGION_ALLOCATION_MATCHERS[scopeId]
  if (!matcher) return null

  const allocationType = type === 'thai' ? 'SECTOR' : 'REGIONAL'
  const matches = allocation.filter((item) => (
    item.allocationType === allocationType && matcher.test(item.name)
  ))
  if (!matches.length) return null

  // API Contract — Thai taxonomy sums several sectors; regional labels overlap,
  // so use the largest published weight instead (summing would double-count).
  const value = type === 'thai'
    ? matches.reduce((sum, item) => sum + item.weightedPercent, 0)
    : Math.max(...matches.map((item) => item.weightedPercent))
  return +value.toFixed(1)
}

function averageReturn(funds) {
  if (!funds.length) return null
  return +(funds.reduce((sum, fund) => sum + Number(fund.perf || 0), 0) / funds.length).toFixed(1)
}

function apiStockScopeIds(stock, type, scopeMode) {
  const ticker = String(stock.symbol || '').toUpperCase()
  const stockMeta = STOCK_META_BY_TICKER[ticker]

  if (type === 'thai') {
    const byTicker = THAI_SCOPE_BY_TICKER[ticker]
    if (byTicker) return [byTicker]
    const bySector = stockMeta ? THAI_SCOPE_BY_SECTOR[stockMeta.sector] : null
    return bySector ? [bySector] : []
  }

  const byTicker = OFFSHORE_SCOPE_BY_TICKER[ticker] || []
  if (scopeMode === 'theme') return byTicker.filter((id) => id.startsWith('MEGA_'))
  return byTicker.filter((id) => id.startsWith('REG_'))
}

function fundScopeIds(fund, scopeMode) {
  const scopeText = `${fund.group || ''} ${fund.master || ''} ${fund.name || ''}`
  const prefix = scopeMode === 'theme' ? 'MEGA_' : 'REG_'

  return Object.entries(OFFSHORE_SCOPE_RULES)
    .filter(([id, rule]) => id.startsWith(prefix) && rule.test(scopeText))
    .map(([id]) => id)
}

function matchingStocksForScope(stocks, scopeId, type, scopeMode, memberIds) {
  return stocks.filter((stock) => {
    if (apiStockScopeIds(stock, type, scopeMode).includes(scopeId)) return true
    return (stock.topHoldingFundCodes || []).some((code) => memberIds.has(code))
  })
}

// API Contract — list records carry fund performance, /stocks/top carries
// aggregate holdings; join only via disclosed holder codes, never invent data.
function computeApiScopes(funds, stocks, portfolioAllocation, type, scopeMode) {
  const defs = taxonomyFor(type, scopeMode)
  const totalHoldingValue = stocks.reduce((sum, stock) => sum + Number(stock.totalHoldingValueMThb || 0), 0)

  return defs.map((def, idx) => {
    const categoryMembers = type === 'thai'
      ? []
      : funds.filter((fund) => fundScopeIds(fund, scopeMode).includes(def.id))
    const memberIds = new Set(categoryMembers.map((fund) => fund.id))
    const matchedStocks = matchingStocksForScope(stocks, def.id, type, scopeMode, memberIds)
    const disclosedHolderIds = new Set(matchedStocks.flatMap((stock) => stock.topHoldingFundCodes || []))

    funds.forEach((fund) => {
      if (disclosedHolderIds.has(fund.id)) memberIds.add(fund.id)
    })

    const members = funds.filter((fund) => memberIds.has(fund.id))
    const holdingValue = matchedStocks.reduce((sum, stock) => sum + Number(stock.totalHoldingValueMThb || 0), 0)
    const holdingExposure = totalHoldingValue > 0 ? (holdingValue / totalHoldingValue) * 100 : 0
    const allocationExposure = allocationExposureForScope(portfolioAllocation, type, scopeMode, def.id)

    return {
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      idx,
      members,
      stocks: matchedStocks,
      stockCount: matchedStocks.length,
      // Prefer portfolio-allocation's published weighted allocation; fall back
      // to the top-stock ratio when no matching taxonomy label exists.
      exposure: allocationExposure ?? +holdingExposure.toFixed(1),
      perf: averageReturn(members),
      // Don't show a taxonomy group until the ranking API has a matching holding.
      hasData: members.length > 0 && matchedStocks.length > 0,
    }
  })
}

function buildApiStockEntities(stocks) {
  return stocks.map((stock) => ({
    name: stock.name,
    ticker: stock.symbol,
    fundCount: stock.fundCount,
    // UI expects a percentage; avgHoldingWeight is the only matching API aggregate.
    totalWeight: stock.avgHoldingWeight,
  }))
}
