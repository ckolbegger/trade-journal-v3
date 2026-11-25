import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { openReview, saveTradeAction, resolveReviewDebt } from '../../src/ui/review-controller'
import { saveManualMark } from '../../src/ui/market-controller'
import { recordOpeningPositionChange } from '../../src/ui/position-controller'
import { dailyActionKey } from '../../src/domain/daily-action'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}
const blocked: ReadinessEvidence = {
  outcome: 'RecoveryOnly', passed: false, failedChecks: ['service-worker'],
  protection: { kind: 'BestEffort', reason: 'test' },
}
const NOW = new Date('2026-11-24T17:00:00Z')

async function fixture(tradeId: string, price?: string) {
  const instrument = tradeId.replace('trade-', '').toUpperCase()
  const db = await openDb()
  await transaction(db, ['trade'], 'readwrite', async tx => {
    await repo.putInTx(tx, 'trade', {
      id: tradeId, lifecycle: 'Planned', revision: '1', economicTime: '2026-11-23T20:00:00Z',
      plan: { underlying: instrument, quantity: 10, entry: '100.00', stop: '95.00', target: '110.00', oneR: '50.00', baseline: '2.00' },
    })
    const index = await repo.getInTx<{ members: Record<string, string[]> }>(tx, 'trade', 'lifecycle-index')
    const members = index?.members ?? { Planned: [], Open: [], Closed: [], Abandoned: [] }
    members.Planned.push(tradeId)
    await repo.putInTx(tx, 'trade', { id: 'lifecycle-index', members })
  })
  await recordOpeningPositionChange({
    tradeId, expectedRevision: '1', positionChangeId: `pc-${tradeId}`,
    economicTime: '2026-11-23T20:00:00Z',
    executions: [{ id: `exec-${tradeId}`, instrument, action: 'Buy', quantity: '10', price: '100.00', fee: '5.00', economicTime: '2026-11-23T20:00:00Z', plannedLegId: 'leg-1' }],
    reflection: { definitionRevision: 'D1', disposition: { kind: 'Defer' } },
    readiness: writable,
  }, db)
  if (price) {
    await saveManualMark({
      instrument, date: '2026-11-23', expectedRevision: '0', intention: 'RecordManualMark',
      price, observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-24T17:00:00Z', readiness: writable,
    }, db)
  }
  return db
}

const save = (db: Awaited<ReturnType<typeof openDb>>, tradeId: string, digest: string, readiness = writable) => saveTradeAction({
  tradeId, reviewDate: '2026-11-23', definitionRevision: 'D1',
  form: { action: 'Hold' }, expectedDigest: digest, expectedTradeRevision: '2',
  readiness, now: NOW,
}, db)

describe('DailyReview.save integration (mock-free)', () => {
  it('should commit one dated Action Entry and one reconciled Stop episode atomically', async () => {
    const id = 'trade-atomic'
    const db = await fixture(id, '90.00')
    const view = await openReview(NOW, db)
    const result = await save(db, id, view.snapshot.digest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const entry = await repo.get(db, 'journal', dailyActionKey(id, '2026-11-23'))
    expect(entry).toBeDefined()
    const stored = await repo.get<{ deviations?: unknown[] }>(db, 'trade', id)
    expect(stored?.deviations).toHaveLength(1)
    expect(result.value.occurrences).toHaveLength(1)
  })

  it('should return ReviewChanged with no write when the Mark changed before Save', async () => {
    const id = 'trade-changed'
    const db = await fixture(id, '90.00')
    const view = await openReview(NOW, db)
    await saveManualMark({
      instrument: id.replace('trade-', '').toUpperCase(), date: '2026-11-23', expectedRevision: '1', intention: 'ManualOverride',
      price: '97.00', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-24T17:10:00Z', readiness: writable,
    }, db)
    const result = await save(db, id, view.snapshot.digest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('ReviewChanged')
    expect(await repo.get(db, 'journal', dailyActionKey(id, '2026-11-23'))).toBeUndefined()
  })

  it('should block Save with no write while the exact Mark is Missing (P1)', async () => {
    const id = 'trade-gated'
    const db = await fixture(id)
    const view = await openReview(NOW, db)
    const result = await save(db, id, view.snapshot.digest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('MarkMissing')
    expect(await repo.get(db, 'journal', dailyActionKey(id, '2026-11-23'))).toBeUndefined()
  })

  it('should return RuntimeNotWritable and change nothing when readiness is not Writable', async () => {
    const id = 'trade-blocked'
    const db = await fixture(id, '90.00')
    const view = await openReview(NOW, db)
    const result = await save(db, id, view.snapshot.digest, blocked)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('RuntimeNotWritable')
    expect(await repo.get(db, 'journal', dailyActionKey(id, '2026-11-23'))).toBeUndefined()
  })

  it('should return NeedsTradeWorkflow for a workflow-routed Debt with no write', async () => {
    const db = await fixture('trade-debt', '90.00')
    await transaction(db, ['journal'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'journal', {
        id: 'debt-management', kind: 'Debt', obligationKey: 'ManagementRevision:trade-debt',
        settlementRoute: 'TradeWorkflows.reviseManagement',
      })
    })
    const result = await resolveReviewDebt({ debtId: 'debt-management', form: { text: 'answer' }, readiness: writable }, db)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.kind).toBe('NeedsTradeWorkflow')
    expect(await repo.get(db, 'journal', 'debt-management')).toBeDefined()
  })
})
