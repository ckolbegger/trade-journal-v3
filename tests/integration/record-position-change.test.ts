import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction, type Db } from '../../src/persistence/db'
import { recordOpeningPositionChange, type RecordOpeningRequest } from '../../src/ui/position-controller'
import { readLifecycleIndex } from '../../src/domain/open-views'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [],
  protection: { kind: 'BestEffort', reason: 'browser-managed' },
}
const blocked: ReadinessEvidence = {
  outcome: 'RecoveryOnly', passed: false, failedChecks: ['diagnostic-transaction'],
  protection: { kind: 'BestEffort', reason: 'browser-managed' },
}

const request: RecordOpeningRequest = {
  tradeId: 'trade-aapl',
  expectedRevision: '1',
  positionChangeId: 'pc-1',
  economicTime: '2026-11-24T20:00:00Z',
  executions: [
    { id: 'exec-1', instrument: 'AAPL', action: 'Buy', quantity: '6', price: '100.00', fee: '3.00', economicTime: '2026-11-24T20:00:00Z', plannedLegId: 'leg-1' },
    { id: 'exec-2', instrument: 'AAPL', action: 'Buy', quantity: '4', price: '102.50', fee: '2.00', economicTime: '2026-11-24T20:00:00Z', plannedLegId: 'leg-1' },
  ],
  reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
  readiness: writable,
}

async function seedPlanned(db: Db) {
  await transaction(db, ['trade'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', {
      id: 'trade-aapl', lifecycle: 'Planned', revision: '1', economicTime: '2026-11-24T20:00:00Z',
      plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
    })
    await repo.putInTx(tx, 'trade', {
      id: 'lifecycle-index',
      members: { Planned: ['trade-aapl'], Open: [], Closed: [], Abandoned: [] },
    })
  })
}

describe('recordPositionChange integration (mock-free)', () => {
  it('should commit Trade, Journal outcome and lifecycle index atomically and survive restart', async () => {
    const db = await openDb()
    await seedPlanned(db)
    const result = await recordOpeningPositionChange(request, db)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const reopened = await openDb()
    const stored = await repo.get<Record<string, unknown>>(reopened, 'trade', 'trade-aapl')
    expect(stored?.lifecycle).toBe('Open')
    expect(stored?.executions).toHaveLength(2)
    expect(stored?.lots).toHaveLength(2)
    const outcome = await repo.get<Record<string, unknown>>(reopened, 'journal', result.value.receipt.journalOutcomeId)
    expect(outcome?.kind).toBe('Debt')
    const index = await readLifecycleIndex(reopened)
    expect(index.members.Open).toEqual(['trade-aapl'])
    expect(index.members.Planned).toEqual([])
  })

  it('should write nothing on a stale revision', async () => {
    const db = await openDb()
    await seedPlanned(db)
    const before = (await repo.all(db, 'trade')).length
    const result = await recordOpeningPositionChange({ ...request, expectedRevision: '9' }, db)
    expect(result.ok).toBe(false)
    const after = (await repo.all(db, 'trade')).length
    expect(after).toBe(before)
    const index = await readLifecycleIndex(db)
    expect(index.members.Open).toEqual([])
  })

  it('should return a revision-bound result equal to durable state without a follow-up read', async () => {
    const db = await openDb()
    await seedPlanned(db)
    const result = await recordOpeningPositionChange(request, db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = await repo.get<Record<string, unknown>>(db, 'trade', 'trade-aapl')
    expect(stored?.revision).toBe(result.value.revisions.trade)
    expect(stored?.positions).toEqual(result.value.postCommit.trade.positions)
    expect(stored?.lots).toEqual(result.value.postCommit.trade.lots)
  })

  it('should return RuntimeNotWritable and change nothing when readiness is not Writable', async () => {
    const db = await openDb()
    await seedPlanned(db)
    const result = await recordOpeningPositionChange({ ...request, readiness: blocked }, db)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect('runtimeNotWritable' in result.error).toBe(true)
    const stored = await repo.get<{ lifecycle: string }>(db, 'trade', 'trade-aapl')
    expect(stored?.lifecycle).toBe('Planned')
  })
})
