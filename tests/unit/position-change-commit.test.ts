import { describe, expect, it } from 'vitest'
import { openDb, repo } from '../../src/persistence/db'
import { commitPositionChange, type PreparedPositionChange } from '../../src/ui/position-change-commit'
import { LIFECYCLE_INDEX_ID, type LifecycleMembers } from '../../src/domain/open-views'
import { evaluateReadiness } from '../../src/domain/readiness'

const writable = evaluateReadiness({
  diagnosticTransaction: true, capacityHeadroom: true, serviceWorkerControl: true,
  offlineInventoryValid: true, protection: { kind: 'BestEffort', reason: 'test' },
  workspaceReadable: true, existingRoot: 'none',
})

const prepared = (bucket: 'Open' | 'Closed'): PreparedPositionChange<{ receipt: string }> => ({
  trade: { id: 'trade-1', lifecycle: bucket, revision: '2' },
  journalOutcome: { id: 'entry-pc-1', kind: 'Entry' },
  bucket,
  result: { receipt: 'pc-1' },
})

async function seed() {
  const db = await openDb()
  const members: LifecycleMembers = { Planned: ['trade-1'], Open: [], Closed: [], Abandoned: [] }
  await repo.put(db, 'trade', { id: LIFECYCLE_INDEX_ID, members })
  await repo.put(db, 'trade', { id: 'trade-1', lifecycle: 'Planned', revision: '1' })
  return db
}

describe('Position Change commit', () => {
  it('should own guard, atomic Trade + Journal write and lifecycle index movement for one prepared change', async () => {
    const db = await seed()
    const committed = await commitPositionChange({
      db, readiness: writable, operation: 'TradeWorkflows.recordPositionChange',
      prepare: async () => ({ ok: true, value: prepared('Open') }),
    })
    expect(committed).toEqual({ ok: true, value: { receipt: 'pc-1' } })
    const trade = await repo.get(db, 'trade', 'trade-1')
    expect(trade).toMatchObject({ lifecycle: 'Open', revision: '2' })
    expect(await repo.get(db, 'journal', 'entry-pc-1')).toMatchObject({ kind: 'Entry' })
    const index = await repo.get<{ members: LifecycleMembers }>(db, 'trade', LIFECYCLE_INDEX_ID)
    expect(index?.members).toEqual({ Planned: [], Open: ['trade-1'], Closed: [], Abandoned: [] })
  })

  it('should move Open to Closed through the same interface', async () => {
    const db = await seed()
    await repo.put(db, 'trade', { id: 'trade-1', lifecycle: 'Open', revision: '2' })
    await repo.put(db, 'trade', {
      id: LIFECYCLE_INDEX_ID,
      members: { Planned: [], Open: ['trade-1'], Closed: [], Abandoned: [] },
    })
    await commitPositionChange({
      db, readiness: writable, operation: 'TradeWorkflows.recordPositionChange',
      prepare: async () => ({ ok: true, value: prepared('Closed') }),
    })
    const index = await repo.get<{ members: LifecycleMembers }>(db, 'trade', LIFECYCLE_INDEX_ID)
    expect(index?.members.Closed).toEqual(['trade-1'])
    expect(index?.members.Open).toEqual([])
  })

  it('should reject non-Writable readiness and a failed prepare with no writes', async () => {
    const db = await seed()
    const blocked = evaluateReadiness({
      diagnosticTransaction: false, capacityHeadroom: true, serviceWorkerControl: true,
      offlineInventoryValid: true, protection: { kind: 'Protected' },
      workspaceReadable: true, existingRoot: 'none',
    })
    const guarded = await commitPositionChange({
      db, readiness: blocked, operation: 'TradeWorkflows.recordPositionChange',
      prepare: async () => ({ ok: true, value: prepared('Open') }),
    })
    expect(guarded.ok).toBe(false)
    expect(await repo.get(db, 'trade', 'trade-1')).toMatchObject({ lifecycle: 'Planned', revision: '1' })

    const before = await repo.all(db, 'journal')
    const failed = await commitPositionChange({
      db, readiness: writable, operation: 'TradeWorkflows.recordPositionChange',
      prepare: async () => ({ ok: false, error: { kind: 'Validation' as const, issues: ['StaleRevision'] } }),
    })
    expect(failed).toEqual({ ok: false, error: { kind: 'Validation', issues: ['StaleRevision'] } })
    expect(await repo.all(db, 'journal')).toEqual(before)
  })
})
