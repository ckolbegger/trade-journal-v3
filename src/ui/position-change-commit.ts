import { openDb, repo, transaction, type Db } from '../persistence/db'
import { guardWrite } from '../domain/write-gate'
import {
  LIFECYCLE_INDEX_ID, writeLifecycleIndexInTx, type LifecycleIndex, type LifecycleMembers,
} from '../domain/open-views'
import type { ReadinessEvidence, Result, RuntimeNotWritable } from '../domain/types'

// D8aR R4 — one commit owns the whole Position Change: readiness gate,
// atomic Trade + Journal outcome + lifecycle index move. Stock and option
// fact adapters only prepare a candidate; none of them sequences writes.
export type PositionChangeError =
  | { kind: 'RuntimeNotWritable'; runtimeNotWritable: RuntimeNotWritable }
  | { kind: 'Validation'; issues: string[] }

export type PreparedPositionChange<T> = {
  trade: { id: string } & Record<string, unknown>
  journalOutcome: { id: string } & Record<string, unknown>
  bucket: 'Open' | 'Closed'
  result: T
}

export type CommitPositionChangeRequest<T> = {
  readiness: ReadinessEvidence
  operation: string
  prepare: (handle: Db) => Promise<Result<PreparedPositionChange<T>, PositionChangeError>>
  db?: Db
}

export async function commitPositionChange<T>(
  request: CommitPositionChangeRequest<T>,
): Promise<Result<T, PositionChangeError>> {
  const gate = guardWrite(request.readiness, request.operation)
  if (!gate.ok) {
    return {
      ok: false,
      error: { kind: 'RuntimeNotWritable', runtimeNotWritable: gate.error.runtimeNotWritable },
    }
  }
  const handle = request.db ?? await openDb()
  const prepared = await request.prepare(handle)
  if (!prepared.ok) return prepared

  const { trade, journalOutcome, bucket } = prepared.value
  await transaction(handle, ['trade', 'journal'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', trade)
    await repo.putInTx(tx, 'journal', journalOutcome)
    const storedIndex = await repo.getInTx<LifecycleIndex>(tx, 'trade', LIFECYCLE_INDEX_ID)
    const members: LifecycleMembers = storedIndex?.members ?? {
      Planned: [], Open: [], Closed: [], Abandoned: [],
    }
    for (const key of ['Planned', 'Open', 'Closed', 'Abandoned'] as const) {
      members[key] = members[key].filter(id => id !== trade.id)
    }
    members[bucket].push(trade.id)
    await writeLifecycleIndexInTx(tx, members)
  })
  return { ok: true, value: prepared.value.result }
}
