import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { applyActionOutcome, dailyActionKey, prepareAction } from '../../src/domain/daily-action'

describe('D5 durable representation (S2 structural)', () => {
  it('should persist one dated Action Entry bound to Trade, Review Date and origin', async () => {
    const db = await openDb()
    const key = dailyActionKey('trade-aapl', '2026-11-23')
    const prepared = prepareAction({ action: 'Hold' }, 'D1', key, 'trade-aapl', '2026-11-23')
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const applied = applyActionOutcome(undefined, prepared.value, 'action-1', undefined)
    expect(applied.ok).toBe(true)
    if (!applied.ok) return

    await transaction(db, ['journal'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'journal', { ...applied.value.entry, id: key })
    })
    const reopened = await openDb()
    const stored = await repo.get<{ obligationKey: string; snapshot: { origin: unknown } }>(reopened, 'journal', key)
    expect(stored?.obligationKey).toBe(key)
    expect(stored?.snapshot.origin).toMatchObject({ kind: 'DailyReview', tradeId: 'trade-aapl', reviewDate: '2026-11-23' })
  })

  it('should persist a Stop-Discipline occurrence fingerprint without a Review session or finish flag', async () => {
    const db = await openDb()
    await transaction(db, ['trade'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'trade', {
        id: 'trade-dev', lifecycle: 'Open', revision: '3',
        deviations: [{ fingerprint: 'trade-dev:stop-underlying:2026-11-17', kind: 'StopDiscipline', start: '2026-11-17', active: false }],
      })
    })
    const stored = await repo.get<{ deviations: { fingerprint: string }[] }>(db, 'trade', 'trade-dev')
    expect(stored?.deviations[0].fingerprint).toBe('trade-dev:stop-underlying:2026-11-17')
    expect('reviewSession' in (stored ?? {})).toBe(false)
    expect('finishFlag' in (stored ?? {})).toBe(false)
  })
})
