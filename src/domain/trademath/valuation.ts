import type {
  InstrumentKey,
  LegFacts,
  LegValuation,
  MarkSet,
  TradeRecord,
  Valuation,
} from './types'
import { buildInstrumentKey, underlyingKeyOf } from './instrument'
import { contractMultiplierOf } from './multiplier'

// Pure valuation math over a TradeRecord and a MarkSet. Fees: realized P&L is net
// of every fee on the Trade; unrealized is gross; totalPnL = realized + unrealized
// (docs/plan/README.md decided semantics). currentValue is the signed structure
// value at these Marks. Single fill open → single fill close this slice — basis is
// the average opening price, no FIFO Lots (that refactor arrives in Slice 5,
// behind these tests). Option Legs value at the contract multiplier (100),
// keyed off instrument kind — never in the UI.

// Thrown when a held instrument has no Mark in the MarkSet — the coordinator turns
// this into the "enter a Mark" prompt (Valuations.detail); TradeMath never guesses
// a price.
export class MissingMarkError extends Error {
  constructor(public instruments: InstrumentKey[]) {
    super(`No Mark for held instrument(s): ${instruments.join(', ')}`)
    this.name = 'MissingMarkError'
  }
}

// Every instrument the Trade needs Marks for (legs + underlyings). An option Leg
// also needs its underlying's Mark (underlyingPrice Exit Levels and IV read it) —
// a stock Leg's key is already its own underlying.
export function instrumentsOf(trade: TradeRecord): InstrumentKey[] {
  const keys = trade.legs.flatMap((leg) => {
    const key = buildInstrumentKey(leg.instrument)
    return leg.instrument.kind === 'option' ? [key, underlyingKeyOf(key)] : [key]
  })
  return [...new Set(keys)]
}

// The instruments a Trade still needs Marks for going forward: held Legs only —
// a flat Leg (e.g. an assigned Trade's expired option) values at zero and
// prompts for nothing — plus a held option Leg's underlying. The same held
// filter `valuation` applies to missing-Mark detection; what `marksNeeded`
// reads (user ruling 2026-07-16).
export function heldInstrumentsOf(trade: TradeRecord): InstrumentKey[] {
  const keys = trade.legs
    .filter((leg) => totalsFor(leg).openQty !== 0)
    .flatMap((leg) => {
      const key = buildInstrumentKey(leg.instrument)
      return leg.instrument.kind === 'option' ? [key, underlyingKeyOf(key)] : [key]
    })
  return [...new Set(keys)]
}

// A Leg opens in whichever direction its FIRST Execution takes (long-only or
// short-only this slice — no flip mid-Leg): `sign` +1 for a bought-first (long)
// Leg, -1 for a sold-first (short) Leg. `openQty`/`avgOpenPrice` describe the
// remaining open quantity and its entry price; `closedQty`/`avgClosePrice`
// describe what has been closed against it, direction-agnostic (a "close" is
// just whichever side isn't `sign`'s opening side).
interface LegTotals {
  sign: 1 | -1
  openQty: number
  avgOpenPrice: number
  closedQty: number
  avgClosePrice: number
  fees: number
}

function totalsFor(leg: LegFacts): LegTotals {
  if (leg.executions.length === 0) {
    return { sign: 1, openQty: 0, avgOpenPrice: 0, closedQty: 0, avgClosePrice: 0, fees: 0 }
  }
  const openSide = leg.executions[0].side
  const sign = openSide === 'buy' ? 1 : -1
  let openedQty = 0
  let openedCost = 0
  let closedQty = 0
  let closedProceeds = 0
  let fees = 0
  for (const e of leg.executions) {
    fees += e.fees
    if (e.side === openSide) {
      openedQty += e.qty
      openedCost += e.qty * e.price
    } else {
      closedQty += e.qty
      closedProceeds += e.qty * e.price
    }
  }
  const avgOpenPrice = openedQty === 0 ? 0 : openedCost / openedQty
  const avgClosePrice = closedQty === 0 ? 0 : closedProceeds / closedQty
  return { sign, openQty: openedQty - closedQty, avgOpenPrice, closedQty, avgClosePrice, fees }
}

export function valuation(trade: TradeRecord, marks: MarkSet): Valuation {
  const missing = instrumentsOf(trade).filter((key) => {
    const held = trade.legs.some(
      (leg) => buildInstrumentKey(leg.instrument) === key && totalsFor(leg).openQty !== 0,
    )
    return held && !marks.has(key)
  })
  if (missing.length > 0) throw new MissingMarkError(missing)

  const perLeg: LegValuation[] = trade.legs.map((leg) => {
    const t = totalsFor(leg)
    const key = buildInstrumentKey(leg.instrument)
    const markPrice = marks.get(key)?.price ?? 0
    const multiplier = contractMultiplierOf(leg.instrument)
    const grossRealized = t.sign * t.closedQty * (t.avgClosePrice - t.avgOpenPrice) * multiplier
    const grossUnrealized = t.sign * t.openQty * (markPrice - t.avgOpenPrice) * multiplier
    return {
      instrument: leg.instrument,
      basis: t.openQty * t.avgOpenPrice * multiplier,
      realized: grossRealized - t.fees,
      unrealized: grossUnrealized,
    }
  })

  const currentValue = trade.legs.reduce((sum, leg) => {
    const t = totalsFor(leg)
    const markPrice = marks.get(buildInstrumentKey(leg.instrument))?.price ?? 0
    return sum + t.sign * t.openQty * markPrice * contractMultiplierOf(leg.instrument)
  }, 0)

  const realizedPnL = perLeg.reduce((sum, l) => sum + l.realized, 0)
  const unrealizedPnL = perLeg.reduce((sum, l) => sum + l.unrealized, 0)
  const fees = trade.legs.reduce((sum, leg) => sum + totalsFor(leg).fees, 0)

  return {
    realizedPnL,
    unrealizedPnL,
    totalPnL: realizedPnL + unrealizedPnL,
    fees,
    currentValue,
    perLeg,
  }
}
