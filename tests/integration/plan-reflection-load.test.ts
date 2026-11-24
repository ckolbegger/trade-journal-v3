import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { loadPlannedTrades } from '../../src/ui/plan-controller'

describe('Planned detail loads the saved reflection (mock-free)', () => {
  it('should return the persisted Thesis and Invalidation answers from the journal store', async () => {
    const db = await openDb()
    const tradeId = 'trade-reflection-load'
    await transaction(db, ['trade', 'journal'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'trade', {
        id: tradeId,
        lifecycle: 'Planned',
        plan: { oneR: '50.00', baseline: '2.00', underlying: 'AAPL', quantity: 10, entry: '100', stop: '95', target: '110' },
        economicTime: '2026-11-24T20:00:00Z',
      })
      await repo.putInTx(tx, 'journal', {
        id: `entry-${tradeId}`,
        snapshot: {
          definitionRevision: 'D1',
          answers: { Thesis: 'Why now', Invalidation: 'Close below 95' },
          source: 'Plan Confirmation',
        },
      })
    })

    const trades = await loadPlannedTrades()
    const loaded = trades.find(t => t.trade.id === tradeId)
    expect(loaded).toBeDefined()
    expect(JSON.stringify(loaded?.entry)).toContain('Why now')
    expect(JSON.stringify(loaded?.entry)).toContain('Close below 95')
  })
})
