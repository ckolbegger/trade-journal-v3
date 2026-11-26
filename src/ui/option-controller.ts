import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import {
  parseOptionContract, canonicalInstrument, type OptionContract,
} from '../domain/option-contract'
import { resolveStrategyShape } from '../domain/strategy-shapes'
import { assessOptionPlan } from '../domain/option-plan'
import {
  deriveOptionPosition, type OptionExecution, type OptionPosition,
} from '../domain/option-position'
import { preparePlanReflection } from '../domain/plan-reflection'
import {
  preparePositionChangeReflection, type ReflectionDisposition, type ReflectionOutcome,
} from '../domain/position-change-reflection'
import {
  resolveCloseReason, deriveTerminalDisposition, deriveCloseReasonRequirement,
  type SeededReason, type TerminalDisposition, type CloseReasonRequirement,
} from '../domain/close'
import { derive, type ExecutionFact } from '../domain/derive'
import type {
  Account, ReadinessEvidence, Result, RuntimeNotWritable,
} from '../domain/types'
import {
  commitPositionChange, type PositionChangeError, type PreparedPositionChange,
} from './position-change-commit'

export type ConfirmOptionPlanRequest = {
  account: Account
  definitionRevision: string
  strategyId: string
  contract: OptionContract
  quantity: number
  entry: string
  stop: string
  target: string
  reflection: { thesis: string; invalidation: string; conviction?: number; emotion?: string }
  economicTime: string
  readiness: ReadinessEvidence
  accountRevision?: string
}

export type OptionPlanProjection = {
  id: string
  lifecycle: 'Planned'
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
    strategyId: string
    contract: OptionContract
    contractInstrument: string
    plannedLeg: { contract: OptionContract; quantity: number; openingAction: 'Buy' | 'Sell' }
    management: { stop: string; target: string }
  }
}

type ErrorResult =
  | { kind: 'RuntimeNotWritable'; runtimeNotWritable: RuntimeNotWritable }
  | { kind: 'Validation'; issues: string[] }

let idCounter = 0

// Uniqueness must not depend on crypto.randomUUID being present: older
// browsers, insecure contexts and embedded browser panes may not expose it.
export function tradeIdToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8)
  }
  idCounter += 1
  const random = Math.floor(Math.random() * 0xffffffff).toString(36)
  return `${Date.now().toString(36)}-${idCounter.toString(36)}-${random}`.slice(0, 16)
}

export async function confirmOptionPlan(
  request: ConfirmOptionPlanRequest,
  db?: Db,
): Promise<Result<{ trade: OptionPlanProjection; entry: { snapshot: Record<string, unknown> } }, ErrorResult>> {
  const gate = guardWrite(request.readiness, 'TradeWorkflows.confirmPlan')
  if (!gate.ok) return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  const issues: string[] = []
  if (request.account.revision !== (request.accountRevision ?? request.account.revision)) issues.push('StaleAccount')
  if (!request.account.active) issues.push('InactiveAccount')
  const shape = resolveStrategyShape(request.strategyId)
  if (!shape.ok) issues.push(shape.error.issue)
  const parsed = parseOptionContract({ ...request.contract, multiplier: String(request.contract.multiplier) })
  if (!parsed.ok) issues.push(...parsed.error.issues)
  if (issues.length) return { ok: false, error: { kind: 'Validation', issues } }

  const assessment = assessOptionPlan({
    strategyId: request.strategyId, contract: request.contract, quantity: request.quantity,
    entry: request.entry, stop: request.stop, target: request.target,
  })
  if (!assessment.ok) return { ok: false, error: { kind: 'Validation', issues: assessment.error.issues } }
  const reflection = preparePlanReflection(request.reflection, request.definitionRevision)
  if (!reflection.ok) return { ok: false, error: { kind: 'Validation', issues: reflection.error.issues } }

  const c = request.contract
  // Identical Plans confirmed on the same day must remain distinct Trades.
  const id = `trade-${c.underlying.toLowerCase()}-${c.kind.toLowerCase()}-${c.strike}-${c.expiration}-${request.economicTime.slice(0, 10)}-${tradeIdToken()}`
  const trade: OptionPlanProjection = {
    id, lifecycle: 'Planned', revision: '1', economicTime: request.economicTime,
    plan: {
      underlying: c.underlying, quantity: request.quantity, entry: request.entry,
      stop: request.stop, target: request.target,
      oneR: assessment.value.oneR, baseline: assessment.value.baseline,
      strategyId: request.strategyId, contract: c,
      contractInstrument: assessment.value.contractInstrument,
      plannedLeg: assessment.value.plannedLeg, management: assessment.value.management,
    },
  }
  const handle = db ?? await openDb()
  await transaction(handle, ['trade', 'journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', { id: trade.id, ...trade })
    await repo.putInTx(tx, 'journal', { id: `entry-${trade.id}`, ...reflection.value })
  })
  return { ok: true, value: { trade, entry: reflection.value } }
}

