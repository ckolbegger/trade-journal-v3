import Decimal from 'decimal.js'
import { expirationPayoff, type PayoffResult } from './expiration-payoff'
import { buildTradeNarrative, type NarrativeItem, type NarrativeRow } from './journal-narrative'
import { resolveStrategyShape } from './strategy-shapes'
import type { SessionPoint, SessionSeries } from './session-series'

// TradeViewsAndReporting.getTradeDetail(Complete). A read-only projection:
// it assembles already-persisted facts and never writes a fact or a draft.
export type CompleteDetailTrade = {
  id: string
  lifecycle: string
  revision: string
  strategyId?: string
  underlying: string
  oneR: string
  plan: { entry: string; stop: string; target: string }
  positions: { instrument: string; netQuantity: string; lotCount: number }[]
  lots: { id: string; instrument: string; quantity: string; basis: string; allocatedOpeningFee: string }[]
  executions: { id: string; instrument: string; action: string; quantity: string; price: string; fee: string; economicTime: string }[]
  realizedToDate: string
  fulfillment?: string
  deviations?: { category: string; fingerprint: string }[]
  agreement?: { lifecycle: boolean; lots: boolean; findings: string[] }
}

export type CompleteDetailInput = {
  trade: CompleteDetailTrade
  series: SessionSeries
  journalRows: NarrativeRow[]
  coverage: { instrument: string; date: string; status: string }
}

export type CompleteDetail = {
  identity: { tradeId: string; lifecycle: string; strategy: string; underlying: string; revision: string }
  todayAgainst: { entry: string; previous: string; current: string }
  stopsAndTargets: { stop: string; target: string }
  positionAndPlan: {
    plan: CompleteDetailTrade['plan']
    positions: CompleteDetailTrade['positions']
    lots: CompleteDetailTrade['lots']
    executions: CompleteDetailTrade['executions']
  }
  payoff: PayoffResult
  earlierMarks: SessionPoint[]
  journal: NarrativeItem[]
  needsYou: string[]
  timeline: SessionPoint[]
  gaps: string[]
  integrity: { agreement: boolean; findings: string[] }
  coverage: CompleteDetailInput['coverage']
  figures: {
    plannedLegFulfillment: string
    entryQuality: string
    realizedR: string
    deviations: {
      plannedLegTerms: number
      entrySize: number
      unplannedExposure: number
      stopDiscipline: number
    }
    planConformance: string
    coverage: string
  }
}

const FULFILLMENT_LABELS: Record<string, string> = {
  Unfilled: 'Unfilled',
  PartiallyFilled: 'Partially Filled',
  FilledAsPlanned: 'Filled As Planned',
  FilledWithDeviation: 'Filled With Deviation',
  NotEntered: 'Not Entered',
  NotVerifiable: 'Not Verifiable',
}

const ENTRY_QUALITY: Record<string, string> = {
  Unfilled: 'Not Entered',
  PartiallyFilled: 'Partial',
  FilledAsPlanned: 'As Planned',
  FilledWithDeviation: 'With Deviation',
  NotEntered: 'Not Entered',
  NotVerifiable: 'Not Verifiable',
}

export function buildCompleteTradeDetail(input: CompleteDetailInput): CompleteDetail {
  const { trade, series, journalRows, coverage } = input
  const shape = resolveStrategyShape(trade.strategyId ?? '')
  const available = series.sessions.filter(s => s.status === 'Available' && s.price !== undefined)
  const current = available.at(-1)?.price ?? trade.plan.entry
  const previous = available.at(-2)?.price ?? trade.plan.entry

  const payoff = expirationPayoff({ view: 'Planned', legs: [], stockOnly: true })
  const journal = buildTradeNarrative(
    journalRows, trade.id, trade.executions.map(e => e.id),
  )
  const needsYou = journalRows
    .filter(r => r.kind === 'Debt' && r.status !== 'Settled' && r.obligationKey)
    .map(r => r.obligationKey!)

  const counts = {
    plannedLegTerms: 0, entrySize: 0, unplannedExposure: 0,
    stopDiscipline: series.episodes.length,
  }
  for (const deviation of trade.deviations ?? []) {
    if (deviation.category === 'PlannedLegTerms') counts.plannedLegTerms += 1
    if (deviation.category === 'EntrySize') counts.entrySize += 1
    if (deviation.category === 'UnplannedExposure') counts.unplannedExposure += 1
  }
  const totalDeviations = Object.values(counts).reduce((sum, n) => sum + n, 0)
  const oneR = new Decimal(trade.oneR ?? '0')
  const realizedR = oneR.gt(0)
    ? new Decimal(trade.realizedToDate).div(oneR).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
    : '0.00'

  let planConformance = 'Conformed'
  if (trade.fulfillment === 'NotVerifiable') planConformance = 'Not Verifiable'
  else if (totalDeviations > 0) planConformance = 'With Deviations'

  return {
    identity: {
      tradeId: trade.id, lifecycle: trade.lifecycle,
      strategy: shape.ok ? shape.value.label : 'Long Stock',
      underlying: trade.underlying, revision: trade.revision,
    },
    todayAgainst: { entry: trade.plan.entry, previous, current },
    stopsAndTargets: { stop: trade.plan.stop, target: trade.plan.target },
    positionAndPlan: {
      plan: trade.plan, positions: trade.positions,
      lots: trade.lots, executions: trade.executions,
    },
    payoff,
    earlierMarks: series.sessions,
    journal,
    needsYou,
    timeline: series.sessions,
    gaps: series.gaps,
    integrity: {
      agreement: (trade.agreement?.findings.length ?? 0) === 0,
      findings: trade.agreement?.findings ?? [],
    },
    coverage,
    figures: {
      plannedLegFulfillment: FULFILLMENT_LABELS[trade.fulfillment ?? 'Unfilled'] ?? 'Unfilled',
      entryQuality: ENTRY_QUALITY[trade.fulfillment ?? 'Unfilled'] ?? 'Not Entered',
      realizedR,
      deviations: counts,
      planConformance,
      coverage: coverage.status,
    },
  }
}
