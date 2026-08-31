import { computed } from 'vue'
import { useFundinfoRanking } from './useFundinfoRanking'
import { CMP_LABELS, checkpointSeries } from './useFundinfoThemeTrend'

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

// AUM รวมของ Master Fund (feeder) มาจากการรวม fund.aum (ล้านบาท) ของกองทุนสมาชิกทุกตัว —
// API /funds/list มี field นี้จริง (aum_m_thb) ต่างจาก P/E, P/B, benchmark index ที่ไม่มี
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
      // Stock entities only ever come from the real /stocks/top ranking now
      // (see buildApiStockRankEntities in useFundinfoRanking.js) — the
      // STOCK_META-only mock entity path is gone.
      if (ent.kind === 'stock') {
        const perf = finiteNumber(ent.return1y)
        // /stocks/top still has no valuation (P/E, P/B) or dividend/drawdown
        // fields — pe/pb/div/maxDrawdown stay null until the API adds them.
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

      // กองทุนไทยที่ถือหุ้นเหล่านี้โดยตรง (เลือกมาจาก Ranking Card ชุดเดียวกับหุ้น — ดู
      // buildFundHolderEntities ใน useFundinfoRanking.js) ใช้ข้อมูลกองทุนจริงของตัวมันเอง
      // ไม่ใช่ synthetic insight แบบ Master Fund (Feeder) ด้านล่าง
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
          // P/E, P/B exist in the API schema but are still null for every
          // fund observed — kept null-aware, not defaulted, so this becomes
          // real automatically once the backend populates them.
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
      // This row is a Master Fund (feeder-target ETF) — the API has no
      // endpoint for it directly, so every number here is aggregated
      // client-side from the Thai feeder funds that track it (see
      // sumAum/averageFinite above). Say that plainly instead of the old
      // generic "ข้อมูลรวมกองทุน Feeder จาก API" placeholder, which read the
      // same on every row and didn't explain what was actually being shown.
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
        // Averaged across member funds — still null while pe_ratio/pb_ratio
        // are unpopulated API-side (see fundinfoApi.js normalizeFund).
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
