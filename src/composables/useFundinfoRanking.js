import { computed, reactive } from 'vue'
import { fundsByType, FUND_TYPES, STOCK_META } from '../data/fundinfoData'

// ==========================================================================
// Section ② Ranking Cards
// Ported from computeEntities() + rankCard()/rankRows()/pillSet()/renderCards()
// + selectGroup()/clearGroupSelection() in the fundinfo v3.2.1 HTML prototype.
//
// Builds a ranked "entity" list per tab — stocks (from Top Holdings) for
// Offshore/Thai, Master Funds (grouped by fund.master) for Feeder, and
// individual funds for Mixed — then renders 3 ranking cards with time-range
// toggle pills. Clicking a row adds it to a comparison group (max 7), which
// Section 3 (Master Fund / Stock Comparison — not built yet) will consume.
//
// Note: the prototype narrows this entity pool using the Section 1
// scope/theme selection (e.g. only stocks within the exposure groups picked
// in ExposureTrendSection). This composable intentionally does not wire that
// cross-section filter yet — Section 1's own fund table isn't filtered by it
// either in the current codebase — so it always ranks across the full tab.
// That link can be added later without changing this file's public shape.
// ==========================================================================

const MAX_SELECTED = 7

function isDirectEquityFund(fund) {
  return (fund.top5 || []).some((h) => STOCK_META[h.name])
}

function isStockTab(type) {
  return type === 'offshore' || type === 'thai'
}

// หุ้นรายตัวที่พบใน Top Holdings ของกองทุน — ใช้เป็น entity สำหรับจัดอันดับของ Offshore/Thai
function buildStockRankEntities(funds) {
  const g = {}
  funds.forEach((f) => {
    ;(f.top5 || []).forEach((h) => {
      const meta = STOCK_META[h.name]
      if (!meta) return
      const x = g[h.name] || (g[h.name] = { name: h.name, meta, membersMap: new Map(), totalWeight: 0 })
      x.membersMap.set(f.id, f)
      x.totalWeight += h.percent
    })
  })
  return Object.values(g).map((x, idx) => {
    const ret = x.meta.ret
    return {
      idx,
      kind: 'stock',
      id: x.name,
      title: `${x.meta.ticker} · ${x.name}`,
      // ฟิลด์ต่อไปนี้ Section 2 เองไม่ได้ใช้ แต่ Section 3 (เปรียบเทียบหุ้น) ต้องใช้ต่อ
      name: x.name,
      ticker: x.meta.ticker,
      sector: x.meta.sector,
      country: x.meta.country,
      meta: x.meta,
      perf: ret,
      fundCount: x.membersMap.size,
      totalWeight: +x.totalWeight.toFixed(1),
      // ผลตอบแทนย่อยตามช่วงเวลาของหุ้น อิงสัดส่วนเดียวกับที่ต้นแบบใช้ในการประมาณจากผลตอบแทน 1 ปี
      retP: { m1: +(ret * 0.16).toFixed(1), q1: +(ret * 0.42).toFixed(1), y1: ret },
      // ปันผลหุ้นสูงสุด (การ์ดที่ 3 ฝั่ง "หุ้น") — ใช้ค่า div จาก STOCK_META ถ้ามี ถ้ายังไม่มีข้อมูลปันผลรายหุ้น
      // ใน mock ให้ fallback ไปใช้ ret แทนไปก่อน เพื่อให้การ์ดมีตัวเลขแสดงผลได้เหมือนต้นแบบ
      div: x.meta.div ?? ret,
    }
  })
}

