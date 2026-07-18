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
// value at these Marks. Partial closes consume the oldest Lot first (FIFO, ADR
// 0015) — basis, avgCost, and realized all come off the Lots remaining after
// every closing Execution to date, which is what makes realized P&L reproducible
// from the Execution record alone. Option Legs value at the contract multiplier
// (100), keyed off instrument kind — never in the UI.

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
    .filter((leg) => openQtyOf(stateFor(leg)) !== 0)
    .flatMap((leg) => {
      const key = buildInstrumentKey(leg.instrument)
      return leg.instrument.kind === 'option' ? [key, underlyingKeyOf(key)] : [key]
    })
  return [...new Set(keys)]
}

// A Lot is the REMAINING quantity+price of one opening Execution not yet
// consumed by a closing Execution (ADR 0015) — carries basis only, never fees
// (all fees net as incurred, README's Fees bullet). A partial close consumes
// the oldest Lot(s) first (FIFO); a Lot drained to qty 0 drops out of the
// queue.
interface Lot {
  qty: number
  price: number
}

// A Leg opens in whichever direction its FIRST Execution takes (long-only or
// short-only this slice — no flip mid-Leg): `sign` +1 for a bought-first
// (long) Leg, -1 for a sold-first (short) Leg. `lots` is what remains open,
// oldest first, after every closing Execution to date has consumed the
// oldest Lot(s) FIFO. `grossRealized` is the running per-unit gain/loss
// across every closing Execution (no contract multiplier, no fees applied —
// the caller does both once, at the end): for each unit consumed,
// `sign * (closePrice - lotPrice)`, summed lot-by-lot as FIFO walks across a
// close that spans more than one Lot (S5.2's worked-example sell of 120 spans
// Lot A fully and 20 of Lot B). `fees` is every fee on the Leg to date.
interface LegState {
  sign: 1 | -1
  lots: Lot[]
  grossRealized: number
  fees: number
}

function stateFor(leg: LegFacts): LegState {
  if (leg.executions.length === 0) {
    return { sign: 1, lots: [], grossRealized: 0, fees: 0 }
  }
  const openSide = leg.executions[0].side
  const sign = openSide === 'buy' ? 1 : -1
  const lots: Lot[] = []
  let grossRealized = 0
  let fees = 0

  for (const e of leg.executions) {
    fees += e.fees
    if (e.side === openSide) {
      lots.push({ qty: e.qty, price: e.price })
      continue
    }
    let remaining = e.qty
    while (remaining > 0) {
      const lot = lots[0]
      const consumed = Math.min(lot.qty, remaining)
      grossRealized += sign * consumed * (e.price - lot.price)
      lot.qty -= consumed
      remaining -= consumed
      if (lot.qty === 0) lots.shift()
    }
  }

  return { sign, lots, grossRealized, fees }
}

// The open quantity a Leg's remaining Lots represent — what's still held
// after every FIFO consumption to date.
function openQtyOf(state: LegState): number {
  return state.lots.reduce((sum, l) => sum + l.qty, 0)
}

export function valuation(trade: TradeRecord, marks: MarkSet): Valuation {
  const missing = instrumentsOf(trade).filter((key) => {
    const held = trade.legs.some(
      (leg) => buildInstrumentKey(leg.instrument) === key && openQtyOf(stateFor(leg)) !== 0,
    )
    return held && !marks.has(key)
  })
  if (missing.length > 0) throw new MissingMarkError(missing)

  const perLeg: LegValuation[] = trade.legs.map((leg) => {
    const s = stateFor(leg)
    const key = buildInstrumentKey(leg.instrument)
    const markPrice = marks.get(key)?.price ?? 0
    const multiplier = contractMultiplierOf(leg.instrument)
    const openQty = openQtyOf(s)
    const openCost = s.lots.reduce((sum, l) => sum + l.qty * l.price, 0)
    const avgOpenPrice = openQty === 0 ? 0 : openCost / openQty
    const grossUnrealized = s.sign * openQty * (markPrice - avgOpenPrice) * multiplier
    return {
      instrument: leg.instrument,
      basis: openCost * multiplier,
      avgCost: avgOpenPrice,
      realized: s.grossRealized * multiplier - s.fees,
      unrealized: grossUnrealized,
    }
  })

  const currentValue = trade.legs.reduce((sum, leg) => {
    const s = stateFor(leg)
    const markPrice = marks.get(buildInstrumentKey(leg.instrument))?.price ?? 0
    return sum + s.sign * openQtyOf(s) * markPrice * contractMultiplierOf(leg.instrument)
  }, 0)

  const realizedPnL = perLeg.reduce((sum, l) => sum + l.realized, 0)
  const unrealizedPnL = perLeg.reduce((sum, l) => sum + l.unrealized, 0)
  const fees = trade.legs.reduce((sum, leg) => sum + stateFor(leg).fees, 0)

  return {
    realizedPnL,
    unrealizedPnL,
    totalPnL: realizedPnL + unrealizedPnL,
    fees,
    currentValue,
    perLeg,
  }
}
