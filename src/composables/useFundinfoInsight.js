import { computed } from 'vue'
import { INSIGHT } from '../data/fundinfoData'
import { fundinfoApiMode } from '../services/fundinfoApi'
import { useFundinfoRanking } from './useFundinfoRanking'
import { performanceSeries, CMP_LABELS } from './useFundinfoThemeTrend'

// ==========================================================================
// Section ③ Master Fund / Stock Comparison (deep-dive)
// Ported from insightFor(), keyCharacteristics(), avgMaxDrawdown(),
// compareBenchmark(), renderInsight()/renderStockInsight() and
// buildMasterCompareChart() in the fundinfo v3.2.1 HTML prototype.
//
// Deliberately NOT built for 'mixed' — the prototype's renderInsight() bails
// out immediately when state.tab==='mixed' (`wrap.innerHTML=''`), so Mixed
// Fund never gets a Section 3 either.
//
// Reuses useFundinfoRanking(type)'s selection (state.selected / selectedEntities)
// instead of keeping its own — thanks to that composable's per-type instance
// cache, this always reflects exactly what's picked in Section 2's Ranking
// Cards, the same way ENTS/state.groups were shared between renderCards()
// and renderInsight() in the prototype.
// ==========================================================================

const GLOBAL_RETURN = 12.8
export const COMPARE_COLORS = ['#2456d8', '#0e9f6e', '#e0a411', '#7a5af5', '#e2557a', '#0891b2', '#f04438']
export const COMPARE_DASH = [[], [8, 3], [3, 2], [10, 3, 2, 3], [6, 2], [2, 2], [12, 3]]

const BENCHMARKS = {
  thai: { name: 'SET TRI', ret: 3.2, short: 'SET' },
  offshore: { name: 'MSCI ACWI', ret: GLOBAL_RETURN, short: 'Global' },
  feeder: { name: 'MSCI ACWI', ret: GLOBAL_RETURN, short: 'Global' },
}

function seedFromId(id) {
  return [...String(id)].reduce((sum, ch) => sum + ch.charCodeAt(0), 31)
}

// ผลตอบแทนสะสมจำลอง (ฐาน 100) สำหรับ entity หนึ่งตัวบนกราฟเปรียบเทียบ Section 3
function entitySeries(ent) {
  return performanceSeries(seedFromId(ent.id), ent.perf ?? 0, CMP_LABELS.length)
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function averageFinite(values) {
  const validValues = values.map(finiteNumber).filter((value) => value !== null)
  if (!validValues.length) return null
  return +(validValues.reduce((sum, value) => sum + value, 0) / validValues.length).toFixed(1)
}

// บทวิเคราะห์ Master Fund (Feeder) — จาก INSIGHT[master] หรือ fallback ที่รวม Top Holdings ของสมาชิกเอง
function insightFor(ent) {
  const found = INSIGHT[ent.id]
  if (found) return found

  const agg = {}
  ent.members.forEach((m) => {
    ;(m.top5 || []).forEach((h) => {
      agg[h.name] = (agg[h.name] || 0) + h.percent
    })
  })
  const top = Object.entries(agg)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, weight]) => [
      name,
      name.slice(0, 4).toUpperCase(),
      +(weight / ent.members.length).toFixed(1),
      +(ent.perf * 0.7).toFixed(1),
    ])

  return {
    theme: ent.title,
    narr: 'ธีมการลงทุนที่รวมกองทุนซึ่งมีนโยบายและพอร์ตใกล้เคียงกัน ให้ภาพรวมทิศทางและหุ้น/สินทรัพย์ที่ถืออยู่',
    pe: null,
    pb: null,
    flow: ent.flowP.y1,
    bench: 'Benchmark',
    master: {
      name: ent.members[0].master || ent.title,
      amc: ent.members[0].amc,
      aum: '—',
      incep: '—',
      te: 2.5,
      pm: '—',
    },
    top,
  }
}

function avgMaxDrawdown(ent) {
  return averageFinite(ent.members.map((fund) => fund.stats?.maxdd))
}

// การ์ด "ลักษณะเด่น" ของ Master Fund — valuation / ทองคำ (cost & tracking) / ตราสารหนี้ (income & rate risk) / ไม่มี
function keyCharacteristics(insight) {
  const text = `${insight.theme} ${insight.master.name}`.toLowerCase()
  if (insight.pe != null) return { kind: 'valuation', pe: insight.pe, pb: insight.pb }
  if (/gold|ทอง/.test(text)) return { kind: 'gold', expenseRatio: 0.4, trackingDiff: -0.12 }
  if (/bond|ตราสาร/.test(text)) return { kind: 'bond', ytm: 4.9, duration: 6.2, credit: 'A+' }
  return null
}