// กองทุนไทยที่ถือหุ้นเหล่านี้โดยตรง — entity อีกแบบสำหรับ Offshore/Thai ให้ "ถือ" ในทิศทางกลับกับหุ้น
// (หุ้นนับจากจำนวนกองทุนที่ถือมัน, กองทุนนับจากจำนวนหุ้นที่ติดตามได้ที่มันถือ) แต่ใช้ชื่อ field ชุด
// เดียวกับ stock entity (fundCount / totalWeight / retP) เพื่อให้ปะปนอยู่ใน byFundCount/byTotalWeight/
// byReturn เดียวกันได้เลย โดยไม่ต้องแก้ตรรกะการเรียง/เลือกใน RankingCardsSection.vue หรือ
// useFundinfoInsight.js — entity ทั้งสองแบบ "เท่าเทียมกัน" ในทุกกลไกของ Section 2/3
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
  return Object.entries(groups).map(([master, members], idx) => {
    const flowP = {}
    const retP = {}
    ;['w1', 'm1', 'y1'].forEach((p) => (flowP[p] = sum(members.map((m) => m.flowP[p]))))
    ;['m1', 'q1', 'y1', 'y3', 'y5'].forEach((p) => (retP[p] = avg(members.map((m) => m.retP[p]))))
    return {
      idx,
      kind: 'master',
      id: master,
      title: master,
      members,
      flowP,
      retP,
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

function buildEntities(type) {
  if (isStockTab(type)) {
    const funds = fundsByType(type).filter(isDirectEquityFund)
    // รวมหุ้นรายตัว (kind: 'stock') กับกองทุนไทยที่ถือหุ้นเหล่านั้นโดยตรง (kind: 'holder') ไว้ใน pool
    // เดียวกัน ให้ทั้งสองแบบ "เท่าเทียมกัน" ตามที่ heading ด้านล่างสื่อไว้อยู่แล้ว
    // ("หุ้น...และกองทุนไทยที่ถือหุ้น...ในกลุ่มที่เลือก")
    return [...buildStockRankEntities(funds), ...buildFundHolderEntities(funds)]
  }
  if (type === 'mixed') return buildMixedFundEntities(fundsByType(type))
  return buildMasterFundEntities(fundsByType(type)) // feeder
}

// Section 3 (Master Fund / Stock Comparison) reads the same "selected" group
// that Section 2's Ranking Cards write to, so this composable is cached per
// fund type — every call site for a given type gets back the identical
// reactive instance instead of a fresh, disconnected one.
const instances = new Map()

export function useFundinfoRanking(type = 'feeder') {
  if (instances.has(type)) return instances.get(type)
  const instance = createFundinfoRanking(type)
  instances.set(type, instance)
  return instance
}

function createFundinfoRanking(type) {
  const entities = buildEntities(type)
  const stock = isStockTab(type)
  const accent = FUND_TYPES[type]?.accent || '#2456d8'

  const state = reactive({
    rk: { flow: 'm1', ret: 'y1' }, // ช่วงเวลาที่เลือกแสดงในการ์ด "เงินไหลเข้า" / "ผลตอบแทน"
    selected: [], // entity ids ที่เลือกไว้เปรียบเทียบ (สูงสุด 7 รายการ) — ไว้ต่อยอด Section 3
  })

  // ข้อความหัวข้อ — ให้ตรงกับ mock (Image 4): ไม่มีเลขนำหน้าเหมือน Section 1/3 และสำหรับ Offshore/Thai
  // ใช้ถ้อยคำเดียวกับภาพเป๊ะๆ ("...และกองทุนไทยที่ถือหุ้นต่างประเทศในกลุ่มที่เลือก") ซึ่งตอนนี้ตรงกับ
  // entity pool จริงแล้ว: การ์ดทั้ง 3 ใบรวมทั้งหุ้นรายตัว (kind: 'stock') และกองทุนไทยที่ถือหุ้นเหล่านั้น
  // โดยตรง (kind: 'holder') ไว้ในลิสต์เดียวกัน คละกันตามอันดับจริง — ไม่ได้แยกเป็นสอง block ซ้ำแบบใน
  // ภาพต้นแบบ ซึ่งดูเหมือนเป็นการ paste ซ้ำ ไม่ใช่ของสองชุดที่ตั้งใจ (เพราะตัวเลขในทั้งสอง block ของภาพ
  // เหมือนกันทุกตัว)
  if (stock) {
    state.selected.push(
      ...entities.filter((entity) => entity.kind === 'stock').slice(0, 2).map((entity) => entity.id),
      ...entities.filter((entity) => entity.kind === 'holder').slice(0, 2).map((entity) => entity.id),
    )
  }

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

  const byFundCount = computed(() => [...entities].sort((a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight))
  const byTotalWeight = computed(() => [...entities].sort((a, b) => b.totalWeight - a.totalWeight))
  const byFlow = computed(() => [...entities].sort((a, b) => b.flowP[state.rk.flow] - a.flowP[state.rk.flow]))
  const byReturn = computed(() => [...entities].sort((a, b) => b.retP[state.rk.ret] - a.retP[state.rk.ret]))
  const byDividend = computed(() => [...entities].sort((a, b) => b.div - a.div))

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

  const stockRankEntities = computed(() => entities.filter((entity) => entity.kind === 'stock'))
  const fundRankEntities = computed(() => entities.filter((entity) => entity.kind !== 'stock'))

  function sortRanked(list, compare) {
    return [...list].sort(compare)
  }

  const stockCards = computed(() => {
    if (!stock) return []
    const rows = stockRankEntities.value
    return [
      {
        key: 'stock-count',
        emoji: '🏦',
        title: 'ถือโดยกองทุนมากที่สุด',
        desc: 'ช่วยดูว่าหุ้นใดปรากฏในหลายกองทุน ไม่ใช่คำแนะนำซื้อ',
        caption: 'นับจำนวนกองทุนที่พบหุ้นใน Top Holdings',
        list: sortRanked(rows, (a, b) => b.fundCount - a.fundCount || b.totalWeight - a.totalWeight),
        valueType: 'count',
      },
      {
        key: 'stock-weight',
        emoji: '⚖️',
        title: 'น้ำหนักรวมสูงสุด',
        desc: 'ช่วยให้เห็นหุ้นที่กองทุนให้น้ำหนักรวมสูง',
        caption: 'ผลรวมน้ำหนักจากกองทุนตัวอย่าง',
        list: sortRanked(rows, (a, b) => b.totalWeight - a.totalWeight),
        valueType: 'weight',
      },
      {
        key: 'stock-dividend',
        emoji: '💰',
        title: 'ปันผลหุ้นสูงสุด',
        desc: 'ดูรายการที่หุ้นให้ปันผลสูง',
        caption: 'ย้อนหลัง 12 เดือน',
        list: sortRanked(rows, (a, b) => b.div - a.div),
        valueType: 'dividend',
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
  const selectedEntities = computed(() => state.selected.map((id) => entities.find((e) => e.id === id)).filter(Boolean))

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

  return {
    stock,
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