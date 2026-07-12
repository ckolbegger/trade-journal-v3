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
