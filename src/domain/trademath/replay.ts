import type {
  ISODate,
  InstrumentKey,
  Mark,
  MarkSet,
  MarkSeries,
  ReplayPoint,
  TradeRecord,
} from './types'
import { positionOf } from './position'
import { buildInstrumentKey } from './instrument'
import { valuation } from './valuation'
import { riskReward } from './risk-reward'

// Replays a Trade's actual history: one ReplayPoint per marked date the Trade
// held quantity, each computed with knowledge as of that date only —
// Executions sliced to timestamp <= end of that date, so a partial close
// changes every LATER point's basis but never an earlier one (ADR 0009 —
// reflective only, nothing here ever looks forward).
//
// A date is a candidate at all only if the Trade held quantity going INTO it
// (as of the end of the PREVIOUS date) or held quantity BY the end of it —
// this is a per-date check, not a single [first,last] window, because a Leg
// closed flat may reopen later (TradeBook permits it): the flat interval in
// between renders nothing, the flatten day and the reopen day each still get
// their point, and a still-open Trade has no upper bound.
//
// A candidate date is a GAP — no point rendered, never bridged — when ANY
// instrument that date's as-of-that-date Trade actually HOLDS lacks its OWN
// Mark on that exact date (not its underlying's: `valuation`/`riskReward`
// never read a held Leg's underlying Mark to price that Leg — only
// `heldInstrumentsOf`'s broader "worth prompting for" set does, which is the
// wrong set here). Any-missing, not all-missing: every number on a
// ReplayPoint is computed together, so a partial point would misrepresent
// what was knowable that day.
export function replay(trade: TradeRecord, series: MarkSeries): ReplayPoint[] {
  const points: ReplayPoint[] = []
  for (const date of markedDatesOf(series)) {
    if (!heldOnOrInto(trade, date)) continue

    const asOf = tradeAsOf(trade, date)
    const marks = marksOnDate(series, date)
    const needed = requiredMarksOf(asOf)
    if (needed.some((key) => !marks.has(key))) continue // gap

    points.push({ date, valuation: valuation(asOf, marks), riskReward: riskReward(asOf, marks) })
  }
  return points
}

// Whether the Trade held any quantity either by the end of `date` or going
// INTO `date` (i.e. as of the end of the day before) — true on an ordinary
// held day, on the day a Leg flattens (still held going in), and on the day
// a flat Leg reopens (held by day's end), false everywhere else (before the
// first Execution, after a final flatten, and through a flat interval
// between a close and a later reopen).
function heldOnOrInto(trade: TradeRecord, date: ISODate): boolean {
  return (
    positionOf(trade, date).holdings.length > 0 ||
    positionOf(trade, prevISODate(date)).holdings.length > 0
  )
}

// Every instrument `trade` actually HOLDS, by its own InstrumentKey — the set
// `valuation`/`riskReward` read a Mark for to price what is currently open.
// Deliberately narrower than `heldInstrumentsOf` (valuation.ts), which also
// names a held option Leg's underlying — useful for "worth prompting for"
// (Valuations.marksNeeded) but wrong here: a fetched stock Mark alongside a
// manually-marked option contract is the NORMAL case (mixed origins), and
// requiring the underlying's Mark too would gap a fully-priced option history
// whenever the two happened to land on different collection cadences.
function requiredMarksOf(trade: TradeRecord): InstrumentKey[] {
  return positionOf(trade).holdings.map((h) => buildInstrumentKey(h.instrument))
}

// A copy of `trade` with every Leg's Executions sliced to those at or before
// the end of `date` — the only way `valuation`/`riskReward` can know what a
// date's knowledge looked like, since both read `trade.legs[].executions`
// directly.
function tradeAsOf(trade: TradeRecord, date: ISODate): TradeRecord {
  const cutoff = endOfLocalDay(date)
  return {
    ...trade,
    legs: trade.legs.map((leg) => ({
      ...leg,
      executions: leg.executions.filter((e) => e.timestamp <= cutoff),
    })),
  }
}

// Every date any instrument in `series` has a Mark for, date-ordered — the
// candidate dates a ReplayPoint might exist on.
function markedDatesOf(series: MarkSeries): ISODate[] {
  const dates = new Set<ISODate>()
  for (const marks of series.values()) {
    for (const mark of marks) dates.add(mark.date)
  }
  return [...dates].sort()
}

function marksOnDate(series: MarkSeries, date: ISODate): MarkSet {
  const set = new Map<InstrumentKey, Mark>()
  for (const [key, marks] of series) {
    const mark = marks.find((m) => m.date === date)
    if (mark) set.set(key, mark)
  }
  return set
}

// The calendar date before `date`, in UTC (a pure calendar-string operation,
// mirroring `nextISODate`'s convention in domain/dates.ts — duplicated here
// rather than imported, since domain/trademath imports nothing from
// elsewhere in src/, docs/plan/README.md).
function prevISODate(date: ISODate): ISODate {
  const [year, month, day] = date.split('-').map(Number)
  const ms = Date.UTC(year, month - 1, day) - 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

function endOfLocalDay(date: ISODate): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
}
