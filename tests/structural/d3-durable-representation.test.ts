import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'

describe('D3 durable representation (S2 structural)', () => {
  it('should persist Execution fact identities, Economic Time and Recorded Sequence', async () => {
    const db = await openDb()
    await transaction(db, ['trade'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'trade', {
        id: 'trade-durable', lifecycle: 'Open', revision: '2',
        executions: [{ id: 'exec-1', tradeId: 'trade-durable', instrument: 'AAPL', action: 'Buy', quantity: '10', price: '100.00', fee: '5.00', economicTime: '2026-11-24T20:00:00Z', recordedSequence: 1, plannedLegId: 'leg-1' }],
        lots: [{ id: 'lot-exec-1', executionId: 'exec-1', quantity: '10', basis: '1005.00', allocatedOpeningFee: '5.00' }],
      })
    })
    const stored = await repo.get<Record<string, unknown>>(db, 'trade', 'trade-durable')
    const execution = (stored?.executions as Record<string, unknown>[])[0]
    expect(execution.economicTime).toBe('2026-11-24T20:00:00Z')
    expect(execution.recordedSequence).toBe(1)
    expect(stored?.lots).toHaveLength(1)
  })

  it('should persist the lifecycle index membership and the trigger-time Debt snapshot without a blank Entry', async () => {
    const db = await openDb()
    await transaction(db, ['trade', 'journal'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'trade', {
        id: 'lifecycle-index-durable', members: { Planned: [], Open: ['trade-durable'], Closed: [], Abandoned: [] },
      })
      await repo.putInTx(tx, 'journal', {
        id: 'debt-pc-1', kind: 'Debt', obligationKey: 'PositionChange:pc-1',
        snapshot: { definitionRevision: 'D1', prompts: [{ id: 'decisionMode', required: true }] },
      })
    })
    const index = await repo.get<{ members: { Open: string[] } }>(db, 'trade', 'lifecycle-index-durable')
    expect(index?.members.Open).toEqual(['trade-durable'])
    const debt = await repo.get<{ kind: string }>(db, 'journal', 'debt-pc-1')
    expect(debt?.kind).toBe('Debt')
    const entries = (await repo.all<{ kind: string }>(db, 'journal')).filter(j => j.kind === 'Entry')
    expect(entries).toEqual([])
  })
})
