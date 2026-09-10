import { computed, reactive, watch } from 'vue'
import { FUND_TYPES, STOCK_META } from '../data/fundinfoConstants'
import { useFundinfoStore } from '../stores/fundinfoStore'

// ==========================================================================
// Section ② Ranking Cards. Ported from the fundinfo v3.2.1 HTML prototype
// (computeEntities/rankCard/rankRows/pillSet/renderCards/selectGroup).
//
// Builds a ranked "entity" list per tab — stocks for Offshore/Thai, Master
// Funds (grouped by fund.master) for Feeder, individual funds for Mixed —
// rendered as 3 ranking cards with time-range pills. Clicking a row adds it
// to a comparison group (max 7) for Section 3 (not built yet).
//
// Does not wire the prototype's Section 1 scope/theme narrowing yet (Section
// 1's own table isn't filtered by it either) — ranks across the full tab.
// ==========================================================================

const MAX_SELECTED = 7

function isStockTab(type) {
  return type === 'offshore' || type === 'thai'
}

// /stocks/top publishes return_1m/return_1y/industry/sector plus pe_ratio/
// pb_ratio/dividend_yield/max_drawdown (added after this was first written —
// see mapTopStock in fundinfoApi.js); no market-cap field yet.
function buildApiStockRankEntities(stocks) {
  return stocks.map((stock, idx) => ({
    idx,
    kind: 'stock',
    id: `stock:${stock.marketType}:${stock.symbol}`,
    title: `${stock.symbol} · ${stock.name}`,
    name: stock.name,
    ticker: stock.symbol,
    sector: stock.sector || (stock.marketType === 'TH' ? 'หุ้นไทย' : 'หุ้นต่างประเทศ'),
    industry: stock.industry || '',
    country: stock.marketType === 'TH' ? 'ประเทศไทย' : 'ต่างประเทศ',
    // cap: no market-cap field from the API — stays null, not fabricated.
    meta: { dd: stock.maxDrawdown, pe: stock.peRatio, pb: stock.pbRatio, div: stock.dividendYield, cap: null },
    // retP: same "0-for-missing" convention as fund.retP (retPRaw is null-aware).
    // /stocks/top only has return_1m/return_1y, hence 1M/1Y-only pills below.
    perf: stock.return1y ?? 0,
    retP: { m1: stock.return1m ?? 0, q1: 0, y1: stock.return1y ?? 0 },
    // Null-aware (like fund.retPRaw) so useFundinfoInsight can tell "0%" apart from "no data".
    return1m: stock.return1m,
    return1y: stock.return1y,
    div: stock.dividendYield ?? 0,
    fundCount: stock.fundCount,
    totalHoldingValueMThb: stock.totalHoldingValueMThb,
    avgHoldingWeight: stock.avgHoldingWeight,
    maxHoldingWeight: stock.maxHoldingWeight,
    // Rank Card renders `totalWeight` as a percentage; avgHoldingWeight is the real match.
    totalWeight: stock.avgHoldingWeight,
    dataSource: 'api',
    selectable: true,
  }))
}

// กองทุนไทยที่ถือหุ้นเหล่านี้โดยตรง — ใช้ field ชื่อเดียวกับ stock entity (fundCount/totalWeight/retP)
// เพื่อให้ปะปนใน byFundCount/byTotalWeight/byReturn ได้โดยไม่ต้องแก้ตรรกะเรียง/เลือกที่อื่น
function buildFundHolderEntities(funds) {
  return funds.map((f, idx) => {
    const holdings = (f.top5 || []).filter((h) => STOCK_META[h.name])
    return {
      idx,
      kind: 'holder',
      id: f.id,
      title: `${f.id} · ${f.name}`,
      // ฟิลด์ต่อไปนี้ Section 2 เองไม่ได้ใช้ แต่ Section 3 (เปรียบเทียบ) ต้องใช้ต่อ
      fund: f,
      amc: f.amc,
      country: f.country,
      fee: f.fee,
      risk: f.risk,
      perf: f.perf,
      flowP: f.flowP,
      div: f.div,
      // คู่กับ fundCount ของหุ้น: หุ้นนับ "ถือโดยกี่กองทุน", กองทุนนับ "ถือหุ้นที่ติดตามได้กี่ตัว"
      fundCount: holdings.length,
      // คู่กับ totalWeight ของหุ้น: น้ำหนักรวมของหุ้นที่ติดตามได้ใน Top Holdings ของกองทุนนี้
      totalWeight: +holdings.reduce((sum, h) => sum + h.percent, 0).toFixed(1),
      retP: f.retP,
    }
  })
}

