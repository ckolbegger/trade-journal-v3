import Decimal from 'decimal.js'
import type { PayoffResult } from '../domain/expiration-payoff'

// Presentation-only helpers. They turn already-derived domain results into
// drawable geometry and comparison rows; no new fact or calculation is added.
export type TrackBounds = { min: number; max: number }
export type ComparisonRow = { label: string; previous: string; today: string; change: string }
export type Drawer = 'Today' | 'Position' | 'Plan and Risk' | 'Price History' | 'Journal' | 'Payoff'

// The prototype's C state suppresses every drawer whose content is derived
// from facts that cannot be replayed. Position, the plan and the journal are
// the evidence that explains the finding, so they remain available.
export const ALL_DRAWERS: Drawer[] = [
  'Today', 'Position', 'Plan and Risk', 'Price History', 'Journal', 'Payoff',
]
const DERIVED_DRAWERS: Drawer[] = ['Today', 'Price History', 'Payoff']

export function visibleDrawers(agreement: boolean): Drawer[] {
  return agreement ? ALL_DRAWERS : ALL_DRAWERS.filter(d => !DERIVED_DRAWERS.includes(d))
}

// A Mark only exists when a session actually resolved. The read's fallback to
// the plan entry must never be shown as an observed Mark.
export function hasObservedMark(
  sessions: { status: string; price?: string }[],
): boolean {
  return sessions.some(s => s.status === 'Available' && s.price !== undefined)
}

export function trackBounds(values: (string | undefined)[]): TrackBounds {
  const numbers = values.map(v => Number(v)).filter(n => Number.isFinite(n))
  if (numbers.length === 0) return { min: 0, max: 1 }
  const min = Math.min(...numbers)
  const max = Math.max(...numbers)
  return max > min ? { min, max } : { min: min - 1, max: max + 1 }
}

export function trackPercent(value: number, bounds: TrackBounds): number {
  if (!Number.isFinite(value)) return 0
  const span = bounds.max - bounds.min
  if (span <= 0) return 0
  const pct = ((value - bounds.min) / span) * 100
  return Math.max(0, Math.min(100, Number(pct.toFixed(2))))
}

export function comparisonRows(
  todayAgainst: { entry: string; previous: string; current: string },
  breakEven?: string,
): ComparisonRow[] {
  const previous = Number(todayAgainst.previous)
  const current = Number(todayAgainst.current)
  const change = Number.isFinite(previous) && Number.isFinite(current)
    ? (current - previous).toFixed(2)
    : '—'
  return [
    { label: 'Entry', previous: '—', today: todayAgainst.entry, change: '—' },
    { label: 'Mark', previous: todayAgainst.previous, today: todayAgainst.current, change },
    { label: 'Payoff break-even', previous: '—', today: breakEven ?? '—', change: '—' },
  ]
}

export function payoffPolyline(payoff: PayoffResult, toX: number): string | null {
  if (payoff.kind !== 'Value') return null
  const points: string[] = []
  for (const segment of payoff.value.segments) {
    const from = new Decimal(segment.from)
    const to = segment.to === 'Infinity' ? new Decimal(toX) : new Decimal(segment.to)
    if (to.lt(from)) continue
    const slope = new Decimal(segment.slope)
    const intercept = new Decimal(segment.intercept)
    for (const x of [from, to]) {
      const y = slope.times(x).plus(intercept)
      points.push(`${x.toString()},${y.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString()}`)
    }
  }
  return points.join(' ')
}
