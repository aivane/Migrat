import { computed } from 'vue'
import { useFundinfoRanking } from './useFundinfoRanking'
import { CMP_LABELS, checkpointSeries } from './useFundinfoThemeTrend'

// Section 3: Master Fund / Stock Comparison (deep-dive). Deliberately not built for
// 'mixed' (ported from a prototype that skipped it too). Reuses useFundinfoRanking(type)'s
// selection so this always matches what's picked in Section 2's Ranking Cards.

const GLOBAL_RETURN = 12.8
export const COMPARE_COLORS = ['#2456d8', '#0e9f6e', '#e0a411', '#7a5af5', '#e2557a', '#0891b2', '#f04438']
export const COMPARE_DASH = [[], [8, 3], [3, 2], [10, 3, 2, 3], [6, 2], [2, 2], [12, 3]]

const BENCHMARKS = {
  thai: { name: 'SET TRI', ret: 3.2, short: 'SET' },
  offshore: { name: 'MSCI ACWI', ret: GLOBAL_RETURN, short: 'Global' },
  feeder: { name: 'MSCI ACWI', ret: GLOBAL_RETURN, short: 'Global' },
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function averageFinite(values) {
  const validValues = values.map(finiteNumber).filter((value) => value !== null)
  if (!validValues.length) return null
  return +(validValues.reduce((sum, value) => sum + value, 0) / validValues.length).toFixed(1)
}

function avgMaxDrawdown(ent) {
  return averageFinite(ent.members.map((fund) => fund.stats?.maxdd))
}

// Master Fund AUM = sum of member funds' fund.aum (aum_m_thb is real; unlike P/E/P/B/benchmark).
function sumAum(members) {
  const finite = members.map((fund) => finiteNumber(fund.aum)).filter((value) => value !== null)
  if (!finite.length) return null
  const total = finite.reduce((sum, value) => sum + value, 0)
  return `฿${Math.round(total).toLocaleString('th-TH')} ล้านบ.`
}

export function useFundinfoInsight(type = 'feeder') {
  const stock = type === 'offshore' || type === 'thai'
  const bench = BENCHMARKS[type] || BENCHMARKS.feeder
  const itemLabel = stock ? (type === 'offshore' ? 'หุ้นต่างประเทศ' : 'หุ้นไทย') : type === 'feeder' ? 'Master Fund' : 'ธีมลงทุน'

  // instance เดียวกับที่ RankingCardsSection.vue (Section 2) ใช้ — เลือก/ถอดที่นั่นสะท้อนมาที่นี่ทันที
  const { selectedEntities, maxSelected } = useFundinfoRanking(type)

  const cardsData = computed(() =>
    selectedEntities.value.map((ent) => {
      // Stock entities come only from the real /stocks/top ranking now (mock STOCK_META path removed).
      if (ent.kind === 'stock') {
        const perf = finiteNumber(ent.return1y)
        // /stocks/top has no valuation/dividend/drawdown fields — kept null until the API adds them.
        return {
          id: ent.id,
          kind: 'stock',
          title: `${ent.ticker} · ${ent.name}`,
          subtitle: `${ent.sector} · ${ent.country}`,
          perf,
          gap: perf === null ? null : +(perf - bench.ret).toFixed(1),
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

      // Thai funds holding these stocks directly (see buildFundHolderEntities) — uses real
      // fund data, not the synthetic Master Fund aggregate below.
      if (ent.kind === 'holder') {
        const perf = finiteNumber(ent.perf)
        const benchReturn = finiteNumber(ent.fund.benchmarkReturn1y)
        const gap = perf === null || benchReturn === null ? null : +(perf - benchReturn).toFixed(1)
        return {
          id: ent.id,
          kind: 'holder',
          title: ent.title,
          subtitle: `${ent.amc}${ent.country ? ' · ' + ent.country : ''}`,
          perf,
          gap,
          maxDrawdown: ent.fund.stats.maxdd,
          fee: ent.fund.fee,
          risk: ent.fund.risk,
          // P/E, P/B exist in the schema but are null for every fund observed — kept nullable, not defaulted.
          pe: finiteNumber(ent.fund.peRatio),
          pb: finiteNumber(ent.fund.pbRatio),
          benchName: ent.fund.benchmarkName || null,
          holdings: (ent.fund.top5 || [])
            .slice(0, 3)
            .map((h) => `${h.name} ${h.percent}%`)
            .join(' · '),
          fundCount: ent.fundCount,
          totalWeight: ent.totalWeight,
          series: checkpointSeries(ent.fund.retPRaw),
        }
      }

      const perf = finiteNumber(ent.perf)
      const avgBenchReturn = averageFinite(ent.members.map((fund) => fund.benchmarkReturn1y))
      const benchName = ent.members.find((fund) => fund.benchmarkName)?.benchmarkName || null
      // Master Fund (feeder-target ETF) row — API has no direct endpoint, so every number
      // here is aggregated client-side from the Thai feeder funds tracking it (see sumAum/averageFinite).
      const subtitle = benchName
        ? `${benchName} · รวมจากกองทุนไทย ${ent.members.length} กอง`
        : `รวมจากกองทุนไทย ${ent.members.length} กองที่ลงทุนใน Master Fund นี้`
      return {
        id: ent.id,
        kind: 'master',
        title: ent.title,
        subtitle,
        perf,
        gap: perf === null || avgBenchReturn === null ? null : +(perf - avgBenchReturn).toFixed(1),
        maxDrawdown: avgMaxDrawdown(ent),
        characteristics: null,
        // Averaged across members — null while pe_ratio/pb_ratio are unpopulated API-side.
        pe: averageFinite(ent.members.map((fund) => fund.peRatio)),
        pb: averageFinite(ent.members.map((fund) => fund.pbRatio)),
        exposure: '',
        topTickers: '',
        aum: sumAum(ent.members),
        memberCount: ent.members.length,
        benchName,
        series: checkpointSeries(ent.retPRaw),
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
