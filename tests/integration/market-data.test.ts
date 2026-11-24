import { describe, expect, it } from 'vitest'
import { openDb, repo } from '../../src/persistence/db'
import { saveManualMark, type SaveManualMarkRequest } from '../../src/ui/market-controller'
import { resolveKey, type ObservationRecord } from '../../src/domain/market-data'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}
const blocked: ReadinessEvidence = {
  outcome: 'RecoveryOnly', passed: false, failedChecks: ['diagnostic-transaction'],
  protection: { kind: 'BestEffort', reason: 'test' },
}
const request: SaveManualMarkRequest = {
  instrument: 'AAPL', date: '2026-11-23', expectedRevision: '0', intention: 'RecordManualMark',
  price: '210.00', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:05:00Z', readiness: writable,
}

describe('market persistence integration (mock-free)', () => {
  it('should commit the resolution revision and history in one transaction and survive restart', async () => {
    const db = await openDb()
    const result = await saveManualMark(request, db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const reopened = await openDb()
    const stored = await repo.get<ObservationRecord>(reopened, 'market', 'AAPL:2026-11-23')
    expect(stored?.revision).toBe('1')
    expect(stored?.marks).toHaveLength(1)
    expect(resolveKey(stored, '2026-11-23', [])).toMatchObject({ status: 'Available', price: '210.00' })
  })

  it('should return RuntimeNotWritable and change nothing when readiness is not Writable', async () => {
    const db = await openDb()
    const before = (await repo.all(db, 'market')).length
    const result = await saveManualMark({ ...request, readiness: blocked }, db)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect('runtimeNotWritable' in result.error).toBe(true)
    expect((await repo.all(db, 'market')).length).toBe(before)
  })

  it('should produce a post-commit result equal to durable state without a follow-up read', async () => {
    const db = await openDb()
    const result = await saveManualMark({ ...request, instrument: 'NVDA' }, db)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = await repo.get<ObservationRecord>(db, 'market', 'NVDA:2026-11-23')
    expect(stored?.revision).toBe(result.value.revision)
    expect(stored?.marks).toEqual(result.value.record.marks)
    expect(result.value.postCommit).toEqual(result.value.resolution)
  })

  it('should reject a stale revision with no write', async () => {
    const db = await openDb()
    await saveManualMark(request, db)
    const before = (await repo.all(db, 'market')).length
    const result = await saveManualMark({ ...request, expectedRevision: '9', price: '999.00' }, db)
    expect(result.ok).toBe(false)
    expect((await repo.all(db, 'market')).length).toBe(before)
  })
})
