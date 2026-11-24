import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction, type Db } from '../../src/persistence/db'
import {
  getOpenTradeDetail, queryOpenTrades, readLifecycleIndex, toBrowseRows,
} from '../../src/domain/open-views'
import { recordOpeningPositionChange } from '../../src/ui/position-controller'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [],
  protection: { kind: 'BestEffort', reason: 'browser-managed' },
}

async function seedAndOpen(db: Db) {
  await transaction(db, ['trade'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', {
      id: 'trade-aapl', lifecycle: 'Planned', revision: '1', economicTime: '2026-11-24T20:00:00Z',
      plan: { underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
    })
    await repo.putInTx(tx, 'trade', {
      id: 'lifecycle-index', members: { Planned: ['trade-aapl'], Open: [], Closed: [], Abandoned: [] },
    })
  })
  const result = await recordOpeningPositionChange({
    tradeId: 'trade-aapl', expectedRevision: '1', positionChangeId: 'pc-1',
    economicTime: '2026-11-24T20:00:00Z',
    executions: [{ id: 'exec-1', instrument: 'AAPL', action: 'Buy', quantity: '10', price: '100.00', fee: '5.00', economicTime: '2026-11-24T20:00:00Z', plannedLegId: 'leg-1' }],
    reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
    readiness: writable,
  }, db)
  expect(result.ok).toBe(true)
}

describe('Open trade reads integration (mock-free)', () => {
  it('should list Open Trades from the durable lifecycle index with Position and fees after restart', async () => {
    const db = await openDb()
    await seedAndOpen(db)
    const reopened = await openDb()
    const rows = await queryOpenTrades(reopened)
    expect(toBrowseRows(rows)).toEqual([{
      id: 'trade-aapl', lifecycle: 'Open', underlying: 'AAPL',
      netQuantity: '10', allocatedOpeningFees: '5.00', factRevision: '2',
    }])
    expect((await readLifecycleIndex(reopened)).members.Open).toEqual(['trade-aapl'])
  })

  it('should return a coherent Open detail with Executions, Lots and history', async () => {
    const db = await openDb()
    await seedAndOpen(db)
    const detail = await getOpenTradeDetail(db, 'trade-aapl')
    expect(detail.status).toBe('Ready')
    if (detail.status !== 'Ready') return
    expect(detail.trade.executions).toHaveLength(1)
    expect(detail.trade.lots[0].allocatedOpeningFee).toBe('5.00')
    expect(detail.history.map(h => [h.id, h.recordedSequence])).toEqual([['exec-1', 1]])
    expect(detail.integrity.agreement).toBe(true)
  })

  it('should return NotFound for an unknown Trade without mutating the index', async () => {
    const db = await openDb()
    await seedAndOpen(db)
    expect(await getOpenTradeDetail(db, 'trade-unknown')).toEqual({ status: 'NotFound' })
    expect((await readLifecycleIndex(db)).members.Open).toEqual(['trade-aapl'])
  })
})
