export function formatCompact(value) {
  const number = Number(value || 0)
  const abs = Math.abs(number)
  if (abs >= 1e12) return `${(number / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(number / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(number / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `${(number / 1e3).toFixed(0)}K`
  return number.toFixed(0)
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US')
}

export function formatPercent(value, digits = 2) {
  const number = Number(value || 0)
  return `${number >= 0 ? '+' : ''}${number.toFixed(digits)}%`
}

export function riskClass(risk) {
  if (risk <= 3) return 'risk-low'
  if (risk <= 5) return 'risk-medium'
  return 'risk-high'
}
