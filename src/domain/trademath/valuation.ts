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

interface LegTotals {
  openQty: number
  avgOpenPrice: number
  soldQty: number
  avgSellPrice: number
  fees: number
}

function totalsFor(leg: LegFacts): LegTotals {
  let boughtQty = 0
  let boughtCost = 0
  let soldQty = 0
  let soldProceeds = 0
  let fees = 0
  for (const e of leg.executions) {
    fees += e.fees
    if (e.side === 'buy') {
      boughtQty += e.qty
      boughtCost += e.qty * e.price
    } else {
      soldQty += e.qty
      soldProceeds += e.qty * e.price
    }
  }
  const avgOpenPrice = boughtQty === 0 ? 0 : boughtCost / boughtQty
  const avgSellPrice = soldQty === 0 ? 0 : soldProceeds / soldQty
  return { openQty: boughtQty - soldQty, avgOpenPrice, soldQty, avgSellPrice, fees }
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
    const grossRealized = t.soldQty * (t.avgSellPrice - t.avgOpenPrice) * multiplier
    const grossUnrealized = t.openQty * (markPrice - t.avgOpenPrice) * multiplier
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
    return sum + t.openQty * markPrice * contractMultiplierOf(leg.instrument)
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
