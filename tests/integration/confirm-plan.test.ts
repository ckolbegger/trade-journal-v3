import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { confirmPlan } from '../../src/domain/confirm-plan'

const command = {
  account: { id: 'acct-1', institutionId: 'inst-1', label: 'Main', active: true, revision: '1', history: [] },
  strategy: { id: 'seed-long-stock', label: 'Long Stock', active: true, revision: '1' },
  plan: { strategyId: 'seed-long-stock', underlying: 'AAPL', quantity: 10, entry: '100.00', stop: '95.00', target: '110.00' },
  reflection: { thesis: 'Why now', invalidation: 'Close below 50d' },
  definitionRevision: 'D1',
  economicTime: '2026-11-24T20:00:00Z',
}

describe('confirmPlan integration (mock-free)', () => {
  it('should commit Trade and Entry atomically and survive restart', async () => {
    const db = await openDb()
    const result = confirmPlan(command)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    await transaction(db, ['trade', 'journal'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'trade', { id: result.value.trade.id, ...result.value.trade })
      await repo.putInTx(tx, 'journal', { id: `entry-${result.value.trade.id}`, ...result.value.entry })
    })

    const reopened = await openDb()
    const stored = await repo.get<{ lifecycle: string }>(reopened, 'trade', result.value.trade.id)
    expect(stored?.lifecycle).toBe('Planned')
    const entry = await repo.get(reopened, 'journal', `entry-${result.value.trade.id}`)
    expect(entry).toBeDefined()
  })

  it('should write nothing when validation fails', async () => {
    const db = await openDb()
    const before = (await repo.all(db, 'trade')).length
    const result = confirmPlan({ ...command, reflection: { thesis: '', invalidation: 'I' } })
    expect(result.ok).toBe(false)
    const after = (await repo.all(db, 'trade')).length
    expect(after).toBe(before)
  })

  it('should produce a revision-bound result sufficient without a read-back', async () => {
    const result = confirmPlan(command)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.revisions.trade).toBe('1')
      expect(result.value.postCommit.trade).toEqual(result.value.trade)
    }
  })
})
