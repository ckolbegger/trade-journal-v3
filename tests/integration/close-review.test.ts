import { describe, expect, it } from 'vitest'
import { openDb, repo } from '../../src/persistence/db'
import { saveCloseReview, answerDeferredCloseReview } from '../../src/ui/close-review-controller'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}
const blocked: ReadinessEvidence = {
  outcome: 'RecoveryOnly', passed: false, failedChecks: ['service-worker'],
  protection: { kind: 'BestEffort', reason: 'test' },
}
const ECONOMIC_TIME = '2026-11-23T20:00:00Z'

const request = (tradeId: string, disposition: Parameters<typeof saveCloseReview>[0]['disposition'], readiness = writable) => ({
  tradeId, definitionRevision: 'D1', economicTime: ECONOMIC_TIME,
  authoredAt: '2026-11-23T20:05:00Z', disposition, readiness,
})

describe('Close Review save integration (mock-free)', () => {
  it('should commit one immutable Entry with the D1 snapshot and no Trade write', async () => {
    const db = await openDb()
    const result = await saveCloseReview(request('trade-complete', {
      kind: 'Complete', form: { takeAgain: 'No', keyLesson: 'Wait for confirmation' },
    }), db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const entry = await repo.get<{ id: string; source: string; obligationKey: string }>(db, 'journal', `entry-CloseReview:trade-complete`)
    expect(entry).toMatchObject({
      id: 'entry-CloseReview:trade-complete', source: 'Trade Close', obligationKey: 'CloseReview:trade-complete',
    })
    expect(await repo.get(db, 'journal', 'debt-CloseReview:trade-complete')).toBeUndefined()
    expect(await repo.get(db, 'journal', 'decline-CloseReview:trade-complete')).toBeUndefined()
    expect(await repo.all(db, 'trade')).toEqual([])
  })

  it('should settle a deferred Close Review Debt and its Entry in one journal transaction', async () => {
    const db = await openDb()
    const deferred = await saveCloseReview(request('trade-defer', { kind: 'Defer' }), db)
    expect(deferred.ok).toBe(true)
    const debt = await repo.get<{ status: string; dueAt: string; snapshot: { prompts: unknown[] } }>(db, 'journal', 'debt-CloseReview:trade-defer')
    expect(debt).toMatchObject({ status: 'Outstanding', dueAt: '2026-11-23' })
    expect(debt?.snapshot.prompts).toHaveLength(3)
    expect(await repo.get(db, 'journal', 'entry-CloseReview:trade-defer')).toBeUndefined()

    const answered = await answerDeferredCloseReview({
      obligationKey: 'CloseReview:trade-defer', form: { takeAgain: 'Yes, as planned' },
      definitionRevision: 'D1', authoredAt: '2026-11-23T20:10:00Z', readiness: writable,
    }, db)
    expect(answered.ok).toBe(true)
    const entry = await repo.get<{ settlesDebtId: string; definitionRevision: string }>(db, 'journal', 'entry-CloseReview:trade-defer')
    expect(entry).toMatchObject({ settlesDebtId: 'debt-CloseReview:trade-defer', definitionRevision: 'D1' })
    expect((await repo.get<{ status: string }>(db, 'journal', 'debt-CloseReview:trade-defer'))?.status).toBe('Settled')
  })

  it('should return RuntimeNotWritable and change nothing when readiness is not Writable', async () => {
    const db = await openDb()
    const result = await saveCloseReview(request('trade-blocked', { kind: 'Defer' }, blocked), db)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('RuntimeNotWritable')
    expect(await repo.get(db, 'journal', 'debt-CloseReview:trade-blocked')).toBeUndefined()
  })

  it('should reject a second outcome for the same obligation with no duplicate row', async () => {
    const db = await openDb()
    await saveCloseReview(request('trade-once', { kind: 'Defer' }), db)
    const retry = await saveCloseReview(request('trade-once', {
      kind: 'Complete', form: { takeAgain: 'No' },
    }), db)
    expect(retry.ok).toBe(false)
    if (retry.ok) return
    expect(retry.error.kind).toBe('Conflict')
    const rows = (await repo.all<{ obligationKey?: string }>(db, 'journal'))
      .filter(r => r.obligationKey === 'CloseReview:trade-once')
    expect(rows).toHaveLength(1)
  })

  it('should survive a DB reopen with the same outcome revision', async () => {
    const db = await openDb()
    await saveCloseReview(request('trade-reopen', {
      kind: 'Complete', form: { takeAgain: 'Unsure' },
    }), db)
    const reopened = await openDb()
    const entry = await repo.get<{ revision: string; snapshot: { answers: Record<string, string> } }>(reopened, 'journal', 'entry-CloseReview:trade-reopen')
    expect(entry?.revision).toBe('1')
    expect(entry?.snapshot.answers).toEqual({ TakeAgain: 'Unsure' })
  })

  it('should record a distinct JournalDecline with no Entry or Debt', async () => {
    const db = await openDb()
    const result = await saveCloseReview(request('trade-decline', {
      kind: 'Decline', reason: 'not useful',
    }), db)
    expect(result.ok).toBe(true)
    const decline = await repo.get<{ kind: string; reason: string }>(db, 'journal', 'decline-CloseReview:trade-decline')
    expect(decline).toMatchObject({ kind: 'JournalDecline', reason: 'not useful' })
    expect(await repo.get(db, 'journal', 'entry-CloseReview:trade-decline')).toBeUndefined()
    expect(await repo.get(db, 'journal', 'debt-CloseReview:trade-decline')).toBeUndefined()
  })
})
