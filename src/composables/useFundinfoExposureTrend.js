// useFundinfoExposureTrend.js
import { computed, reactive, watch } from 'vue'
import {
  FUND_TYPES,
  STOCK_META,
  THAI_INDUSTRY_GROUPS,
  OFFSHORE_REGION_GROUPS,
  OFFSHORE_THEME_GROUPS,
} from '../data/fundinfoData'
import { useFundinfoStore } from '../stores/fundinfoStore'
import { performanceSeries, CMP_LABELS } from './useFundinfoThemeTrend'

// ==========================================================================
// Section ① Region / Industry Exposure — "Stock Exposure" (Offshore & Thai)
// Ported from computeScopes() (isStockTab branch) + buildStockEntities() +
// renderStockExposure() in the fundinfo v3.2.1 HTML prototype. Unlike the
// Feeder "Theme Pulse" cards, these scopes are built from Top Holdings stock
// weights (STOCK_META), not from fund-level performance — so cards show an
// exposure proportion bar instead of a 1Y sparkline.
// ==========================================================================

const MAX_SELECTED = 5

const BENCHMARKS = {
  thai: { name: 'SET TRI', ret: 3.2, short: 'SET' },
  offshore: { name: 'MSCI ACWI', ret: 12.8, short: 'Global' },
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

function isDirectEquityFund(fund) {
  return (fund.top5 || []).some((h) => STOCK_META[h.name])
}

function seedFromId(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 71)
}

// ใช้ perf ของ scope (ผลตอบแทนถ่วงน้ำหนักของหุ้นในหมวด) เป็นจุดปลายทางของกราฟจำลอง เหมือนต้นแบบ
export function trendSeries(scope) {
  return performanceSeries(seedFromId(scope.id), scope.perf ?? 0, CMP_LABELS.length)
}

function taxonomyFor(type, scopeMode) {
  if (type === 'thai') return THAI_INDUSTRY_GROUPS
  return scopeMode === 'theme' ? OFFSHORE_THEME_GROUPS : OFFSHORE_REGION_GROUPS
}

// รวมน้ำหนักหุ้น (exposure) และผลตอบแทนถ่วงน้ำหนักของหุ้นในแต่ละหมวด taxonomy
function computeScopes(funds, type, scopeMode) {
  const defs = taxonomyFor(type, scopeMode)

  return defs.map((def, idx) => {
    let members = []
    let stockNames = []

    if (def.fundIds) {
      members = funds.filter((f) => def.fundIds.includes(f.id))
      stockNames = [
        ...new Set(members.flatMap((f) => (f.top5 || []).map((h) => h.name)).filter((name) => STOCK_META[name])),
      ]
    } else {
      const wanted = new Set(def.stocks || [])
      stockNames = [...wanted].filter(
        (name) => STOCK_META[name] && funds.some((f) => (f.top5 || []).some((h) => h.name === name)),
      )
      members = funds.filter((f) => (f.top5 || []).some((h) => wanted.has(h.name)))
    }

    const memberIds = new Set(members.map((f) => f.id))
    let exposure = 0
    let weightedReturn = 0
    funds.forEach((f) => {
      ;(f.top5 || []).forEach((h) => {
        if (!STOCK_META[h.name] || !stockNames.includes(h.name)) return
        if (def.fundIds && !memberIds.has(f.id)) return
        exposure += h.percent
        weightedReturn += h.percent * STOCK_META[h.name].ret
      })
    })

    const hasData = exposure > 0
    return {
      id: def.id,
      title: def.title,
      subtitle: def.subtitle,
      idx,
      members,
      stocks: stockNames,
      stockCount: stockNames.length,
      exposure: +exposure.toFixed(1),
      perf: hasData ? +(weightedReturn / exposure).toFixed(1) : null,
      hasData,
    }
  })
}

// หุ้นทุกตัวที่พบใน Top Holdings ของกองทุนกลุ่มนี้ (ไม่กรองตาม scope) — ใช้หา "หุ้นที่หลายกองถือร่วมกัน"
function buildStockEntities(funds) {
  const g = {}
  funds.forEach((f) => {
    ;(f.top5 || []).forEach((h) => {
      const meta = STOCK_META[h.name]
      if (!meta) return
      const x = g[h.name] || (g[h.name] = { name: h.name, ticker: meta.ticker, membersMap: new Map(), totalWeight: 0 })
      x.membersMap.set(f.id, f)
      x.totalWeight += h.percent
    })
  })
  return Object.values(g).map((x) => ({
    name: x.name,
    ticker: x.ticker,
    fundCount: x.membersMap.size,
    totalWeight: +x.totalWeight.toFixed(1),
  }))
}