// Master Fund (Feeder) — จัดกลุ่มกองตาม fund.master แล้วรวมเงินไหลเข้า/เฉลี่ยผลตอบแทนของกองในกลุ่ม
function buildMasterFundEntities(funds) {
  const groups = {}
  funds.forEach((f) => {
    ;(groups[f.master] = groups[f.master] || []).push(f)
  })
  const sum = (a) => a.reduce((s, x) => s + x, 0)
  const avg = (a) => +(sum(a) / a.length).toFixed(1)
  // Null-aware: averages only members with a real value, instead of retP's
  // 0-for-missing default silently dragging the group average toward 0.
  const avgRaw = (a) => {
    const finite = a.filter((v) => typeof v === 'number' && Number.isFinite(v))
    return finite.length ? +(sum(finite) / finite.length).toFixed(1) : null
  }
  // plain sum() coerces null to 0, so a group with no real value for this
  // flow period (e.g. flowP.w1, no weekly-flow source) would wrongly show "0".
  const sumNullAware = (a) => {
    const finite = a.filter((v) => typeof v === 'number' && Number.isFinite(v))
    return finite.length ? sum(finite) : null
  }
  return Object.entries(groups).map(([master, members], idx) => {
    const flowP = {}
    const retP = {}
    const retPRaw = {}
    ;['w1', 'm1', 'y1'].forEach((p) => (flowP[p] = sumNullAware(members.map((m) => m.flowP[p]))))
    ;['m1', 'q1', 'y1', 'y3', 'y5'].forEach((p) => (retP[p] = avg(members.map((m) => m.retP[p]))))
    ;['m1', 'q1', 'y1', 'y3', 'y5', 'y10'].forEach((p) => (retPRaw[p] = avgRaw(members.map((m) => m.retPRaw?.[p]))))
    return {
      idx,
      kind: 'master',
      id: master,
      title: master,
      members,
      flowP,
      retP,
      retPRaw,
      perf: avg(members.map((m) => m.perf)),
      div: Math.max(...members.map((m) => m.div)),
    }
  })
}

// กองทุนผสมแต่ละกอง — ใช้เป็น entity โดยตรง ไม่จัดกลุ่ม
function buildMixedFundEntities(funds) {
  return funds.map((f, idx) => ({
    idx,
    kind: 'fund',
    id: f.id,
    title: f.name,
    members: [f],
    flowP: f.flowP,
    retP: f.retP,
    perf: f.perf,
    div: f.div,
  }))
}

function buildEntities(type, allFunds, topStocks) {
  if (isStockTab(type)) {
    // API lists omit holdings — use the ranking endpoint for stocks, real fund list for the card view.
    return [...buildApiStockRankEntities(topStocks), ...buildFundHolderEntities(allFunds)]
  }
  if (type === 'mixed') return buildMixedFundEntities(allFunds)
  return buildMasterFundEntities(allFunds) // feeder
}

// Cached per fund type so every call site shares the same "selected" group
// that Section 3 (Comparison) will read from Section 2's Ranking Cards.
const instances = new Map()

export function useFundinfoRanking(type = 'feeder') {
  if (instances.has(type)) return instances.get(type)
  const instance = createFundinfoRanking(type)
  instances.set(type, instance)
  return instance
}

