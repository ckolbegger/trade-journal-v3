import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { saveMark } from '../../src/domain/market-data'

describe('D4 durable market representation (S2 structural)', () => {
  it('should persist immutable Mark revision chains with source and intention', async () => {
    const db = await openDb()
    const first = saveMark({
      instrument: 'AAPL', date: '2026-11-23', expectedRevision: '0', intention: 'RecordManualMark',
      price: '210.00', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:05:00Z',
    }, { id: 'AAPL:2026-11-23', instrument: 'AAPL', date: '2026-11-23', revision: '0', marks: [], acknowledgments: [] })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    await transaction(db, ['market'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'market', first.value.record)
    })
    const reopened = await openDb()
    const stored = await repo.get<{ marks: { intention: string; price: string }[] }>(reopened, 'market', 'AAPL:2026-11-23')
    expect(stored?.marks).toHaveLength(1)
    expect(stored?.marks[0].intention).toBe('RecordManualMark')
    expect(stored?.marks[0].price).toBe('210.00')
  })

  it('should persist an acknowledgment with a reason and no price', async () => {
    const result = saveMark({
      instrument: 'MSFT', date: '2026-11-23', expectedRevision: '0', intention: 'AcknowledgeUnavailable',
      reason: 'no close', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:05:00Z',
    }, { id: 'MSFT:2026-11-23', instrument: 'MSFT', date: '2026-11-23', revision: '0', marks: [], acknowledgments: [] })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(JSON.stringify(result.value.record)).not.toContain('"price"')
    expect(result.value.record.acknowledgments[0].reason).toBe('no close')
  })
})