// ---- Offshore-only persistence ----
// offshore ต้อง auto-select scope ตอนเข้าครั้งแรก และห้ามหายเมื่อสลับหน้าไปมา "หรือสลับมุมมอง region/theme"
// เก็บ selection แยกตามโหมด (region / theme) เพื่อไม่ให้การสลับมุมมองไปมาล้างของอีกฝั่งทิ้ง
// thai ใช้ reactive() สดใหม่ทุกครั้งเหมือนเดิม (ของเดิมทำงานถูกต้องอยู่แล้ว ไม่แตะ)
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
  // Store-backed (fundinfoStore.js -> fundinfoApi.js): reads local mock data
  // today, will read the real backend once VITE_FUNDINFO_API_MODE flips.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const funds = computed(() => fundinfoStore.getFundsByType(type).filter(isDirectEquityFund))

  const bench = BENCHMARKS[type] || BENCHMARKS.offshore
  const accent = FUND_TYPES[type]?.accent || '#2456d8'
  const foreign = type === 'offshore'

  // offshore: ใช้ state ที่ persist ข้ามหน้า / thai (และอื่นๆ): reactive สดใหม่เหมือนของเดิม
  const state = foreign ? getOffshoreState() : reactive({ scopeMode: 'region', selected: [] })

  const allScopes = computed(() => computeScopes(funds.value, type, state.scopeMode))
  const scopes = computed(() => allScopes.value.filter((s) => s.hasData))
  const unavailable = computed(() => allScopes.value.filter((s) => !s.hasData))
  const maxExposure = computed(() => Math.max(...scopes.value.map((s) => s.exposure), 1))

  const stockEntities = computed(() => buildStockEntities(funds.value))
  const mostHeld = computed(
    () => [...stockEntities.value].sort((a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight)[0],
  )
  const topExposure = computed(() => [...scopes.value].sort((a, b) => b.exposure - a.exposure)[0])
  const leaderPerf = computed(() => [...scopes.value].sort((a, b) => b.perf - a.perf)[0])
  const outperformCount = computed(() => scopes.value.filter((s) => s.perf > bench.ret).length)

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

  // offshore: sync state.selected กลับเข้า selectedByMode[scopeMode ปัจจุบัน] แล้ว persist ลง sessionStorage "ทันทีแบบ synchronous"
  // (ไม่ใช้ watch แบบ async) กันกรณีผู้ใช้กด toggle/สลับมุมมองแล้วเปลี่ยนหน้าทันที ก่อนที่ watcher จะทำงานทัน
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
      const targetScopes = computeScopes(funds.value, type, mode).filter((s) => s.hasData)
      const validIds = new Set(targetScopes.map((s) => s.id))
      const restored = (state.selectedByMode[mode] || []).filter((id) => validIds.has(id))
      state.selected = restored.length ? restored : targetScopes.slice(0, MAX_SELECTED).map((s) => s.id)
      syncOffshore()
    } else {
      state.scopeMode = mode
      state.selected = []
    }
  }

  // Store-backed funds resolve asynchronously (even under mock mode, one
  // microtask tick), so `scopes` is empty on the very first synchronous
  // evaluation — this seeding must wait for real data instead of running
  // once at setup time. `seeded` gates it to fire exactly once per composable
  // call (i.e. once per component mount), matching the original behavior.
  let seeded = false
  watch(
    scopes,
    (value) => {
      if (seeded || !value.length) return
      seeded = true

      if (foreign) {
        if (!state.initialized) {
          // ยังไม่เคยมี state ค้างอยู่เลย (ไม่มี cache/sessionStorage) — ตั้งค่าเริ่มต้นแค่ครั้งแรก
          state.selected = value.slice(0, MAX_SELECTED).map((scope) => scope.id)
          state.initialized = true
        } else {
          // มี state เดิมค้างอยู่แล้ว (จาก cache ในหน่วยความจำ หรือกู้จาก sessionStorage) — คงรายการที่เลือกไว้เดิม
          // กันไว้เฉพาะกรณี scope id เดิมหายไปจากชุดข้อมูลปัจจุบัน ไม่ให้ chip ค้างเลือกทั้งที่ไม่มีในลิสต์
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
  }
}