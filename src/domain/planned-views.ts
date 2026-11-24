import type { ConfirmPlanResult } from './confirm-plan'

type ConfirmedTrade = ConfirmPlanResult['value']

export function browsePlannedTrades(trades: ConfirmedTrade[]) {
  return trades.map(t => ({
    id: t.trade.id,
    underlying: t.trade.plan.underlying,
    baseline: t.trade.plan.baseline,
    entryReadiness: 'Ready',
    lifecycle: t.trade.lifecycle,
  }))
}

export function getPlannedTradeDetail(trade: ConfirmedTrade | undefined) {
  if (!trade) return { status: 'NotFound' as const }
  return {
    status: 'Ready' as const,
    id: trade.trade.id,
    lifecycle: trade.trade.lifecycle,
    oneR: trade.trade.plan.oneR,
    plan: trade.trade.plan,
    reflection: trade.entry.snapshot,
    economicTime: trade.trade.economicTime,
  }
}
