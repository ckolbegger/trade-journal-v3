import { describe, expect, it } from 'vitest'
import { openDb, repo } from '../../src/persistence/db'
import { saveManualMark } from '../../src/ui/market-controller'
import { resolveFrames } from '../../src/domain/market-frames'
import type { ObservationRecord } from '../../src/domain/market-data'
import type { ReadinessEvidence } from '../../src/domain/types'

const writable: ReadinessEvidence = {
  outcome: 'Writable', passed: true, failedChecks: [], protection: { kind: 'BestEffort', reason: 'test' },
}

describe('ResolveFrames integration (mock-free)', () => {
  it('should read persisted frames after restart with the expected date Available', async () => {
    const db = await openDb()
    await saveManualMark({
      instrument: 'AAPL', date: '2026-11-23', expectedRevision: '0', intention: 'RecordManualMark',
      price: '210.00', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:05:00Z', readiness: writable,
    }, db)
    const reopened = await openDb()
    const records = await repo.all<ObservationRecord>(reopened, 'market')
    const result = resolveFrames({
      instrument: 'AAPL', fromDate: '2026-11-23', toDate: '2026-11-23',
      now: new Date('2026-11-24T17:00:00Z'), records,
    })
    expect(result.expectedDate).toBe('2026-11-23')
    expect(result.frames[0]).toMatchObject({ status: 'Available', price: '210.00' })
    expect(result.gaps).toEqual([])
    expect(result.frames[0].stale).toBeUndefined()
  })

  it('should show explicit gaps and Stale context from persisted history only', async () => {
    const db = await openDb()
    await saveManualMark({
      instrument: 'AAPL', date: '2026-11-23', expectedRevision: '0', intention: 'RecordManualMark',
      price: '210.00', observedAt: '2026-11-23T20:00:00Z', savedAt: '2026-11-23T20:05:00Z', readiness: writable,
    }, db)
    const records = await repo.all<ObservationRecord>(db, 'market')
    const result = resolveFrames({
      instrument: 'AAPL', fromDate: '2026-11-23', toDate: '2026-11-24',
      now: new Date('2026-11-24T21:00:00Z'), records,
    })
    expect(result.frames.map(f => f.status)).toEqual(['Available', 'Missing'])
    expect(result.gaps).toEqual(['2026-11-24'])
    expect(result.frames[1].stale).toMatchObject({ date: '2026-11-23', price: '210.00' })
  })
})
