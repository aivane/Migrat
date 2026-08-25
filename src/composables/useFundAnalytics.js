// src/composables/useFundAnalytics.js
//
// Deterministic mock-analytics derivations for a single fund. Direct API mode
// deliberately returns only API-backed values; it must never invent analytics.
//
// Security note: this module never touches user input, the DOM, or
// localStorage — it only shapes numbers/strings that callers bind via
// Vue's `{{ }}` interpolation (auto-escaped), never via v-html. There is
// no injection surface here by construction.
import { computed } from 'vue'
import { INSIGHT } from '../data/fundinfoData'
import { fundinfoApiMode } from '../services/fundinfoApi'

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const MAX_NAV_CACHE_ENTRIES = 40 // Perf: cap memoization cache, avoid unbounded memory growth
const usesMockAnalytics = fundinfoApiMode === 'mock'

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
 * Stable numeric seed derived from a fund id.
 * Input validation: guards against non-string / empty ids so downstream
 * math (`% 11`, `% 3`, etc.) never receives NaN.
 * NOT cryptographic — deterministic mock-data seeding only.
 */
function hashId(id) {
  if (typeof id !== 'string' || id.length === 0) return 1
  return [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
}

function isIndexFund(fund) {
  return !!(fund?.master && /Index|ETF/i.test(fund.master))
}

/**
 * @param {import('vue').Ref|import('vue').ComputedRef} fundRef - reactive ref to the active fund object (or null)
 */
export function useFundAnalytics(fundRef) {
  const seed = computed(() => hashId(fundRef.value?.id))

  const jitter = (mult, scale) => (((seed.value * mult) % 11) / 11 - 0.5) * scale

  const registrationDate = computed(() => {
    const f = fundRef.value
    if (!f) return '-'
    if (!usesMockAnalytics) return f.inceptionDate || '-'
    const h = seed.value
    return `${(h % 28) + 1} ${MONTHS_TH[h % 12]} ${2558 + (h % 8)}`
  })

  const turnoverRatio = computed(() => (usesMockAnalytics ? (((seed.value % 35) + 10) / 100).toFixed(2) : '-'))

  // ---------- Country allocation ----------
  const COUNTRY_TABLE = {
    สหรัฐฯ: [{ name: 'สหรัฐอเมริกา', percent: 95.0 }, { name: 'อื่นๆ', percent: 5.0 }],
    จีน: [{ name: 'ประเทศจีน', percent: 94.2 }, { name: 'ฮ่องกง', percent: 4.3 }, { name: 'อื่นๆ', percent: 1.5 }],
    เกาหลีใต้: [{ name: 'เกาหลีใต้', percent: 95.8 }, { name: 'อื่นๆ', percent: 4.2 }],
    ยุโรป: [
      { name: 'เนเธอร์แลนด์', percent: 28.5 }, { name: 'สหราชอาณาจักร', percent: 22.1 },
      { name: 'ฝรั่งเศส', percent: 18.4 }, { name: 'เยอรมนี', percent: 15.2 },
      { name: 'สวิตเซอร์แลนด์', percent: 10.8 }, { name: 'อื่นๆ', percent: 5.0 },
    ],
    ทองคำโลก: [{ name: 'ทองคำแท่ง (ลอนดอน)', percent: 100.0 }],
    'สหรัฐฯ/ยุโรป': [
      { name: 'สหรัฐอเมริกา', percent: 68.5 }, { name: 'สหราชอาณาจักร', percent: 12.3 },
      { name: 'สวิตเซอร์แลนด์', percent: 8.2 }, { name: 'เดนมาร์ก', percent: 6.0 }, { name: 'อื่นๆ', percent: 5.0 },
    ],
  }
  const countryAllocation = computed(() => {
    const f = fundRef.value
    if (!f) return []
    if (!usesMockAnalytics) return Array.isArray(f.countryAllocation) ? f.countryAllocation : []
    if (f.type === 'thai') return [{ name: 'ประเทศไทย', percent: 96.5 }, { name: 'อื่นๆ', percent: 3.5 }]
    return COUNTRY_TABLE[f.country] || [
      { name: 'สหรัฐอเมริกา', percent: 62.4 }, { name: 'ญี่ปุ่น', percent: 7.8 },
      { name: 'สหราชอาณาจักร', percent: 5.2 }, { name: 'ฝรั่งเศส', percent: 4.1 },
      { name: 'จีน/ไต้หวัน', percent: 15.5 }, { name: 'อื่นๆ', percent: 5.0 },
    ]
  })

  // ---------- Top 10 holdings (prefers INSIGHT master/theme data, pads with filler) ----------
  const HOLDING_FILLER = [
    { name: 'เงินสดและเงินฝากธนาคาร', percent: 2.5 },
    { name: 'สัญญาซื้อขายล่วงหน้าเพื่อป้องกันความเสี่ยง', percent: 1.2 },
    { name: 'ตราสารหนี้ระยะสั้นภาครัฐ', percent: 0.8 },
    { name: 'สินทรัพย์หมุนเวียนอื่น ๆ', percent: 0.5 },
  ]
  const topHoldings = computed(() => {
    const f = fundRef.value
    if (!f) return []
    if (!usesMockAnalytics) return Array.isArray(f.top5) ? f.top5.slice(0, 10) : []
    const insightSource =
      (f.master && INSIGHT[f.master]) ||
      (f.themes?.[1] && INSIGHT[f.themes[1]]) ||
      (f.themes?.[0] && INSIGHT[f.themes[0]])
    if (insightSource?.top) {
      return insightSource.top.map(([name, ticker, percent, ret]) => ({ name, ticker, percent, ret }))
    }
    const base = (f.top5 || []).map((item) => ({ name: item.name, percent: item.percent }))
    let i = 0
    while (base.length < 10 && i < HOLDING_FILLER.length) base.push(HOLDING_FILLER[i++])
    return base
  })

  // ---------- Investment-policy bullet copy ----------
  const policyBullets = computed(() => {
    const f = fundRef.value
    if (!f) return []
    if (!usesMockAnalytics) {
      return [
        f.group ? `หมวดหมู่กองทุน: ${f.group}` : '',
        f.master ? `กองทุนหลัก: ${f.master}` : '',
        f.dividendPolicy ? `นโยบายการจ่ายปันผล: ${f.dividendPolicy}` : '',
      ].filter(Boolean)
    }
    const fx = f.stats?.fxhedge
    if (f.type === 'feeder') {
      return [
        `เน้นลงทุนในหน่วยลงทุนของกองทุนรวมต่างประเทศเพียงกองทุนเดียว (Feeder Fund) ได้แก่ ${f.master}`,
        `กองทุนหลักมีวัตถุประสงค์ลงทุนเพื่อให้ผลการดำเนินงานเคลื่อนไหวใกล้เคียงเกณฑ์มาตรฐาน: ${INSIGHT[f.master]?.bench || 'ดัชนีอ้างอิง'}`,
        `มีการป้องกันความเสี่ยงอัตราแลกเปลี่ยนตามเงื่อนไขของกองทุน ปัจจุบันอยู่ที่ประมาณ ${
          fx !== null && fx !== undefined ? fx.toFixed(2) + ' %' : '0.00 % (ป้องกันเต็มจำนวน / ตามดุลยพินิจ)'
        }`,
      ]
    }
    if (f.type === 'offshore') {
      return [
        `เน้นลงทุนโดยตรงในตราสารทุนหรือหลักทรัพย์ต่างประเทศ ตามธีมหลัก: ${(f.themes || []).join(', ')}`,
        'บริหารพอร์ตเชิงรุกเพื่อแสวงหาผลตอบแทนส่วนเพิ่ม (Alpha) เหนือเกณฑ์มาตรฐานเฉลี่ยกลุ่ม',
        'มีการลงทุนในสัญญาซื้อขายล่วงหน้า (Derivatives) เพื่อป้องกันความเสี่ยงจากอัตราแลกเปลี่ยนตามความเหมาะสม',
      ]
    }
    if (f.type === 'thai') {
      return [
        'เน้นลงทุนในตราสารทุนไทย (หุ้นไทย) ที่จดทะเบียนในตลาดหลักทรัพย์แห่งประเทศไทย',
        'คัดเลือกหลักทรัพย์ที่มีปัจจัยพื้นฐานดีและมีมูลค่าทางบัญชีที่เหมาะสมตามสภาวะเศรษฐกิจไทย',
        'เน้นการบริหารจัดการพอร์ตแบบมีประสิทธิภาพเพื่อสร้างโอกาสรับปันผลและส่วนต่างราคาในระยะยาว',
      ]
    }
    return [
      'เน้นกระจายความเสี่ยงโดยลงทุนในหลากหลายประเภทสินทรัพย์ (หุ้นไทย หุ้นต่างประเทศ ตราสารหนี้ และเงินฝาก)',
      'มีระดับการป้องกันความเสี่ยงและโครงสร้างสินทรัพย์ที่ยืดหยุ่น ปรับสัดส่วนตามสภาวะตลาดการลงทุนในแต่ละขณะ',
      'เหมาะสำหรับการจัดพอร์ตลงทุนระยะกลาง-ยาว เพื่อสร้างเสถียรภาพและลดความผันผวนโดยรวม',
    ]
  })

  // ---------- Benchmark / alpha / beta / recovery ----------
  function benchmarkReturn(fundReturn, fund = fundRef.value) {
    if (!fund) return 0
    if (!usesMockAnalytics) return null
    const h = seed.value
    if (isIndexFund(fund)) return +(fundReturn - 0.05 * ((h % 3) - 1)).toFixed(1)
    return +(fundReturn - (0.4 + (h % 5) * 0.3)).toFixed(1)
  }

  const alphaBetaRecover = computed(() => {
    const f = fundRef.value
    if (!f) return { alpha: 0, beta: 0, recover: 0 }
    if (!usesMockAnalytics) return { alpha: null, beta: null, recover: null, available: false }
    // Known-good published figures for this fund mirror the source prototype 1:1.
    if (f.id === 'SCBNDQ') return { alpha: -0.11, beta: 0.97, recover: 13 }
    const bench = benchmarkReturn(f.perf, f)
    return {
      alpha: +(f.perf - bench).toFixed(2),
      beta: f.stats?.beta ?? 0,
      recover: f.stats?.recover ?? 0,
    }
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

  function groupAverage(val) {
    if (!usesMockAnalytics) return null
    const h = seed.value
    const offset = (((h * 7) % 11) / 11 - 0.5) * 2
    return +(val - 0.5 + offset).toFixed(1)
  }

  // ---------- Fee schedule (prospectus vs. actual) ----------
  const feeSchedule = computed(() => {
    const f = fundRef.value
    if (!f) return null
    if (!usesMockAnalytics) {
      return {
        frontEndProspectus: '-', frontEndActual: feePercentText(f.frontEndFee),
        backEndProspectus: '-', backEndActual: feePercentText(f.backEndFee),
        switchInProspectus: '-', switchInActual: '-',
        switchOutProspectus: '-', switchOutActual: '-',
        managementProspectus: '-', managementActual: percentageText(f.managementFee),
        terProspectus: '-', terActual: percentageText(f.fee),
        bid: finiteApiNumber(f.nav),
        offer: finiteApiNumber(f.nav),
        turnoverRatio: '-',
      }
    }
    const fee = f.fee || 0
    const actualFrontEnd = fee < 0.8 ? 0 : fee > 1.8 ? 1.5 : 1.0

    let schedule = {
      frontEndProspectus: `${(fee * 1.25).toFixed(2)} %`,
      frontEndActual: actualFrontEnd > 0 ? `${actualFrontEnd.toFixed(2)} %` : '0%',
      backEndProspectus: '1.00 %', backEndActual: '0%',
      switchInProspectus: '1.00 %', switchInActual: '0%',
      switchOutProspectus: '1.00 %', switchOutActual: '0%',
      managementProspectus: `${(fee * 1.2).toFixed(2)} % ต่อปี`,
      managementActual: `${(fee * 0.75).toFixed(2)} % ต่อปี`,
      terProspectus: `${(fee * 1.5).toFixed(2)} % ต่อปี`,
      terActual: `${fee.toFixed(2)} % ต่อปี`,
    }

    if (f.id === 'SCBNDQ') {
      schedule = {
        frontEndProspectus: '3.21 %', frontEndActual: '0%',
        backEndProspectus: '3.21 %', backEndActual: '0%',
        switchInProspectus: '3.21 %', switchInActual: '0%',
        switchOutProspectus: '3.21 %', switchOutActual: '0%',
        managementProspectus: '1.07 % ต่อปี', managementActual: '0.27 % ต่อปี',
        terProspectus: '2.36 % ต่อปี', terActual: '0.36 % ต่อปี',
      }
    }

    return {
      ...schedule,
      bid: f.nav,
      offer: f.nav * (1 + actualFrontEnd / 100),
      turnoverRatio: turnoverRatio.value,
    }
  })

  // ---------- Dividend history ----------
  const dividendHistory = computed(() => {
    const f = fundRef.value
    if (!f || !f.div) return []
    if (!usesMockAnalytics) return []
    const h = seed.value
    const years = [2568, 2567, 2567, 2566]
    const months = ['มิ.ย.', 'ธ.ค.', 'มิ.ย.', 'ธ.ค.']
    const perPayment = f.div / 2
    return years.map((y, idx) => ({
      closedDate: `วันที่ ${((h + idx * 7) % 25) + 1} ${months[idx]} ${y}`,
      paidDate: `วันที่ ${((h + idx * 7) % 25) + 5} ${months[idx]} ${y}`,
      amount: (perPayment * (1 - idx * 0.05)).toFixed(4),
    }))
  })

  // ---------- API-mode NAV history: real checkpoint returns, not a daily series ----------
  // Direct API mode has no daily NAV/price series anywhere — but the fund
  // list/detail response DOES publish real cumulative returns at fixed
  // checkpoints (1M/3M/1Y/3Y/5Y/10Y, already captured into fund.retP). Turn
  // those into a small real index series (base 100 = today) instead of
  // either fabricating a daily path or leaving the chart blank. Every plotted
  // value is derived directly from the fund's own disclosed return_*, and
  // checkpoints the API left null for this fund are simply omitted.
  const RETURN_CHECKPOINTS = [
    { key: 'y10', days: 3650 },
    { key: 'y5', days: 1825 },
    { key: 'y3', days: 1095 },
    { key: 'y1', days: 365 },
    { key: 'q1', days: 90 },
    { key: 'm1', days: 30 },
  ]

  function apiNavHistory(f) {
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

    return { labels: rawLabels, rawLabels, navData, totalReturnData: navData, benchmarkData: [] }
  }

  // ---------- NAV history (line-chart source), memoized per fund+range ----------
  const navHistoryCache = new Map()
  function navHistory(range) {
    const f = fundRef.value
    if (!f) return noSeries()
    if (!usesMockAnalytics) return apiNavHistory(f)

    const cacheKey = `${f.id}:${range}`
    if (navHistoryCache.has(cacheKey)) return navHistoryCache.get(cacheKey)
    if (navHistoryCache.size >= MAX_NAV_CACHE_ENTRIES) navHistoryCache.clear() // Perf: bound memory

    const dayCounts = { '1M': 30, '3M': 90, '1Y': 250, '3Y': 750, '5Y': 1250 }
    const days = dayCounts[range] || 1750 // 'Max'

    const h = seed.value
    const annualReturn = (f.perf || 0) / 100
    const dailyReturn = annualReturn / 250
    const dailyVolatility = (f.stats?.sd || 10) / 100 / Math.sqrt(250)
    const indexFund = isIndexFund(f)
    const benchDailyReturn = indexFund ? dailyReturn : dailyReturn - 0.4 / 100 / 250
    const benchVolatility = dailyVolatility * 0.9

    // Deterministic LCG PRNG for a reproducible mock series only — NOT cryptographic.
    let rState = h
    const nextRand = () => { rState = (rState * 9301 + 49297) % 233280; return rState / 233280 - 0.5 }
    let rStateB = h + 777
    const nextRandB = () => { rStateB = (rStateB * 9301 + 49297) % 233280; return rStateB / 233280 - 0.5 }

    const rawNav = []; const rawTr = []; const rawBench = []
    let currentNav = 10; let currentTr = 10; let currentBench = 10
    for (let i = 0; i < days; i++) {
      const ret = dailyReturn + nextRand() * dailyVolatility
      const bRet = benchDailyReturn + nextRandB() * benchVolatility
      currentTr *= 1 + ret
      currentBench *= 1 + bRet
      currentNav = (f.div > 0 && i > 0 && i % 120 === 0)
        ? currentNav * (1 + ret) * (1 - f.div / 100 / 2)
        : currentNav * (1 + ret)
      rawNav.push(currentNav); rawTr.push(currentTr); rawBench.push(currentBench)
    }

    const scale = f.nav / rawNav[rawNav.length - 1]
    const today = new Date()
    const rawLabels = []; const navData = []; const totalReturnData = []; const benchmarkData = []
    for (let i = 0; i < days; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - Math.round((days - 1 - i) * 1.4))
      rawLabels.push(
        (range === '1M' || range === '3M')
          ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
          : d.toLocaleDateString('th-TH', { month: 'short', year: '2-digit' })
      )
      navData.push(Number((rawNav[i] * scale).toFixed(4)))
      totalReturnData.push(Number((rawTr[i] * scale).toFixed(4)))
      benchmarkData.push(Number((rawBench[i] * scale).toFixed(4)))
    }
    const step = Math.max(1, Math.round(days / 12))
    const labels = rawLabels.map((l, idx) => (idx % step === 0 || idx === days - 1 ? l : ''))

    const result = { labels, rawLabels, navData, totalReturnData, benchmarkData }
    navHistoryCache.set(cacheKey, result)
    return result
  }

  return {
    seed,
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
    benchmarkReturn,
    navHistory,
    isIndexFund: () => isIndexFund(fundRef.value),
  }
}
