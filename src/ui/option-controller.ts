import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import { parseOptionContract, type OptionContract } from '../domain/option-contract'
import { resolveStrategyShape } from '../domain/strategy-shapes'
import { assessOptionPlan } from '../domain/option-plan'
import {
  deriveOptionPosition, type OptionExecution, type OptionPosition,
} from '../domain/option-position'
import { preparePlanReflection } from '../domain/plan-reflection'
import {
  preparePositionChangeReflection, type ReflectionDisposition, type ReflectionOutcome,
} from '../domain/position-change-reflection'
import { resolveCloseReason, type SeededReason } from '../domain/close'
import { LIFECYCLE_INDEX_ID, writeLifecycleIndexInTx, type LifecycleIndex } from '../domain/open-views'
import type { ReadinessEvidence, Result, RuntimeNotWritable } from '../domain/types'

type Account = { id: string; institutionId: string; label: string; active: boolean; revision: string; history: unknown[] }

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
  // A short uniqueness token keeps the readable contract prefix while never
  // overwriting an earlier confirmation of the same exact contract.
  const id = `trade-${c.underlying.toLowerCase()}-${c.kind.toLowerCase()}-${c.strike}-${c.expiration}-${request.economicTime.slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}`
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
}

function positionChangeReflection(
  tradeId: string, positionChangeId: string, disposition: ReflectionDisposition,
): Result<ReflectionOutcome, { issues: string[] }> {
  return preparePositionChangeReflection({
    positionChangeId, tradeId, definitionRevision: 'D1', disposition,
  })
}

async function commitPositionChange(
  handle: Db, trade: StoredOptionTrade, position: OptionPosition,
  positionChangeId: string, journalOutcome: ReflectionOutcome, journalId: string,
  bucket: 'Open' | 'Closed',
  executions: OptionExecution[],
  closeReason?: { id: string; label: string },
): Promise<void> {
  const storedTrade = {
    id: trade.id, lifecycle: bucket === 'Open' ? 'Open' : 'Closed',
    revision: String(Number(trade.revision) + 1), economicTime: trade.economicTime, plan: trade.plan,
    positionChangeId, executions,
    lots: position.lots, lotMatches: position.lotMatches,
    positions: position.positions, realizedToDate: position.realizedToDate,
    ...(closeReason ? { closeReason } : {}),
    fulfillment: position.fulfillment, deviations: position.deviations,
    agreement: { lifecycle: true, lots: true, findings: [] },
  }
  await transaction(handle, ['trade', 'journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', storedTrade)
    await repo.putInTx(tx, 'journal', { id: journalId, ...journalOutcome })
    const index = await repo.getInTx<LifecycleIndex>(tx, 'trade', LIFECYCLE_INDEX_ID)
    const members = index?.members ?? { Planned: [], Open: [], Closed: [], Abandoned: [] }
    for (const key of ['Planned', 'Open', 'Closed', 'Abandoned'] as const) {
      members[key] = members[key].filter(id => id !== trade.id)
    }
    members[bucket].push(trade.id)
    await writeLifecycleIndexInTx(tx, members)
  })
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
): Promise<Result<{ trade: StoredOptionTrade; position: OptionPosition; journalOutcome: ReflectionOutcome }, ErrorResult>> {
  const gate = guardWrite(request.readiness, 'TradeWorkflows.recordPositionChange')
  if (!gate.ok) return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  const handle = db ?? await openDb()
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

  const journalId = `${reflection.value.kind === 'Decline' ? 'decline' : reflection.value.kind}-${request.positionChangeId}`
  await commitPositionChange(handle, stored, position.value, request.positionChangeId, reflection.value, journalId, 'Open', executions)
  const trade: StoredOptionTrade = {
    ...stored, lifecycle: 'Open', revision: String(Number(stored.revision) + 1),
    executions, lots: position.value.lots, positions: position.value.positions,
    realizedToDate: position.value.realizedToDate, positionChangeId: request.positionChangeId,
  }
  return { ok: true, value: { trade, position: position.value, journalOutcome: reflection.value } }
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
): Promise<Result<{ trade: StoredOptionTrade; position: OptionPosition; closeReason: { id: string; label: string }; journalOutcome: ReflectionOutcome }, ErrorResult>> {
  const gate = guardWrite(request.readiness, 'TradeWorkflows.recordPositionChange')
  if (!gate.ok) return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  const handle = db ?? await openDb()
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

  const journalId = `${reflection.value.kind === 'Decline' ? 'decline' : reflection.value.kind}-${request.positionChangeId}`
  await commitPositionChange(handle, stored, position.value, request.positionChangeId, reflection.value, journalId, 'Closed', [...prior, ...closing], reason.value)
  const trade: StoredOptionTrade = {
    ...stored, lifecycle: 'Closed', revision: String(Number(stored.revision) + 1),
    executions: [...prior, ...closing], lots: position.value.lots,
    lotMatches: position.value.lotMatches,
    positions: position.value.positions, realizedToDate: position.value.realizedToDate,
    positionChangeId: request.positionChangeId,
    closeReason: reason.value,
  }
  return { ok: true, value: { trade, position: position.value, closeReason: reason.value, journalOutcome: reflection.value } }
}
