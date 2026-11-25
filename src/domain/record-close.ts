import { derive, type ClosingLotMatch, type ExecutionFact, type OpenLot } from './derive'
import {
  deriveCloseReasonRequirement, deriveTerminalDisposition, resolveCloseReason,
  type ResolvedCloseReason, type SeededReason, type TerminalDisposition,
} from './close'
import {
  preparePositionChangeReflection, type ReflectionDisposition, type ReflectionOutcome,
} from './position-change-reflection'
import type { Result } from './types'

// TradeWorkflows.recordPositionChange — terminal Long Stock subset. The one
// decision closes remaining exposure with a resolved Close Reason and a
// Position Change Reflection; Close Review is a separate later obligation.
export type ClosingExecutionInput = {
  id: string
  instrument: string
  quantity: string
  price: string
  fee: string
  economicTime: string
}

export type CloseCommand = {
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
    executions: ExecutionFact[]
    lots: OpenLot[]
  }
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: ClosingExecutionInput[]
  closeReason: string
  catalog: { closeReasons: SeededReason[] } | undefined
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
}

export type ClosedTradeProjection = {
  id: string
  lifecycle: 'Closed'
  revision: string
  economicTime: string
  plan: CloseCommand['trade']['plan']
  positionChangeId: string
  executions: ExecutionFact[]
  lots: OpenLot[]
  lotMatches: ClosingLotMatch[]
  positions: { instrument: string; netQuantity: string; lotCount: number }[]
  realizedToDate: string
  closeReason: ResolvedCloseReason
  terminalDisposition: TerminalDisposition
  closeReasonRequirement: string
  agreement: { lifecycle: boolean; lots: boolean; findings: string[] }
}

export type CloseResult = {
  receipt: {
    tradeId: string
    factRevision: string
    positionChangeId: string
    executionIds: string[]
    lotIds: string[]
    matchIds: string[]
    lifecycleTransitions: string[]
    journalOutcomeId: string
    obligationKey: string
    closeReason: ResolvedCloseReason
    realizedToDate: string
    terminalDisposition: TerminalDisposition
  }
  trade: ClosedTradeProjection
  journalOutcome: ReflectionOutcome
  revisions: { trade: string; journal: string }
  postCommit: { trade: ClosedTradeProjection; journalOutcome: ReflectionOutcome }
  affectedScopes: string[]
}

export function recordClose(command: CloseCommand): Result<CloseResult, { issues: string[] }> {
  const issues: string[] = []
  if (command.expectedRevision !== command.trade.revision) issues.push('StaleRevision')
  if (command.trade.lifecycle !== 'Open') issues.push('NotOpen')
  if (command.executions.length === 0) issues.push('NoExecutions')

  for (const e of command.executions) {
    if (e.instrument !== command.trade.plan.underlying) issues.push('InstrumentMismatch')
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

  const reason = resolveCloseReason(command.closeReason, command.catalog)
  if (!reason.ok) issues.push(reason.error.issue)

  const reflection = preparePositionChangeReflection({
    positionChangeId: command.positionChangeId,
    tradeId: command.trade.id,
    definitionRevision: command.reflection.definitionRevision,
    disposition: command.reflection.disposition,
  })
  if (!reflection.ok) issues.push(...reflection.error.issues.map(i => `Reflection:${i}`))

  if (issues.length) return { ok: false, error: { issues: [...new Set(issues)] } }
  if (!reason.ok) return { ok: false, error: { issues: ['CloseReasonMissing'] } }

  // Check agreement against the facts as they stood before this terminal
  // change. Comparing stored open Lots with the post-close (empty) set would
  // manufacture a disagreement on every legitimate close.
  const preClose = derive({
    tradeId: command.trade.id,
    storedLifecycle: 'Open',
    plan: command.trade.plan,
    executions: command.trade.executions,
    storedLots: command.trade.lots,
  })
  if (preClose.ok && preClose.value.agreement.findings.length) {
    return { ok: false, error: { issues: preClose.value.agreement.findings } }
  }

  const maxSequence = command.trade.executions.reduce((max, f) => Math.max(max, f.recordedSequence), 0)
  const closingFacts: ExecutionFact[] = command.executions.map((e, index) => ({
    id: e.id,
    tradeId: command.trade.id,
    positionChangeId: command.positionChangeId,
    instrument: e.instrument,
    action: 'Sell',
    quantity: e.quantity,
    price: e.price,
    fee: e.fee,
    economicTime: e.economicTime,
    recordedSequence: maxSequence + index + 1,
  }))
  const facts = [...command.trade.executions, ...closingFacts]
  const derivation = derive({
    tradeId: command.trade.id,
    storedLifecycle: 'Closed',
    plan: command.trade.plan,
    executions: facts,
    storedLots: [],
  })
  if (!derivation.ok) return { ok: false, error: { issues: derivation.error.issues } }
  if (derivation.value.expectedLifecycle !== 'Closed') {
    return { ok: false, error: { issues: ['NotFlat'] } }
  }

  const terminal = deriveTerminalDisposition(facts, true)
  if (!terminal.applicable) return { ok: false, error: { issues: ['NoDisposingFacts'] } }
  const requirement = deriveCloseReasonRequirement(facts, true)
  if (requirement === 'RequiresNoCloseReason' && command.closeReason) {
    return { ok: false, error: { issues: ['CloseReasonNotApplicable'] } }
  }

  const revision = String(Number(command.trade.revision) + 1)
  const trade: ClosedTradeProjection = {
    id: command.trade.id,
    lifecycle: 'Closed',
    revision,
    economicTime: command.economicTime,
    plan: command.trade.plan,
    positionChangeId: command.positionChangeId,
    executions: facts,
    lots: derivation.value.lots,
    lotMatches: derivation.value.closingLotMatches,
    positions: derivation.value.positions,
    realizedToDate: derivation.value.realizedToDate,
    closeReason: reason.value,
    terminalDisposition: terminal,
    closeReasonRequirement: requirement,
    agreement: derivation.value.agreement,
  }
  const journalOutcome = reflection.value
  const journalOutcomeId = `${journalOutcome.kind === 'Decline' ? 'decline' : journalOutcome.kind}-${command.positionChangeId}`
  const result: CloseResult = {
    receipt: {
      tradeId: trade.id,
      factRevision: revision,
      positionChangeId: command.positionChangeId,
      executionIds: closingFacts.map(f => f.id),
      lotIds: trade.lots.map(l => l.id),
      matchIds: trade.lotMatches.map(m => m.id),
      lifecycleTransitions: ['Open', 'Closed'],
      journalOutcomeId,
      obligationKey: journalOutcome.obligationKey,
      closeReason: reason.value,
      realizedToDate: trade.realizedToDate,
      terminalDisposition: terminal,
    },
    trade,
    journalOutcome,
    revisions: { trade: revision, journal: '1' },
    postCommit: { trade, journalOutcome },
    affectedScopes: ['trade-list', `trade:${trade.id}`, 'journal-timeline', 'closed-trades'],
  }
  return { ok: true, value: result }
}
