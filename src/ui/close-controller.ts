import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import { recordClose, type CloseResult, type ClosingExecutionInput } from '../domain/record-close'
import type { SeededReason } from '../domain/close'
import type { ReflectionDisposition } from '../domain/position-change-reflection'
import { LIFECYCLE_INDEX_ID, writeLifecycleIndexInTx, type LifecycleIndex } from '../domain/open-views'
import type { ReadinessEvidence, Result, RuntimeNotWritable } from '../domain/types'

export type RecordCloseRequest = {
  tradeId: string
  expectedRevision: string
  positionChangeId: string
  economicTime: string
  executions: ClosingExecutionInput[]
  closeReason: string
  reflection: { definitionRevision: string; disposition: ReflectionDisposition }
  readiness: ReadinessEvidence
}

export type RecordCloseError =
  | { kind: 'RuntimeNotWritable'; runtimeNotWritable: RuntimeNotWritable }
  | { kind: 'Validation'; issues: string[] }

// TradeWorkflows.recordPositionChange, terminal subset, with its persistence
// boundary. One IndexedDB transaction stages the Closed Trade, its Position
// Change Reflection outcome and the Open→Closed index move together.
export async function recordClosePositionChange(
  request: RecordCloseRequest,
  db?: Db,
): Promise<Result<CloseResult, RecordCloseError>> {
  const gate = guardWrite(request.readiness, 'TradeWorkflows.recordPositionChange')
  if (!gate.ok) {
    return { ok: false, error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable } }
  }

  const handle = db ?? await openDb()
  const stored = await repo.get<Parameters<typeof recordClose>[0]['trade']>(handle, 'trade', request.tradeId)
  if (!stored) return { ok: false, error: { kind: 'Validation', issues: ['NotFound'] } }
  const catalog = await repo.get<{ closeReasons: SeededReason[] }>(handle, 'catalog', 'catalog-1')

  const prepared = recordClose({
    trade: stored,
    expectedRevision: request.expectedRevision,
    positionChangeId: request.positionChangeId,
    economicTime: request.economicTime,
    executions: request.executions,
    closeReason: request.closeReason,
    catalog,
    reflection: request.reflection,
  })
  if (!prepared.ok) return { ok: false, error: { kind: 'Validation', issues: prepared.error.issues } }

  const result = prepared.value
  const committed = await transaction(handle, ['trade', 'journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', { id: result.trade.id, ...result.trade })
    await repo.putInTx(tx, 'journal', { id: result.receipt.journalOutcomeId, ...result.journalOutcome })
    const storedIndex = await repo.getInTx<LifecycleIndex>(tx, 'trade', LIFECYCLE_INDEX_ID)
    const members = storedIndex?.members ?? { Planned: [], Open: [], Closed: [], Abandoned: [] }
    for (const key of ['Planned', 'Open', 'Closed', 'Abandoned'] as const) {
      members[key] = members[key].filter(id => id !== result.trade.id)
    }
    members.Closed.push(result.trade.id)
    await writeLifecycleIndexInTx(tx, members)
  })
  void committed
  return { ok: true, value: result }
}
