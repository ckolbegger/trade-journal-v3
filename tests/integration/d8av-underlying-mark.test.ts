import { describe, expect, it } from 'vitest'
import { openDb, repo, STORES, type Db } from '../../src/persistence/db'
import { loadCompleteTradeDetail } from '../../src/ui/detail-controller'

const tradeId = 'trade-d8av-underlying'
const contract = 'AAPL 190Call 2026-12-18 x100'

async function seed(db: Db) {
  await repo.put(db, 'trade', {
    id: tradeId, lifecycle: 'Open', revision: '2', strategyId: 'seed-long-call',
    underlying: 'AAPL', oneR: '400.00',
    plan: {
      entry: '3.00', stop: '1.00', target: '7.00', underlying: 'AAPL', quantity: 2,
      contract: { underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100 },
    },
    positions: [{ instrument: contract, netQuantity: '2', lotCount: 1 }],
    lots: [], executions: [], realizedToDate: '0.00',
    agreement: { lifecycle: true, lots: true, findings: [] },
  })
  // The Review records the underlying Mark; the option's own Call Mark is absent.
  await repo.put(db, 'market', {
    id: 'AAPL:2026-11-23', instrument: 'AAPL', date: '2026-11-23', revision: '1',
    marks: [{
      revision: '1', price: '90.00', source: 'Manual', intention: 'RecordManualMark',
      observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:30:00Z',
    }],
    acknowledgments: [],
  })
}

async function snapshot(db: Db) {
  const result: Record<string, unknown[]> = {}
  for (const store of STORES) result[store] = await repo.all(db, store)
  return result
}

describe('underlying Mark in the complete detail read (mock-free)', () => {
  it('should expose the underlying Mark even when no Call Mark exists, without writing', async () => {
    const db = await openDb()
    await seed(db)
    const before = await snapshot(db)
    const loaded = await loadCompleteTradeDetail({
      tradeId, now: new Date('2026-11-24T17:00:00Z'), advisoryInstalled: false,
    }, db)
    expect(loaded.status).toBe('Ready')
    if (loaded.status !== 'Ready') return
    expect(loaded.underlyingSeries.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ date: '2026-11-23', status: 'Available', price: '90.00' }),
    ]))
    expect(loaded.detail.earlierMarks.every(s => s.status !== 'Available')).toBe(true)
    expect(await snapshot(db)).toEqual(before)
  })
})
