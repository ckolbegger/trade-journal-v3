import { describe, expect, it } from 'vitest'
import { resolveFrames, type ObservationRecord } from '../../src/domain/market-frames'

const mark = (date: string, price: string): ObservationRecord => ({
  id: `AAPL:${date}`, instrument: 'AAPL', date, revision: '1',
  marks: [{ revision: '1', price, source: 'Manual', intention: 'RecordManualMark', observedAt: `${date}T20:00:00Z`, savedAt: `${date}T20:05:00Z` }],
  acknowledgments: [],
})

describe('ResolveFrames', () => {
  it('should report the latest completed session as Available, not Stale, at noon Tuesday after a normal Monday session', () => {
    const result = resolveFrames({
      instrument: 'AAPL', fromDate: '2026-11-23', toDate: '2026-11-24',
      now: new Date('2026-11-24T17:00:00Z'), records: [mark('2026-11-23', '210.00')],
    })
    expect(result.expectedDate).toBe('2026-11-23')
    expect(result.frames).toEqual([{
      instrument: 'AAPL', date: '2026-11-23', status: 'Available', price: '210.00',
      revision: '1', stale: undefined,
    }])
    expect(result.gaps).toEqual([])
  })

  it('should report Missing or Acknowledged Unavailable with older Stale context and never use it as a value', () => {
    const acknowledged: ObservationRecord = {
      id: 'AAPL:2026-11-24', instrument: 'AAPL', date: '2026-11-24', revision: '1',
      marks: [], acknowledgments: [{ revision: '1', reason: 'no close', observedAt: '2026-11-24T20:00:00Z', savedAt: '2026-11-24T20:05:00Z' }],
    }
    const result = resolveFrames({
      instrument: 'AAPL', fromDate: '2026-11-23', toDate: '2026-11-24',
      now: new Date('2026-11-24T21:00:00Z'),
      records: [mark('2026-11-23', '205.00'), acknowledged],
    })
    expect(result.frames[1].status).toBe('AcknowledgedUnavailable')
    expect(result.frames[1].price).toBeUndefined()
    expect(result.frames[1].stale).toMatchObject({ date: '2026-11-23', price: '205.00' })
  })

  it('should enumerate completed sessions with explicit gaps and no interpolation or fabricated candle', () => {
    const result = resolveFrames({
      instrument: 'AAPL', fromDate: '2026-11-23', toDate: '2026-11-27',
      now: new Date('2026-11-30T21:00:00Z'), records: [mark('2026-11-23', '210.00'), mark('2026-11-25', '212.00')],
    })
    expect(result.frames.map(f => [f.date, f.status])).toEqual([
      ['2026-11-23', 'Available'], ['2026-11-24', 'Missing'],
      ['2026-11-25', 'Available'], ['2026-11-26', 'Missing'], ['2026-11-27', 'Missing'],
    ])
    expect(result.gaps).toEqual(['2026-11-24', '2026-11-26', '2026-11-27'])
  })

  it('should bind frames to a snapshot id and evidence digest that changes when evidence changes', () => {
    const base = {
      instrument: 'AAPL', fromDate: '2026-11-23', toDate: '2026-11-23',
      now: new Date('2026-11-24T21:00:00Z'), records: [mark('2026-11-23', '210.00')],
    }
    const first = resolveFrames(base)
    const same = resolveFrames(base)
    const changed = resolveFrames({ ...base, records: [mark('2026-11-23', '211.00')] })
    expect(first.snapshotId).toBe(same.snapshotId)
    expect(first.digest).toBe(same.digest)
    expect(changed.snapshotId).not.toBe(first.snapshotId)
    expect(changed.digest).not.toBe(first.digest)
    expect(first.sessionPolicy).toBe('v1')
  })
})
