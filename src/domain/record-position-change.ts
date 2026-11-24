import { derive, type ExecutionFact, type OpenLot } from './derive'
import {
  preparePositionChangeReflection, type ReflectionDisposition, type ReflectionOutcome,
} from './position-change-reflection'
import type { Result } from './types'

// TradeWorkflows.recordPositionChange — opening subset for a Long Stock Plan.
export type OpeningExecutionInput = {
  id: string
  instrument: string
  action: 'Buy'
  quantity: string
  price: string
  fee: string
  economicTime: string
  plannedLegId?: string
  explicitlyUnplanned?: boolean
}

export type PositionChangeCommand = {
  trade: {
    id: string
    lifecycle: string
    revision: string
    economicTime: string
    plan: {
      underlying: string
      quantity: number
      entry: string
      stop: string
      target: string
      oneR: string
      baseline: string
    }
  }
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: OpeningExecutionInput[]
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
}

export type OpenTradeProjection = {
  id: string
  lifecycle: 'Open'
  revision: string
  economicTime: string
  plan: PositionChangeCommand['trade']['plan']
  positionChangeId: string
  executions: ExecutionFact[]
  lots: OpenLot[]
  positions: { instrument: string; netQuantity: string; lotCount: number }[]
  realizedToDate: string
}

export type PositionChangeResult = {
  receipt: {
    tradeId: string
    factRevision: string
    positionChangeId: string
    executionIds: string[]
    lotIds: string[]
    lifecycleTransitions: string[]
    journalOutcomeId: string
    obligationKey: string
  }
  trade: OpenTradeProjection
  journalOutcome: ReflectionOutcome
  revisions: { trade: string; journal: string }
  postCommit: { trade: OpenTradeProjection; journalOutcome: ReflectionOutcome }
  affectedScopes: string[]
}

export function recordPositionChange(
  command: PositionChangeCommand,
): Result<PositionChangeResult, { issues: string[] }> {
  const issues: string[] = []
  if (command.expectedRevision !== command.trade.revision) issues.push('StaleRevision')
  if (command.trade.lifecycle !== 'Planned') issues.push('NotPlanned')
  if (command.executions.length === 0) issues.push('NoExecutions')

  for (const e of command.executions) {
    if (!e.plannedLegId && !e.explicitlyUnplanned) issues.push('MissingPlannedLegIntent')
    if (e.plannedLegId && e.instrument !== command.trade.plan.underlying) issues.push('InstrumentMismatch')
    try {
      const q = Number(e.quantity)
      const p = Number(e.price)
      const f = Number(e.fee)
      if (!Number.isFinite(q) || q <= 0 || !Number.isFinite(p) || p <= 0 || !Number.isFinite(f) || f < 0) {
        issues.push('InvalidExecution')
      }
    } catch {
      issues.push('InvalidExecution')
    }
  }

  const reflection = preparePositionChangeReflection({
    positionChangeId: command.positionChangeId,
    tradeId: command.trade.id,
    definitionRevision: command.reflection.definitionRevision,
    disposition: command.reflection.disposition,
  })
  if (!reflection.ok) issues.push(...reflection.error.issues.map(i => `Reflection:${i}`))

  if (issues.length) return { ok: false, error: { issues: [...new Set(issues)] } }

  const facts: ExecutionFact[] = command.executions.map((e, index) => ({
    id: e.id,
    tradeId: command.trade.id,
    positionChangeId: command.positionChangeId,
    instrument: e.instrument,
    action: e.action,
    quantity: e.quantity,
    price: e.price,
    fee: e.fee,
    economicTime: e.economicTime,
    recordedSequence: index + 1,
    ...(e.plannedLegId ? { plannedLegId: e.plannedLegId } : {}),
    ...(e.explicitlyUnplanned ? { explicitlyUnplanned: true } : {}),
  }))

  const revision = String(Number(command.trade.revision) + 1)
  const derivation = derive({
    tradeId: command.trade.id,
    storedLifecycle: 'Open',
    plan: command.trade.plan,
    executions: facts,
  })
  if (!derivation.ok) return { ok: false, error: { issues: derivation.error.issues } }

  const trade: OpenTradeProjection = {
    id: command.trade.id,
    lifecycle: 'Open',
    revision,
    economicTime: command.economicTime,
    plan: command.trade.plan,
    positionChangeId: command.positionChangeId,
    executions: facts,
    lots: derivation.value.lots,
    positions: derivation.value.positions,
    realizedToDate: derivation.value.realizedToDate,
  }

  const journalOutcome = reflection.value
  const journalOutcomeId = `${journalOutcome.kind === 'Decline' ? 'decline' : journalOutcome.kind}-${command.positionChangeId}`
  const result: PositionChangeResult = {
    receipt: {
      tradeId: trade.id,
      factRevision: revision,
      positionChangeId: command.positionChangeId,
      executionIds: facts.map(f => f.id),
      lotIds: trade.lots.map(l => l.id),
      lifecycleTransitions: ['Planned', 'Open'],
      journalOutcomeId,
      obligationKey: journalOutcome.obligationKey,
    },
    trade,
    journalOutcome,
    revisions: { trade: revision, journal: '1' },
    postCommit: { trade, journalOutcome },
    affectedScopes: ['trade-list', `trade:${trade.id}`, 'journal-timeline'],
  }
  return { ok: true, value: result }
}
