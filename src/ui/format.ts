// Money is integer cents in the domain; the UI formats to dollars only for
// display and parses dollar input back to whole cents.

export function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function dollarsToCents(dollars: string): number {
  return Math.round(parseFloat(dollars) * 100)
}

// The trader's local date is the trading date (no timezone math in v1).
function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

// `days` calendar days before today, in the trader's local date.
export function daysAgoISO(days: number): string {
  return toISODate(new Date(Date.now() - days * 24 * 60 * 60 * 1000))
}

// An Execution's trading date, read back from its epoch-ms timestamp.
export function timestampToISODate(timestamp: number): string {
  return toISODate(new Date(timestamp))
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

// An ISODate ('YYYY-MM-DD') rendered compactly for inline display, e.g. "Jul 3".
export function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number)
  return `${SHORT_MONTHS[month - 1]} ${day}`
}

// An option contract rendered for display, e.g. "AAPL Jun'27 200C" — display-only
// formatting (the contract multiplier and canonical InstrumentKey stay in
// TradeMath; this never feeds a computation).
export function optionLabel(instrument: {
  ticker: string
  expiration: string
  type: 'call' | 'put'
  strike: number
}): string {
  const [year, month] = instrument.expiration.split('-').map(Number)
  const strike =
    instrument.strike % 100 === 0
      ? String(instrument.strike / 100)
      : (instrument.strike / 100).toFixed(2)
  const typeChar = instrument.type === 'call' ? 'C' : 'P'
  return `${instrument.ticker} ${SHORT_MONTHS[month - 1]}'${String(year).slice(2)} ${strike}${typeChar}`
}
