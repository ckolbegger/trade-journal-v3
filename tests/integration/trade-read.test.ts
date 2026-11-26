import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import {
  readCloseReasonLabels, readPlannedTrades, readStoredTrade,
} from '../../src/ui/trade-read'
import {
  LIFECYCLE_INDEX_ID, writeLifecycleIndexInTx, type LifecycleMembers,
} from '../../src/domain/open-views'

const members: LifecycleMembers = {
  Planned: ['trade-plan-1'], Open: ['trade-open-1'], Closed: ['trade-closed-1'], Abandoned: [],
}

async function seed() {
  const db = await openDb()
  await transaction(db, ['trade', 'journal', 'catalog'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'catalog', {
      id: 'catalog-1',
      closeReasons: [{ id: 'cr-1', label: 'Stopped out', active: true }],
    })
    await repo.putInTx(tx, 'trade', {
      id: 'trade-plan-1', lifecycle: 'Planned', revision: '1',
      economicTime: '2026-11-24T20:00:00Z',
      plan: {
        underlying: 'AAPL', oneR: '2.00', baseline: '3.00', entry: '3.00', stop: '1.00', target: '7.00',
        strategyId: 'seed-long-call',
        contract: { underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100 },
      },
    })
    await repo.putInTx(tx, 'trade', {
      id: 'trade-open-1', lifecycle: 'Open', revision: '2',
      plan: { underlying: 'MSFT', oneR: '1.00', entry: '1', stop: '1', target: '2' },
    })
    await repo.putInTx(tx, 'trade', {
      id: 'trade-closed-1', lifecycle: 'Closed', revision: '3',
      plan: { underlying: 'TSLA', oneR: '1.00', entry: '1', stop: '1', target: '2' },
    })
    await repo.putInTx(tx, 'journal', {
      id: 'entry-trade-plan-1', kind: 'Entry', obligationKey: 'Plan:trade-plan-1', snapshot: { thesis: 'why' },
    })
    await writeLifecycleIndexInTx(tx, members)
  })
  return db
}

// No mocks: real IndexedDB via fake-indexeddb, real domain code.
describe('canonical Trade read (mock-free)', () => {
  it('should preserve exact contract, revision, lifecycle index membership and journal linkage', async () => {
    const db = await seed()
    const planned = await readStoredTrade(db, 'trade-plan-1')
    expect(planned).toBeDefined()
    expect(planned!.revision).toBe('1') // stored revision preserved
    expect(planned!.oneR).toBe('2.00') // frozen Plan field
    expect(planned!.plan.strategyId).toBe('seed-long-call')
    expect(planned!.plan.contract).toMatchObject({ strike: '190', expiration: '2026-12-18', multiplier: 100 })

    const plannedTrades = await readPlannedTrades(db)
    expect(plannedTrades).toHaveLength(1)
    expect(plannedTrades[0].trade.id).toBe('trade-plan-1')
    expect(plannedTrades[0].entry.snapshot).toMatchObject({ thesis: 'why' })

    const index = await repo.get<{ members: LifecycleMembers }>(db, 'trade', LIFECYCLE_INDEX_ID)
    expect(index!.members).toEqual(members)
  })

  it('should resolve close reason labels from the catalog through one read', async () => {
    const db = await seed()
    expect(await readCloseReasonLabels(db)).toEqual(['Stopped out'])
  })

  it('should write nothing to any store', async () => {
    const db = await seed()
    const before = {
      trade: await repo.all(db, 'trade'),
      journal: await repo.all(db, 'journal'),
      catalog: await repo.all(db, 'catalog'),
    }
    const modes: string[] = []
    const originalTransaction = db.transaction.bind(db)
    db.transaction = ((stores: string | string[], mode?: IDBTransactionMode) => {
      modes.push(mode ?? 'readonly')
      return originalTransaction(stores, mode)
    }) as typeof db.transaction

    await readStoredTrade(db, 'trade-open-1')
    await readPlannedTrades(db)
    await readCloseReasonLabels(db)

    expect(modes.every(m => m === 'readonly')).toBe(true)
    expect(await repo.all(db, 'trade')).toEqual(before.trade)
    expect(await repo.all(db, 'journal')).toEqual(before.journal)
    expect(await repo.all(db, 'catalog')).toEqual(before.catalog)
  })
})
