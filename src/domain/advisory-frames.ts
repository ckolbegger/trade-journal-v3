import { resolveKey, type ObservationRecord } from './market-data'
import { resolveStrategyShape } from './strategy-shapes'
import type { OptionContract } from './option-contract'
import type { SessionSeries } from './session-series'
import { advisoryImpliedVolatility, type AdvisoryIvResult } from './advisory-iv'
import {
  advisoryShareEquivalent, priceMoveDecomposition,
  type AdvisoryFrame, type Decomposition, type ShareEquivalent,
} from './advisory-decomposition'

// D8aR R3 — the advisory frame assembly lives behind one domain interface.
// The formulas remain pure; exact contract resolution, the underlying join,
// days-to-expiration and side are no longer scattered in a UI adapter.
export type AdvisoryTradeInput = {
  strategyId?: string
  underlying: string
  plan: {
    underlying?: string
    quantity?: number
    contract?: OptionContract
    strategyId?: string
  }
}

export type AdvisoryFramesInput = {
  trade: AdvisoryTradeInput
  series: SessionSeries
  records: ObservationRecord[]
}

export type AdvisoryResult = {
  iv: AdvisoryIvResult | null
  shareEquivalent: ShareEquivalent | null
  decomposition: Decomposition | null
}

export function resolveContract(trade: AdvisoryTradeInput): OptionContract | undefined {
  // confirmOptionPlan freezes the Strategy id inside the Plan, not at the
  // Trade top level; both placements must resolve the same exact contract.
  const strategyId = trade.strategyId ?? trade.plan.strategyId
  return strategyId?.startsWith('seed-') && trade.plan.contract
    ? trade.plan.contract
    : undefined
}

function underlyingPrice(records: ObservationRecord[], underlying: string, date: string): string | undefined {
  const record = records.find(r => r.instrument === underlying && r.date === date)
  const resolution = resolveKey(record, date, records)
  return resolution.status === 'Available' ? resolution.price : undefined
}

function daysToExpiration(date: string, expiration?: string): number {
  if (!expiration) return 0
  return Math.max(0, Math.round((new Date(`${expiration}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000))
}

export function buildAdvisoryFrames(input: AdvisoryFramesInput): AdvisoryFrame[] {
  const { trade, series, records } = input
  const contract = resolveContract(trade)
  const shape = resolveStrategyShape(trade.strategyId ?? trade.plan.strategyId ?? '')
  const kind = contract?.kind ?? (shape.ok ? shape.value.expectedKind : 'Call')
  const underlying = trade.plan.underlying ?? trade.underlying
  return series.sessions.map(session => ({
    date: session.date,
    kind,
    mark: session.price,
    underlying: underlyingPrice(records, underlying, session.date) ?? '',
    strike: contract?.strike ?? '0',
    days: daysToExpiration(session.date, contract?.expiration),
    multiplier: contract?.multiplier ?? 100,
    quantity: trade.plan.quantity ?? 1,
    side: shape.ok && shape.value.openingAction === 'Sell' ? -1 : 1,
  }))
}

export function buildAdvisory(input: AdvisoryFramesInput & { installed: boolean }): AdvisoryResult | null {
  if (!input.installed) return null
  const frames = buildAdvisoryFrames(input).filter(f => f.mark !== undefined && f.underlying)
  const last = frames.at(-1)
  const previous = frames.at(-2)
  const inputOf = (frame: AdvisoryFrame) => ({
    kind: frame.kind, mark: frame.mark, underlying: frame.underlying,
    strike: frame.strike, days: frame.days,
  })
  return {
    iv: last ? advisoryImpliedVolatility(inputOf(last), true) : null,
    shareEquivalent: last ? advisoryShareEquivalent({ frame: last, installed: true }) : null,
    decomposition: last && previous
      ? priceMoveDecomposition({ before: previous, after: last, installed: true })
      : null,
  }
}
