import type { LegFacts, TradeRecord, TradeStatus } from './types'

// Status is always derived from the Trade's facts, never stored (ADR 0005):
//   planned — no Executions, no Close Reason (intent captured, nothing entered)
//   closed  — no Executions but a Close Reason (an abandoned plan), or
//             Executions exist and every Leg nets to zero (fully exited)
//   open    — any Leg still holds nonzero net quantity

function netQty(leg: LegFacts): number {
  return leg.executions.reduce((net, e) => net + (e.side === 'buy' ? e.qty : -e.qty), 0)
}

export function statusOf(trade: TradeRecord): TradeStatus {
  const hasExecutions = trade.legs.some((leg) => leg.executions.length > 0)
  if (!hasExecutions) {
    return trade.closeReason ? 'closed' : 'planned'
  }
  return trade.legs.some((leg) => netQty(leg) !== 0) ? 'open' : 'closed'
}
