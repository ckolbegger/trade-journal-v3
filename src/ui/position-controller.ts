import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import {
  recordPositionChange, type OpeningExecutionInput,
  type OpenTradeProjection, type PositionChangeCommand, type PositionChangeResult,
} from '../domain/record-position-change'
import type { ReflectionDisposition } from '../domain/position-change-reflection'
import { LIFECYCLE_INDEX_ID, writeLifecycleIndexInTx, type LifecycleIndex } from '../domain/open-views'
import type { ReadinessEvidence, Result, RuntimeNotWritable } from '../domain/types'

export type RecordOpeningRequest = {
  tradeId: string
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: OpeningExecutionInput[]
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
  readiness: ReadinessEvidence
}

export type RecordOpeningError =
  | { kind: 'RuntimeNotWritable'; runtimeNotWritable: RuntimeNotWritable }
  | { kind: 'Validation'; issues: string[] }

// TradeWorkflows.recordPositionChange, with its persistence boundary. The
// pure command builds the candidate; one IndexedDB transaction stages the
// Trade, Journal outcome and lifecycle index together.
export async function recordOpeningPositionChange(
  request: RecordOpeningRequest,
  db?: Db,
): Promise<Result<PositionChangeResult, RecordOpeningError>> {
  const gate = guardWrite(request.readiness, 'TradeWorkflows.recordPositionChange')
  if (!gate.ok) {
    return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  }

  const handle = db ?? await openDb()
  const stored = await repo.get<OpenTradeProjection & { plan: PositionChangeCommand['trade']['plan'] }>(
    handle, 'trade', request.tradeId,
  )
  if (!stored) return { ok: false, error: { kind: 'Validation', issues: ['NotFound'] } }

  const command: PositionChangeCommand = {
    trade: {
      id: stored.id,
      lifecycle: stored.lifecycle,
      revision: stored.revision ?? '1',
      economicTime: stored.economicTime,
      plan: stored.plan,
    },
    expectedRevision: request.expectedRevision,
    positionChangeId: request.positionChangeId,
    economicTime: request.economicTime,
    executions: request.executions,
    reflection: request.reflection,
  }
  const prepared = recordPositionChange(command)
  if (!prepared.ok) return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }

  const result = prepared.value
  const committed = await transaction(handle, ['trade', 'journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', { id: result.trade.id, ...result.trade })
    await repo.putInTx(tx, 'journal', {
      id: result.receipt.journalOutcomeId,
      ...result.journalOutcome,
    })

    const storedIndex = await repo.getInTx<LifecycleIndex>(tx, 'trade', LIFECYCLE_INDEX_ID)
    const members = storedIndex?.members ?? { Planned: [], Open: [], Closed: [], Abandoned: [] }
    for (const key of ['Planned', 'Open', 'Closed', 'Abandoned'] as const) {
      members[key] = members[key].filter(id => id !== result.trade.id)
    }
    members.Open.push(result.trade.id)
    await writeLifecycleIndexInTx(tx, members)
  })
  void committed
  return { ok: true, value: result }
}
