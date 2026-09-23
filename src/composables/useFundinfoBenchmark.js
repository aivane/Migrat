import { computed } from 'vue'
import { useFundinfoStore } from '../stores/fundinfoStore'

// 13 points — matches CMP_LABEL_COUNT in useFundinfoThemeTrend.js. Kept as its
// own constant (not imported) so this file never needs to import from
// useFundinfoThemeTrend.js, which itself imports this file — avoids a
// circular import between the two.
const CMP_LABEL_COUNT = 13

// Real market/index benchmarks (/api/v1/benchmarks/list + .../history), added
// by the backend 2026-09-11 — replaces the fabricated performanceSeries()
// line and hardcoded 3.2/12.8/5.4 returns removed 2026-09-10. See
// [[project-fundinfo-known-gaps]] for the full history of this gap.
const BENCHMARK_ID_BY_TYPE = {
  thai: 'SET_INDEX',
  offshore: 'MSCI_ACWI',
  feeder: 'MSCI_ACWI',
  mixed: 'PORT_60_40',
}

// Shown while the real name is loading (or if the API is briefly down) — not
// a fabricated number, just the label the real benchmark is expected to carry.
const FALLBACK_NAME_BY_TYPE = {
  thai: 'SET Index',
  offshore: 'MSCI ACWI',
  feeder: 'MSCI ACWI',
  mixed: 'Global 60/40 Portfolio',
}

const CMP_STEP_DAYS = 365 / 12 // matches useFundinfoThemeTrend.js's checkpointSeries spacing

// Real daily closes -> the same "today = 100, walk backward" indexed series
// checkpointSeries() builds from checkpoint returns, but sampled from actual
// daily prices instead of interpolating between a handful of anchors.
export function benchmarkSeries(history, n = CMP_LABEL_COUNT) {
  if (!Array.isArray(history) || history.length < 2) return null

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date))
  const latestClose = sorted[sorted.length - 1].close
  const todayMs = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  const series = []
  for (let i = 0; i < n; i++) {
    const targetMs = todayMs - (n - 1 - i) * CMP_STEP_DAYS * dayMs
    // nearest point at/before the target date; falls back to the earliest point available
    let point = sorted[0]
    for (const candidate of sorted) {
      if (new Date(candidate.date).getTime() > targetMs) break
      point = candidate
    }
    series.push(+(100 * (point.close / latestClose)).toFixed(1))
  }
  return series
}

export function useFundinfoBenchmark(type) {
  const store = useFundinfoStore()
  const benchmarkId = BENCHMARK_ID_BY_TYPE[type] || BENCHMARK_ID_BY_TYPE.feeder

  store.loadBenchmarks()
  store.loadBenchmarkHistory(benchmarkId)

  const meta = computed(() => store.getBenchmarkById(benchmarkId))

  // {name, ret} as one object so templates can keep using bench.name/bench.ret
  // the same way they did with the old hardcoded BENCHMARKS/BENCH constants.
  const bench = computed(() => ({
    name: meta.value?.name || FALLBACK_NAME_BY_TYPE[type] || FALLBACK_NAME_BY_TYPE.feeder,
    ret: meta.value?.return1y ?? null,
  }))

  const series = computed(() => benchmarkSeries(store.getBenchmarkHistory(benchmarkId)))

  return { benchmarkId, bench, series }
}