function createFundinfoRanking(type) {
  // Store-backed (fundinfoStore.js -> fundinfoApi.js): reads the real backend.
  const fundinfoStore = useFundinfoStore()
  fundinfoStore.loadFundsByType(type)
  const funds = computed(() => fundinfoStore.getFundsByType(type))
  const stock = isStockTab(type)
  const stockMarket = type === 'thai' ? 'TH' : 'FOREIGN'
  // Stock tabs always rank via /stocks/top (no mock fallback) — kept as its
  // own flag since branches below read it as a readability marker now.
  const usesApiStocks = stock

  if (usesApiStocks) fundinfoStore.loadTopStocksByMarket(stockMarket)

  const topStocks = computed(() => (usesApiStocks ? fundinfoStore.getTopStocksByMarket(stockMarket) : []))
  const stockRankingLoading = computed(() => usesApiStocks && fundinfoStore.isLoading(`stocks:${stockMarket}`))
  const stockRankingError = computed(() => (usesApiStocks ? fundinfoStore.getError(`stocks:${stockMarket}`) : null))
  const fundsLoading = computed(() => fundinfoStore.isLoading(type))

  const entities = computed(() => buildEntities(type, funds.value, topStocks.value))
  const accent = FUND_TYPES[type]?.accent || '#2456d8'

  const state = reactive({
    rk: { flow: 'm1', ret: 'y1' }, // ช่วงเวลาที่เลือกแสดงในการ์ด "เงินไหลเข้า" / "ผลตอบแทน"
    selected: [], // entity ids ที่เลือกไว้เปรียบเทียบ (สูงสุด 7 รายการ) — ไว้ต่อยอด Section 3
  })

  // ข้อความหัวข้อให้ตรงกับ mock (Image 4) — การ์ดทั้ง 3 ใบรวม stock entity และ holder entity
  // (กองทุนไทยที่ถือหุ้นนั้น) ไว้ในลิสต์เดียวกัน คละกันตามอันดับจริง ไม่แยกเป็นสอง block ซ้ำแบบภาพต้นแบบ
  // Seeded once (a later refresh must not clobber the user's selection).
  // Stocks and funds load via two separate requests that can resolve in
  // either order — seeding on ANY data would lock in a stock-only (or
  // holder-only) selection if one settles first, so wait for both to finish.
  let selectionSeeded = false
  watch(
    [entities, stockRankingLoading, fundsLoading],
    ([value, stocksStillLoading, fundsStillLoading]) => {
      if (selectionSeeded || !value.length) return
      if (usesApiStocks && (stocksStillLoading || fundsStillLoading)) return
      selectionSeeded = true
      if (stock) {
        state.selected.push(
          ...value.filter((entity) => entity.kind === 'stock').slice(0, 2).map((entity) => entity.id),
          ...value.filter((entity) => entity.kind === 'holder').slice(0, 2).map((entity) => entity.id),
        )
      }
    },
    { immediate: true },
  )

  const heading = computed(() => {
    if (type === 'offshore') return 'หุ้นต่างประเทศและกองทุนไทยที่ถือหุ้นต่างประเทศในกลุ่มที่เลือก'
    if (stock) return `หุ้น${type === 'thai' ? 'ไทย' : 'ต่างประเทศ'}และกองทุนไทยที่ถือหุ้นในกลุ่มที่เลือก`
    if (type === 'feeder') return 'อันดับ Master Fund จากทุกธีม'
    return 'อันดับภายในขอบเขตที่เลือก'
  })

  // ป้ายกำกับสั้นๆ เหนือการ์ด (เช่น "หุ้นต่างประเทศ" ใน Image 4)
  const itemLabel = computed(() => {
    if (stock) return type === 'offshore' ? 'หุ้นต่างประเทศ' : 'หุ้นไทย'
    if (type === 'feeder') return 'Master Fund'
    return 'กองทุนผสม'
  })

  const byFundCount = computed(() => [...entities.value].sort((a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight))
  const byTotalWeight = computed(() => [...entities.value].sort((a, b) => b.totalWeight - a.totalWeight))
  // Null-aware — flowP.w1 has no source field in direct/API mode, so a plain
  // subtract would NaN and silently no-op the sort; push missing values to the bottom.
  const byFlow = computed(() => [...entities.value].sort((a, b) => {
    const av = a.flowP[state.rk.flow]
    const bv = b.flowP[state.rk.flow]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return bv - av
  }))
  const byReturn = computed(() => [...entities.value].sort((a, b) => b.retP[state.rk.ret] - a.retP[state.rk.ret]))
  const byDividend = computed(() => [...entities.value].sort((a, b) => b.div - a.div))

  const legacyCards = computed(() => {
    if (stock) {
      return [
        {
          key: 'fundCount',
          emoji: '🏦',
          title: 'ถือโดยกองทุนมากที่สุด',
          desc: 'หุ้น: ปรากฏในหลายกองทุน · กองทุนไทย: ถือหุ้นที่ติดตามได้หลายตัว — ไม่ใช่คำแนะนำซื้อ',
          caption: 'หุ้นนับจากจำนวนกองทุนที่ถือ, กองทุนไทยนับจากจำนวนหุ้นที่ถือ',
          list: byFundCount.value,
          valueType: 'count',
        },
        {
          key: 'totalWeight',
          emoji: '⚖️',
          title: 'น้ำหนักรวมสูงสุด',
          desc: 'ช่วยเห็นหุ้นหรือกองทุนไทยที่มีน้ำหนักหุ้นกลุ่มนี้สูง',
          caption: 'ผลรวมน้ำหนักหุ้นที่ติดตามได้ใน Top Holdings',
          list: byTotalWeight.value,
          valueType: 'weight',
        },
        {
          key: 'stockReturn',
          emoji: '📈',
          title: 'ผลตอบแทนสูงสุด',
          desc: 'ผลตอบแทนของหุ้นรายตัว หรือของกองทุนไทยเอง ไม่ใช่ผลตอบแทนพอร์ตของท่าน',
          list: byReturn.value,
          valueType: 'percent',
          pillKind: 'ret',
          pillOptions: [
            ['m1', '1M'],
            ['q1', '3M'],
            ['y1', '1Y'],
          ],
        },
      ]
    }
    return [
      {
        key: 'flow',
        emoji: '💰',
        title: 'เงินไหลเข้าสูงสุด',
        desc: 'ดูว่าช่วงนี้เงินลงทุนกำลังไหลไปที่ไหน',
        list: byFlow.value,
        valueType: 'flow',
        pillKind: 'flow',
        pillOptions: [
          ['w1', '1W'],
          ['m1', '1M'],
          ['y1', '1Y'],
        ],
      },
      {
        key: 'return',
        emoji: '📈',
        title: 'ผลตอบแทนสูงสุด',
        desc: 'ดูรายการที่สร้างผลตอบแทนสูงในช่วงเวลาที่เลือก',
        list: byReturn.value,
        valueType: 'percent',
        pillKind: 'ret',
        pillOptions: [
          ['m1', '1M'],
          ['q1', '3M'],
          ['y1', '1Y'],
          ['y3', '3Y'],
          ['y5', '5Y'],
        ],
      },
      {
        key: 'dividend',
        emoji: '🌿',
        title: 'จ่ายปันผลสูงสุด',
        desc: 'ดูรายการหุ้นที่ให้ปันผลสูง',
        caption: 'ย้อนหลัง 12 เดือน',
        list: byDividend.value,
        valueType: 'dividend',
      },
    ]
  })

  const stockRankEntities = computed(() => entities.value.filter((entity) => entity.kind === 'stock'))
  const fundRankEntities = computed(() => entities.value.filter((entity) => entity.kind !== 'stock'))

  function sortRanked(list, compare) {
    return [...list].sort(compare)
  }

  const stockCards = computed(() => {
    if (!stock) return []
    const rows = stockRankEntities.value
    const rowsByWeight = (field) =>
      rows
        .map((row) => ({ ...row, totalWeight: row[field] }))
        .sort((left, right) => right.totalWeight - left.totalWeight)

    return [
      {
        key: 'stock-count',
        emoji: '🏦',
        title: 'ถือโดยกองทุนมากที่สุด',
        desc: 'จำนวนกองทุนที่ถือหุ้นนั้น ตามข้อมูลการถือครองที่ API สรุปไว้',
        caption: 'ไม่ใช่คำแนะนำซื้อหรือขาย',
        list: sortRanked(rows, (a, b) => b.fundCount - a.fundCount),
        valueType: 'count',
      },
      {
        key: 'stock-average-weight',
        emoji: '⚖️',
        title: 'น้ำหนักเฉลี่ยสูงสุด',
        desc: 'สัดส่วนการถือครองเฉลี่ยของกองทุนที่ถือหุ้นนั้น',
        caption: 'อ้างอิงข้อมูลการถือครองที่ API สรุปไว้',
        list: rowsByWeight('avgHoldingWeight'),
        valueType: 'weight',
      },
      {
        key: 'stock-return',
        emoji: '📈',
        title: 'ผลตอบแทนสูงสุด',
        desc: 'ผลตอบแทนของหุ้นรายตัว ตามข้อมูลที่ API สรุปไว้ ไม่ใช่ผลตอบแทนพอร์ตของท่าน',
        list: sortRanked(rows, (a, b) => b.retP[state.rk.ret] - a.retP[state.rk.ret]),
        valueType: 'percent',
        pillKind: 'ret',
        // /stocks/top only has return_1m/return_1y (no q1/y3/y5) — see buildApiStockRankEntities.
        pillOptions: [
          ['m1', '1M'],
          ['y1', '1Y'],
        ],
      },
    ]
  })

  const fundCards = computed(() => {
    if (!stock) return legacyCards.value
    const rows = fundRankEntities.value
    return [
      {
        key: 'fund-flow',
        emoji: '💸',
        title: 'เงินไหลเข้ากองทุนสูงสุด',
        desc: 'ดูว่าช่วงนี้เงินลงทุนกำลังไหลไปที่ไหน',
        list: sortRanked(rows, (a, b) => b.flowP[state.rk.flow] - a.flowP[state.rk.flow]),
        valueType: 'flow',
        pillKind: 'flow',
        pillOptions: [['w1', '1W'], ['m1', '1M'], ['y1', '1Y']],
      },
      {
        key: 'fund-return',
        emoji: '📊',
        title: 'ผลตอบแทนกองทุนสูงสุด',
        desc: 'ดูรายการที่สร้างผลตอบแทนสูงในช่วงเวลาที่เลือก',
        list: sortRanked(rows, (a, b) => b.retP[state.rk.ret] - a.retP[state.rk.ret]),
        valueType: 'percent',
        pillKind: 'ret',
        pillOptions: [['m1', '1M'], ['q1', '3M'], ['y1', '1Y'], ['y3', '3Y'], ['y5', '5Y']],
      },
      {
        key: 'fund-dividend',
        emoji: '💰',
        title: 'เงินปันผลสูงสุด',
        desc: 'ดูรายการที่หุ้นที่ให้ปันผลสูง',
        caption: 'ย้อนหลัง 12 เดือน',
        list: sortRanked(rows, (a, b) => b.div - a.div),
        valueType: 'dividend',
      },
    ]
  })

  const cards = computed(() => (stock ? stockCards.value : legacyCards.value))
  const selectedEntities = computed(() => state.selected.map((id) => entities.value.find((e) => e.id === id)).filter(Boolean))

  function orderOf(id) {
    return state.selected.indexOf(id)
  }

  function select(id) {
    const at = state.selected.indexOf(id)
    if (at > -1) {
      state.selected.splice(at, 1)
    } else if (state.selected.length < MAX_SELECTED) {
      state.selected.push(id)
    }
  }

  function clearSelection() {
    state.selected = []
  }

  function setRank(kind, key) {
    state.rk[kind] = key
  }

  function retryStockRanking() {
    if (usesApiStocks) fundinfoStore.loadTopStocksByMarket(stockMarket, { force: true })
  }

  return {
    stock,
    usesApiStocks,
    stockRankingLoading,
    fundsLoading,
    stockRankingError,
    retryStockRanking,
    accent,
    heading,
    itemLabel,
    state,
    cards,
    stockCards,
    fundCards,
    selectedEntities,
    maxSelected: MAX_SELECTED,
    orderOf,
    select,
    clearSelection,
    setRank,
  }
}
