import { computed, reactive } from 'vue'
import {
  fundsByType,
  FUND_TYPES,
  STOCK_META,
  THAI_INDUSTRY_GROUPS,
  OFFSHORE_REGION_GROUPS,
  OFFSHORE_THEME_GROUPS,
} from '../data/fundinfoData'
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

export function useFundinfoExposureTrend(type = 'offshore') {
  const funds = fundsByType(type).filter(isDirectEquityFund)
  const bench = BENCHMARKS[type] || BENCHMARKS.offshore
  const accent = FUND_TYPES[type]?.accent || '#2456d8'
  const foreign = type === 'offshore'

  const state = reactive({
    scopeMode: 'region',
    selected: [], // scope ids ที่เลือกไว้เปรียบเทียบบนกราฟ (สูงสุด 5 หมวด)
  })

  const allScopes = computed(() => computeScopes(funds, type, state.scopeMode))
  const scopes = computed(() => allScopes.value.filter((s) => s.hasData))
  const unavailable = computed(() => allScopes.value.filter((s) => !s.hasData))
  const maxExposure = computed(() => Math.max(...scopes.value.map((s) => s.exposure), 1))

  const stockEntities = computed(() => buildStockEntities(funds))
  const mostHeld = computed(
    () => [...stockEntities.value].sort((a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight)[0],
  )
  const topExposure = computed(() => [...scopes.value].sort((a, b) => b.exposure - a.exposure)[0])
  const leaderPerf = computed(() => [...scopes.value].sort((a, b) => b.perf - a.perf)[0])
  const outperformCount = computed(() => scopes.value.filter((s) => s.perf > bench.ret).length)

  // ตัดรายการที่เลือกไว้ทิ้งอัตโนมัติเมื่อสลับโหมด region/theme แล้ว scope id ชุดเปลี่ยน
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

  function setScopeMode(mode) {
    state.scopeMode = mode
    state.selected = []
  }

  // Start with a compact, useful comparison just like the reference workspace.
  // Users can add/remove scopes or clear them at any time.
  state.selected = scopes.value.slice(0, 2).map((scope) => scope.id)

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
