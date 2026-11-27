// Presentation-only helpers for the Daily Review composition. They read
// finished view data; no domain fact or calculation is introduced here.

const BAND_ORDER = ['Blocker', 'Boundary', 'EvidenceLimited', 'QuantifiedPressure', 'Routine']

export function daySummary(trades: number, marks: number, actions: number): string {
  return `${trades} Trades · ${marks} Marks, ${actions} Actions to go`
}

export function reviewSteps(taskKinds: string[]): ('now' | 'ok' | '')[] {
  const marksOpen = taskKinds.includes('Marks')
  const tradesOpen = taskKinds.includes('Trades')
  return [
    marksOpen ? 'now' : taskKinds.length ? 'ok' : '',
    !marksOpen && tradesOpen ? 'now' : '',
    !marksOpen && !tradesOpen && taskKinds.length ? 'now' : '',
  ]
}

export function orderReviewItems<T extends { band: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band))
}

export function meterPercent(
  price: string | undefined, stop: string, target: string,
): number | null {
  if (price === undefined || price === '') return null
  const low = Number(stop)
  const high = Number(target)
  const value = Number(price)
  if (![low, high, value].every(Number.isFinite) || high === low) return null
  return Math.max(0, Math.min(100, Number((((value - low) / (high - low)) * 100).toFixed(2))))
}
