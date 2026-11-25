import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { recordOpeningPositionChange } from '../../src/ui/position-controller'
import { recordClosePositionChange } from '../../src/ui/close-controller'
import { queryClosedTrades, queryOpenTrades, readLifecycleIndex } from '../../src/domain/open-views'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}
const blocked: ReadinessEvidence = {
  outcome: 'RecoveryOnly', passed: false, failedChecks: ['service-worker'],
  protection: { kind: 'BestEffort', reason: 'test' },
}
const ECONOMIC_TIME = '2026-11-24T20:00:00Z'

async function fixture(tradeId: string) {
  const instrument = tradeId.replace('trade-', '').toUpperCase()
  const db = await openDb()
  await repo.put(db, 'catalog', {
    id: 'catalog-1',
    closeReasons: [{ id: 'seed-target-reached', label: 'Target Reached', origin: 'product' }],
  })
  await transaction(db, ['trade'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', {
      id: tradeId, lifecycle: 'Planned', revision: '1', economicTime: ECONOMIC_TIME,
      plan: { underlying: instrument, quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
    })
    await repo.putInTx(tx, 'trade', { id: 'lifecycle-index', members: { Planned: [tradeId], Open: [], Closed: [], Abandoned: [] } })
  })
  await recordOpeningPositionChange({
    tradeId, expectedRevision: '1', positionChangeId: `pc-${tradeId}`,
    economicTime: ECONOMIC_TIME,
    executions: [{ id: `exec-${tradeId}`, instrument, action: 'Buy', quantity: '10', price: '100.00', fee: '5.00', economicTime: ECONOMIC_TIME, plannedLegId: 'leg-1' }],
    reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
    readiness: writable,
  }, db)
  return db
}

const closeRequest = (tradeId: string, expectedRevision = '2', readiness = writable) => ({
  tradeId, expectedRevision, positionChangeId: `close-${tradeId}`,
  economicTime: '2026-11-25T20:00:00Z',
  executions: [{ id: `close-exec-${tradeId}`, instrument: tradeId.replace('trade-', '').toUpperCase(), quantity: '10', price: '110.00', fee: '4.00', economicTime: '2026-11-25T20:00:00Z' }],
  closeReason: 'Target Reached',
  reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' as const } },
  readiness,
})

describe('recordClosePositionChange integration (mock-free)', () => {
  it('should commit the Closed Trade, FIFO matches, Close Reason and Reflection outcome atomically with the Open→Closed index move', async () => {
    const id = 'trade-atomic'
    const db = await fixture(id)
    const result = await recordClosePositionChange(closeRequest(id), db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = await repo.get<{ lifecycle: string; lotMatches: unknown[]; closeReason: unknown; realizedToDate: string }>(db, 'trade', id)
    expect(stored).toMatchObject({ lifecycle: 'Closed', realizedToDate: '91.00' })
    expect(stored?.lotMatches).toHaveLength(1)
    expect(stored?.closeReason).toEqual({ id: 'seed-target-reached', label: 'Target Reached' })
    const journal = await repo.get(db, 'journal', `Debt-close-${id}`)
    expect(journal).toBeDefined()
    const index = await readLifecycleIndex(db)
    expect(index.members.Closed).toContain(id)
    expect(index.members.Open).not.toContain(id)
  })

  it('should survive a DB reopen with the same revisions, matches and realized P&L', async () => {
    const id = 'trade-reopen'
    const db = await fixture(id)
    await recordClosePositionChange(closeRequest(id), db)
    const reopened = await openDb()
    const stored = await repo.get<{ lifecycle: string; revision: string; realizedToDate: string; lotMatches: unknown[] }>(reopened, 'trade', id)
    expect(stored).toMatchObject({ lifecycle: 'Closed', revision: '3', realizedToDate: '91.00' })
    expect(stored?.lotMatches).toHaveLength(1)
  })

  it('should write nothing when the stored revision changed between open and Save', async () => {
    const id = 'trade-stale'
    const db = await fixture(id)
    const result = await recordClosePositionChange(closeRequest(id, '1'), db)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('Validation')
    const stored = await repo.get<{ lifecycle: string; revision: string }>(db, 'trade', id)
    expect(stored).toMatchObject({ lifecycle: 'Open', revision: '2' })
    expect(await repo.get(db, 'journal', `Debt-close-${id}`)).toBeUndefined()
    const index = await readLifecycleIndex(db)
    expect(index.members.Open).toContain(id)
    expect(index.members.Closed).not.toContain(id)
  })

  it('should exclude the Trade from Open queries and include it in Closed queries', async () => {
    const id = 'trade-queries'
    const db = await fixture(id)
    expect((await queryOpenTrades(db)).some(t => t.id === id)).toBe(true)
    expect((await queryClosedTrades(db)).some(t => t.id === id)).toBe(false)
    await recordClosePositionChange(closeRequest(id), db)
    expect((await queryOpenTrades(db)).some(t => t.id === id)).toBe(false)
    expect((await queryClosedTrades(db)).some(t => t.id === id)).toBe(true)
  })

  it('should return RuntimeNotWritable and change nothing when readiness is not Writable', async () => {
    const id = 'trade-blocked'
    const db = await fixture(id)
    const result = await recordClosePositionChange(closeRequest(id, '2', blocked), db)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('RuntimeNotWritable')
    const stored = await repo.get<{ lifecycle: string }>(db, 'trade', id)
    expect(stored?.lifecycle).toBe('Open')
  })
})
