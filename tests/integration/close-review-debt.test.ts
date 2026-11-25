import { describe, expect, it } from 'vitest'
import { openDb, repo } from '../../src/persistence/db'
import { saveCloseReview } from '../../src/ui/close-review-controller'
import { openReview, resolveReviewDebt, isDebtDueAt } from '../../src/ui/review-controller'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}
const NOW = new Date('2026-11-24T17:00:00Z')

const defer = (tradeId: string, economicTime: string) => saveCloseReview({
  tradeId, definitionRevision: 'D1', economicTime, disposition: { kind: 'Defer' }, readiness: writable,
})

describe('Close Review due Debt', () => {
  it('should be due only when the next Review Date is at or before the Review cutoff', () => {
    expect(isDebtDueAt({ kind: 'Debt', status: 'Outstanding', dueAt: '2026-11-23' }, '2026-11-23')).toBe(true)
    expect(isDebtDueAt({ kind: 'Debt', status: 'Outstanding', dueAt: '2026-11-25' }, '2026-11-23')).toBe(false)
    expect(isDebtDueAt({ kind: 'Debt', status: 'Settled', dueAt: '2026-11-23' }, '2026-11-23')).toBe(false)
  })

  it('should keep older Debts without a due date due for backward compatibility', () => {
    expect(isDebtDueAt({ kind: 'Debt', status: 'Outstanding' }, '2026-11-23')).toBe(true)
  })

  it('should appear in the Review task families and block Review completion while outstanding', async () => {
    const db = await openDb()
    await defer('trade-due', '2026-11-23T20:00:00Z')
    const view = await openReview(NOW, db)
    expect(view.reviewDate).toBe('2026-11-23')
    expect(view.dueDebt.some(d => d.id === 'debt-CloseReview:trade-due')).toBe(true)
    expect(view.tasks.some(t => t.kind === 'Debt' && t.items.includes('debt-CloseReview:trade-due'))).toBe(true)
    expect(view.completion.state).toBe('Incomplete')
    expect(view.completion.blockers).toContain('DebtDue')
  })

  it('should not be due at a Review before its next Review Date', async () => {
    const db = await openDb()
    await defer('trade-future', '2026-11-25T20:00:00Z')
    const view = await openReview(NOW, db)
    expect(view.dueDebt.some(d => d.id === 'debt-CloseReview:trade-future')).toBe(false)
  })

  it('should answer a deferred Close Review against its original D1 snapshot and settle the Debt atomically', async () => {
    const db = await openDb()
    await defer('trade-answer', '2026-11-23T20:00:00Z')
    const result = await resolveReviewDebt({
      debtId: 'debt-CloseReview:trade-answer',
      form: { answers: { takeAgain: 'Yes, with changes' } },
      definitionRevision: 'D1', authoredAt: '2026-11-23T20:10:00Z', readiness: writable,
    }, db)
    expect(result.ok).toBe(true)
    const entry = await repo.get<{ definitionRevision: string; snapshot: { answers: Record<string, string> } }>(db, 'journal', 'entry-CloseReview:trade-answer')
    expect(entry).toMatchObject({ definitionRevision: 'D1' })
    expect(entry?.snapshot.answers).toEqual({ TakeAgain: 'Yes, with changes' })
    expect((await repo.get<{ status: string }>(db, 'journal', 'debt-CloseReview:trade-answer'))?.status).toBe('Settled')
    const view = await openReview(NOW, db)
    expect(view.dueDebt.some(d => d.id === 'debt-CloseReview:trade-answer')).toBe(false)
  })

  it('should never block a later factual Journal recording while a Debt is outstanding', async () => {
    const db = await openDb()
    await defer('trade-blocker', '2026-11-23T20:00:00Z')
    const unrelated = await saveCloseReview({
      tradeId: 'trade-unrelated', definitionRevision: 'D1', economicTime: '2026-11-23T20:00:00Z',
      disposition: { kind: 'Complete', form: { takeAgain: 'No' } }, readiness: writable,
    }, db)
    expect(unrelated.ok).toBe(true)
  })
})
