import type { ISODate, LegFacts, Position, TradeRecord } from './types'

// The net open quantity per Leg, derived from Executions (never stored, ADR
// 0005). A Leg that nets to zero holds nothing and is omitted. `asOf` bounds the
// Executions counted to a trading date: fills after that date are excluded.
// A negative net resolves to side 'short' (short Legs arrived with S3.2's
// sell-to-open).

function cutoffFor(asOf?: ISODate): number {
  return asOf === undefined ? Infinity : new Date(`${asOf}T23:59:59.999`).getTime()
}

function netQty(leg: LegFacts, cutoff: number): number {
  return leg.executions
    .filter((e) => e.timestamp <= cutoff)
    .reduce((net, e) => net + (e.side === 'buy' ? e.qty : -e.qty), 0)
}

export function positionOf(trade: TradeRecord, asOf?: ISODate): Position {
  const cutoff = cutoffFor(asOf)
  const holdings = trade.legs
    .map((leg) => ({ leg, net: netQty(leg, cutoff) }))
    .filter(({ net }) => net !== 0)
    .map(({ leg, net }) => ({
      instrument: leg.instrument,
      qty: Math.abs(net),
      side: net > 0 ? ('long' as const) : ('short' as const),
    }))
  return { holdings }
}
