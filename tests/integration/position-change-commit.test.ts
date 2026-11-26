import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { openDb, repo } from '../../src/persistence/db'
import { recordOpeningPositionChange } from '../../src/ui/position-controller'
import { recordClosePositionChange } from '../../src/ui/close-controller'
import { recordOptionPositionChange, recordOptionClose } from '../../src/ui/option-controller'
import { evaluateReadiness } from '../../src/domain/readiness'
import { LIFECYCLE_INDEX_ID, type LifecycleMembers } from '../../src/domain/open-views'

const readiness = evaluateReadiness({
  diagnosticTransaction: true, capacityHeadroom: true, serviceWorkerControl: true,
  offlineInventoryValid: true, protection: { kind: 'BestEffort', reason: 'test' },
  workspaceReadable: true, existingRoot: 'none',
})
const disposition = { kind: 'Complete' as const, form: { decisionMode: 'As Planned', primaryEmotion: 'Calm', decisionConfidence: 5 } }
const contract = { underlying: 'AAPL', kind: 'Call' as const, strike: '190', expiration: '2026-12-18', multiplier: 100 }

async function seedOption(db: Awaited<ReturnType<typeof openDb>>, id: string) {
  await repo.put(db, 'trade', {
    id, lifecycle: 'Planned', revision: '1', economicTime: '2026-11-20T20:00:00Z',
    plan: {
      underlying: 'AAPL', quantity: 2, entry: '3.00', stop: '1.00', target: '7.00',
      oneR: '400.00', baseline: '3.00', strategyId: 'seed-long-call', contract,
      contractInstrument: 'AAPL 190Call 2026-12-18 x100',
      plannedLeg: { contract, quantity: 2, openingAction: 'Buy' as const },
      management: { stop: '1.00', target: '7.00' },
    },
  })
  await repo.put(db, 'catalog', {
    id: 'catalog-1',
    closeReasons: [{ id: 'cr-1', label: 'Target Reached', active: true }],
  })
}

// No mocks: real IndexedDB via fake-indexeddb, real domain code.
describe('Position Change commit (mock-free)', () => {
  it('should commit a stock and an option opening and close with derived Terminal Disposition', async () => {
    const db = await openDb()
    await seedOption(db, 'trade-option-commit')
    const members: LifecycleMembers = { Planned: [], Open: [], Closed: [], Abandoned: [] }
    await repo.put(db, 'trade', { id: LIFECYCLE_INDEX_ID, members })

    const opened = await recordOptionPositionChange({
      tradeId: 'trade-option-commit', expectedRevision: '1', positionChangeId: 'pc-option-commit',
      economicTime: '2026-11-20T20:00:00Z',
      executions: [{ id: 'exec-o1', contract, action: 'Buy', opening: true, quantity: '2', price: '3.00', fee: '1.00', economicTime: '2026-11-20T20:00:00Z' }],
      reflection: { definitionRevision: 'D1', disposition }, readiness,
    }, db)
    expect(opened.ok).toBe(true)
    if (!opened.ok) return
    expect(opened.value.trade.lifecycle).toBe('Open')

    const closed = await recordOptionClose({
      tradeId: 'trade-option-commit', expectedRevision: opened.value.trade.revision,
      positionChangeId: 'close-option-commit', economicTime: '2026-11-25T20:00:00Z',
      executions: [{ id: 'exec-o2', contract, action: 'Sell', opening: false, quantity: '2', price: '5.00', fee: '1.00', economicTime: '2026-11-25T20:00:00Z' }],
      closeReason: 'Target Reached',
      reflection: { definitionRevision: 'D1', disposition }, readiness,
    }, db)
    expect(closed.ok).toBe(true)
    if (!closed.ok) return
    const stored = await repo.get<Record<string, unknown>>(db, 'trade', 'trade-option-commit')
    expect(stored?.terminalDisposition).toMatchObject({ applicable: true, kind: 'FullyDisposedByExecution' })
    expect(stored?.agreement).toMatchObject({ lifecycle: true, lots: true, findings: [] })
    expect(stored?.lifecycle).toBe('Closed')

    const index = await repo.get<{ members: LifecycleMembers }>(db, 'trade', LIFECYCLE_INDEX_ID)
    expect(index?.members.Closed).toContain('trade-option-commit')
  })

  it('should keep the stock path on the same commit seam', async () => {
    const db = await openDb()
    await repo.put(db, 'trade', {
      id: 'trade-stock-commit', lifecycle: 'Planned', revision: '1',
      economicTime: '2026-11-20T20:00:00Z',
      plan: { underlying: 'MSFT', quantity: 10, entry: '100', stop: '95', target: '110', oneR: '50.00', baseline: '2.00' },
    })
    await repo.put(db, 'trade', { id: LIFECYCLE_INDEX_ID, members: { Planned: [], Open: [], Closed: [], Abandoned: [] } })
    const opened = await recordOpeningPositionChange({
      tradeId: 'trade-stock-commit', expectedRevision: '1', positionChangeId: 'pc-stock-commit',
      economicTime: '2026-11-20T20:00:00Z',
      executions: [{ id: 'exec-s1', instrument: 'MSFT', action: 'Buy', quantity: '10', price: '100', fee: '5', economicTime: '2026-11-20T20:00:00Z', plannedLegId: 'leg-1' }],
      reflection: { definitionRevision: 'D1', disposition }, readiness,
    }, db)
    expect(opened.ok).toBe(true)
    const closed = await recordClosePositionChange({
      tradeId: 'trade-stock-commit', expectedRevision: opened.ok ? opened.value.trade.revision : '2',
      positionChangeId: 'close-stock-commit', economicTime: '2026-11-25T20:00:00Z',
      executions: [{ id: 'exec-s2', instrument: 'MSFT', quantity: '10', price: '110', fee: '4', economicTime: '2026-11-25T20:00:00Z' }],
      closeReason: 'Target Reached',
      reflection: { definitionRevision: 'D1', disposition }, readiness,
    }, db)
    expect(closed.ok).toBe(true)
    const index = await repo.get<{ members: LifecycleMembers }>(db, 'trade', LIFECYCLE_INDEX_ID)
    expect(index?.members.Closed).toContain('trade-stock-commit')
  })

  it('should remove the UI casts and the duplicated Account type', () => {
    const root = join(process.cwd())
    const app = readFileSync(join(root, 'src/ui/App.tsx'), 'utf8')
    const option = readFileSync(join(root, 'src/ui/option-controller.ts'), 'utf8')
    expect(app).not.toContain('as unknown as StoredOpenTrade')
    expect(app).not.toContain('as unknown as StoredClosedTrade')
    expect(option).not.toMatch(/^type Account =/m)
  })
})