export function useFundinfoInsight(type = 'feeder') {
  const stock = type === 'offshore' || type === 'thai'
  const bench = BENCHMARKS[type] || BENCHMARKS.feeder
  const usesMockInsightData = fundinfoApiMode === 'mock'
  const itemLabel = stock ? (type === 'offshore' ? 'หุ้นต่างประเทศ' : 'หุ้นไทย') : type === 'feeder' ? 'Master Fund' : 'ธีมลงทุน'

  // instance เดียวกับที่ RankingCardsSection.vue (Section 2) ใช้ — เลือก/ถอดที่นั่นสะท้อนมาที่นี่ทันที
  const { selectedEntities, maxSelected } = useFundinfoRanking(type)

  const cardsData = computed(() =>
    selectedEntities.value.map((ent) => {
      const series = usesMockInsightData ? entitySeries(ent) : null

      if (ent.kind === 'stock') {
        if (ent.dataSource === 'api') {
          return {
            id: ent.id,
            kind: 'stock',
            title: `${ent.ticker} · ${ent.name}`,
            subtitle: `${ent.sector} · ${ent.country}`,
            perf: null,
            gap: null,
            maxDrawdown: null,
            pe: null,
            pb: null,
            div: null,
            cap: ent.totalHoldingValueMThb,
            fundCount: ent.fundCount,
            totalWeight: ent.totalWeight,
            holdings: `น้ำหนักเฉลี่ย ${ent.avgHoldingWeight.toFixed(1)}%`,
            series: null,
          }
        }

        const gap = +(ent.perf - bench.ret).toFixed(1)
        return {
          id: ent.id,
          kind: 'stock',
          title: `${ent.ticker} · ${ent.name}`,
          subtitle: `${ent.sector} · ${ent.country}`,
          perf: ent.perf,
          gap,
          maxDrawdown: ent.meta.dd,
          pe: ent.meta.pe,
          pb: ent.meta.pb,
          div: ent.meta.div,
          cap: ent.meta.cap,
          fundCount: ent.fundCount,
          totalWeight: ent.totalWeight,
          series,
        }
      }

      // กองทุนไทยที่ถือหุ้นเหล่านี้โดยตรง (เลือกมาจาก Ranking Card ชุดเดียวกับหุ้น — ดู
      // buildFundHolderEntities ใน useFundinfoRanking.js) ใช้ข้อมูลกองทุนจริงของตัวมันเอง
      // ไม่ใช่ synthetic insight แบบ Master Fund (Feeder) ด้านล่าง
      if (ent.kind === 'holder') {
        const gap = usesMockInsightData ? +(ent.perf - bench.ret).toFixed(1) : null
        return {
          id: ent.id,
          kind: 'holder',
          title: ent.title,
          subtitle: `${ent.amc}${ent.country ? ' · ' + ent.country : ''}`,
          perf: finiteNumber(ent.perf),
          gap,
          maxDrawdown: ent.fund.stats.maxdd,
          fee: ent.fund.fee,
          risk: ent.fund.risk,
          holdings: (ent.fund.top5 || [])
            .slice(0, 3)
            .map((h) => `${h.name} ${h.percent}%`)
            .join(' · '),
          fundCount: ent.fundCount,
          totalWeight: ent.totalWeight,
          series,
        }
      }

      if (!usesMockInsightData) {
        return {
          id: ent.id,
          kind: 'master',
          title: ent.title,
          subtitle: 'ข้อมูลรวมกองทุน Feeder จาก API',
          perf: finiteNumber(ent.perf),
          gap: null,
          maxDrawdown: avgMaxDrawdown(ent),
          characteristics: null,
          pe: null,
          pb: null,
          exposure: '',
          topTickers: '',
          aum: null,
          memberCount: ent.members.length,
          benchName: null,
          series: null,
        }
      }

      const insight = insightFor(ent)
      const gap = +(ent.perf - GLOBAL_RETURN).toFixed(1)
      const exposure = insight.top
        .slice(0, 3)
        .map((h) => `${h[0]} ${h[2]}%`)
        .join(' · ')
      const topTickers = insight.top.slice(0, 3).map((h) => h[1]).join(', ')

      return {
        id: ent.id,
        kind: 'master',
        title: insight.master.name,
        subtitle: insight.theme,
        perf: ent.perf,
        gap,
        maxDrawdown: avgMaxDrawdown(ent),
        characteristics: keyCharacteristics(insight),
        pe: insight.pe,
        pb: insight.pb,
        exposure,
        topTickers,
        aum: insight.master.aum,
        memberCount: ent.members.length,
        benchName: insight.bench,
        series,
      }
    }),
  )

  return {
    stock,
    bench,
    itemLabel,
    selectedEntities,
    maxSelected,
    cardsData,
  }
}