type StoredOptionTrade = OptionPlanProjection & {
  executions?: OptionExecution[]
  lots?: OptionPosition['lots']
  positions?: OptionPosition['positions']
  realizedToDate?: string
  fulfillment?: string
  deviations?: unknown[]
  positionChangeId?: string
  agreement?: { lifecycle: boolean; lots: boolean; findings: string[] }
  terminalDisposition?: TerminalDisposition
  closeReasonRequirement?: CloseReasonRequirement
}

function positionChangeReflection(
  tradeId: string, positionChangeId: string, disposition: ReflectionDisposition,
): Result<ReflectionOutcome, { issues: string[] }> {
  return preparePositionChangeReflection({
    positionChangeId, tradeId, definitionRevision: 'D1', disposition,
  })
}

// Agreement and Terminal Disposition are derived from the effective Execution
// facts (ADR 0003); the option path never fabricates a clean agreement.
function deriveFactState(
  trade: StoredOptionTrade, executions: OptionExecution[], positionChangeId: string,
  storedLifecycle: string, closed: boolean,
) {
  const facts: ExecutionFact[] = executions.map(e => ({
    id: e.id, tradeId: trade.id, positionChangeId,
    instrument: canonicalInstrument(e.contract),
    action: e.action, quantity: e.quantity, price: e.price, fee: e.fee,
    economicTime: e.economicTime, recordedSequence: e.recordedSequence,
    plannedLegId: e.plannedLegId,
  }))
  const derived = derive({
    tradeId: trade.id,
    storedLifecycle,
    plan: {
      underlying: trade.plan.underlying, quantity: trade.plan.quantity,
      entry: trade.plan.entry, stop: trade.plan.stop, target: trade.plan.target,
      oneR: trade.plan.oneR, baseline: trade.plan.baseline,
    },
    executions: facts,
  })
  return {
    facts,
    agreement: derived.ok
      ? derived.value.agreement
      : { lifecycle: false, lots: false, findings: derived.error.issues },
    terminalDisposition: deriveTerminalDisposition(facts, closed),
    closeReasonRequirement: deriveCloseReasonRequirement(facts, closed),
  }
}

export type OptionPositionChangeRequest = {
  tradeId: string
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: {
    id: string; contract: OptionContract; action: 'Buy' | 'Sell'; opening: boolean
    quantity: string; price: string; fee: string; economicTime: string
  }[]
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
  readiness: ReadinessEvidence
}

export async function recordOptionPositionChange(
  request: OptionPositionChangeRequest,
  db?: Db,
): Promise<Result<
  { trade: StoredOptionTrade; position: OptionPosition; journalOutcome: ReflectionOutcome },
  PositionChangeError
>> {
  type Value = { trade: StoredOptionTrade; position: OptionPosition; journalOutcome: ReflectionOutcome }
  return commitPositionChange<Value>({
    db, readiness: request.readiness, operation: 'TradeWorkflows.recordPositionChange',
    prepare: async handle => {
      const stored = await repo.get<StoredOptionTrade>(handle, 'trade', request.tradeId)
      if (!stored) return { ok: false, error: { kind: 'Validation', issues: ['NotFound'] } }
      if (stored.revision !== request.expectedRevision) return { ok: false, error: { kind: 'Validation', issues: ['StaleRevision'] } }
      if (stored.lifecycle !== 'Planned') return { ok: false, error: { kind: 'Validation', issues: ['NotPlanned'] } }

      const executions: OptionExecution[] = request.executions.map((e, index) => ({
        ...e, plannedLegId: 'leg-1', recordedSequence: index + 1,
      }))
      const position = deriveOptionPosition({
        tradeId: stored.id, plannedLeg: stored.plan.plannedLeg, executions,
      })
      if (!position.ok) return { ok: false, error: { kind: 'Validation', issues: position.error.issues } }
      if (position.value.expectedLifecycle !== 'Open') return { ok: false, error: { kind: 'Validation', issues: ['NotOpen'] } }
      const reflection = positionChangeReflection(stored.id, request.positionChangeId, request.reflection.disposition)
      if (!reflection.ok) return { ok: false, error: { kind: 'Validation', issues: reflection.error.issues } }

      const derived = deriveFactState(stored, executions, request.positionChangeId, 'Open', false)
      const journalId = `${reflection.value.kind === 'Decline' ? 'decline' : reflection.value.kind}-${request.positionChangeId}`
      const trade: StoredOptionTrade = {
        id: stored.id, lifecycle: 'Open', revision: String(Number(stored.revision) + 1),
        economicTime: stored.economicTime, plan: stored.plan,
        positionChangeId: request.positionChangeId, executions,
        lots: position.value.lots, lotMatches: position.value.lotMatches,
        positions: position.value.positions, realizedToDate: position.value.realizedToDate,
        fulfillment: position.value.fulfillment, deviations: position.value.deviations,
        agreement: derived.agreement,
        terminalDisposition: derived.terminalDisposition,
        closeReasonRequirement: derived.closeReasonRequirement,
      }
      const change: PreparedPositionChange<Value> = {
        trade, journalOutcome: { id: journalId, ...reflection.value }, bucket: 'Open',
        result: { trade, position: position.value, journalOutcome: reflection.value },
      }
      return { ok: true, value: change }
    },
  })
}

