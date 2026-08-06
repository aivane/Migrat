/**
 * Lightweight CSV reader for the Fundinfo data files.
 *
 * The CSV files stay editable by non-developers, while this module normalizes
 * their values for the components that already consume the fund object shape.
 */
function parseCsvRows(csv) {
  const rows = []
  let cell = ''
  let row = []
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    const next = csv[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function toNumber(value, fallback = 0) {
  const number = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(number) ? number : fallback
}

function toPairs(value) {
  return String(value ?? '')
    .split('|')
    .filter(Boolean)
    .map((item) => {
      const delimiter = item.lastIndexOf(':')
      return {
        name: delimiter === -1 ? item.trim() : item.slice(0, delimiter).trim(),
        percent: toNumber(delimiter === -1 ? 0 : item.slice(delimiter + 1)),
      }
    })
}

function toList(value) {
  return String(value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function fundRowsFromCsv(csv, type) {
  const [headers = [], ...rows] = parseCsvRows(csv)

  return rows
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])))
    .filter((row) => row.id)
    .map((row) => ({
      id: row.id,
      type,
      name: row.name,
      amc: row.amc,
      amcShort: row.amcShort,
      risk: toNumber(row.risk, 6),
      fee: toNumber(row.fee),
      div: toNumber(row.div),
      active: row.active === '' ? undefined : toNumber(row.active),
      country: row.country,
      master: row.master,
      asset: toPairs(row.asset),
      top5: toPairs(row.top5),
      themes: toList(row.themes),
      netbuy: toNumber(row.netbuy),
      perf: toNumber(row.perf),
      pop: toNumber(row.pop),
      nav: toNumber(row.nav),
      aum: toNumber(row.aum),
      group: row.group,
      taxBenefit: row.taxBenefit,
      minInvestment: toNumber(row.minInvestment),
      fxHedging: row.fxHedging,
      geography: toList(row.geography),
      megatrend: toList(row.megatrend),
      style: row.style,
      csvStats: {
        sd: toNumber(row.sd),
        sharpe: toNumber(row.sharpe),
        maxDrawdown: toNumber(row.maxDrawdown),
      },
    }))
}