export type OptionCloseRequest = {
  tradeId: string
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: {
    id: string; contract: OptionContract; action: 'Buy' | 'Sell'; opening: boolean
    quantity: string; price: string; fee: string; economicTime: string
  }[]
  closeReason: string
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
  readiness: ReadinessEvidence
}

export async function recordOptionClose(
  request: OptionCloseRequest,
  db?: Db,
): Promise<Result<
  {
    trade: StoredOptionTrade; position: OptionPosition
    closeReason: { id: string; label: string }; journalOutcome: ReflectionOutcome
  },
  PositionChangeError
>> {
  type Value = {
    trade: StoredOptionTrade; position: OptionPosition
    closeReason: { id: string; label: string }; journalOutcome: ReflectionOutcome
  }
  return commitPositionChange<Value>({
    db, readiness: request.readiness, operation: 'TradeWorkflows.recordPositionChange',
    prepare: async handle => {
      const stored = await repo.get<StoredOptionTrade>(handle, 'trade', request.tradeId)
      if (!stored) return { ok: false, error: { kind: 'Validation', issues: ['NotFound'] } }
      if (stored.revision !== request.expectedRevision) return { ok: false, error: { kind: 'Validation', issues: ['StaleRevision'] } }
      if (stored.lifecycle !== 'Open') return { ok: false, error: { kind: 'Validation', issues: ['NotOpen'] } }
      const catalog = await repo.get<{ closeReasons: SeededReason[] }>(handle, 'catalog', 'catalog-1')
      const reason = resolveCloseReason(request.closeReason, catalog)
      if (!reason.ok) return { ok: false, error: { kind: 'Validation', issues: [reason.error.issue] } }

      const prior = stored.executions ?? []
      const closing: OptionExecution[] = request.executions.map((e, index) => ({
        ...e, plannedLegId: 'leg-1', recordedSequence: prior.length + index + 1,
      }))
      const position = deriveOptionPosition({
        tradeId: stored.id, plannedLeg: stored.plan.plannedLeg,
        executions: [...prior, ...closing], closed: true,
      })
      if (!position.ok) return { ok: false, error: { kind: 'Validation', issues: position.error.issues } }
      if (position.value.expectedLifecycle !== 'Closed') return { ok: false, error: { kind: 'Validation', issues: ['NotFlat'] } }
      const reflection = positionChangeReflection(stored.id, request.positionChangeId, request.reflection.disposition)
      if (!reflection.ok) return { ok: false, error: { kind: 'Validation', issues: reflection.error.issues } }

      const derived = deriveFactState(stored, [...prior, ...closing], request.positionChangeId, 'Closed', true)
      const journalId = `${reflection.value.kind === 'Decline' ? 'decline' : reflection.value.kind}-${request.positionChangeId}`
      const trade: StoredOptionTrade = {
        id: stored.id, lifecycle: 'Closed', revision: String(Number(stored.revision) + 1),
        economicTime: stored.economicTime, plan: stored.plan,
        executions: [...prior, ...closing], lots: position.value.lots,
        lotMatches: position.value.lotMatches, positions: position.value.positions,
        realizedToDate: position.value.realizedToDate, positionChangeId: request.positionChangeId,
        fulfillment: position.value.fulfillment, deviations: position.value.deviations,
        closeReason: reason.value,
        agreement: derived.agreement,
        terminalDisposition: derived.terminalDisposition,
        closeReasonRequirement: derived.closeReasonRequirement,
      }
      const change: PreparedPositionChange<Value> = {
        trade, journalOutcome: { id: journalId, ...reflection.value }, bucket: 'Closed',
        result: { trade, position: position.value, closeReason: reason.value, journalOutcome: reflection.value },
      }
      return { ok: true, value: change }
    },
  })
}
