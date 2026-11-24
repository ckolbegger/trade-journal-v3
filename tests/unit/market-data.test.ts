import { describe, expect, it } from 'vitest'
import { resolveKey, saveMark, type ObservationRecord, type SaveMarkCommand } from '../../src/domain/market-data'

const empty: ObservationRecord = {
  id: 'AAPL:2026-11-23', instrument: 'AAPL', date: '2026-11-23', revision: '0',
  marks: [], acknowledgments: [],
}
const save: SaveMarkCommand = {
  instrument: 'AAPL', date: '2026-11-23', expectedRevision: '0',
  intention: 'RecordManualMark', price: '210.00', observedAt: '2026-11-23T20:00:00Z',
  savedAt: '2026-11-23T20:05:00Z',
}

describe('MarketData.save and resolution', () => {
  it('should record an initial Manual Mark as Available at its exact date and return a revision-bound post-commit result', () => {
    const result = saveMark(save, empty)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.revision).toBe('1')
    expect(result.value.resolution).toMatchObject({ status: 'Available', price: '210.00', source: 'Manual' })
    expect(resolveKey(result.value.record, '2026-11-23', [])).toMatchObject({ status: 'Available', price: '210.00' })
  })

  it('should record a deliberate Manual override and a reasoned correction as distinct saved intentions', () => {
    const first = saveMark(save, empty)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const override = saveMark({ ...save, expectedRevision: '1', intention: 'ManualOverride', price: '212.00' }, first.value.record)
    expect(override.ok).toBe(true)
    if (!override.ok) return
    const correction = saveMark({ ...save, expectedRevision: '2', intention: 'CorrectMark', price: '211.50', reason: 'bad decimal' }, override.value.record)
    expect(correction.ok).toBe(true)
    if (!correction.ok) return
    expect(correction.value.record.marks.map(m => m.intention)).toEqual(['RecordManualMark', 'ManualOverride', 'CorrectMark'])
    expect(correction.value.record.marks[2].reason).toBe('bad decimal')
  })

  it('should assert an unavailable acknowledgment with a reason and no price, and withdraw a mistaken acknowledgment', () => {
    const acknowledged = saveMark({ ...save, intention: 'AcknowledgeUnavailable', price: undefined, reason: 'no close published' }, empty)
    expect(acknowledged.ok).toBe(true)
    if (!acknowledged.ok) return
    expect(acknowledged.value.resolution).toMatchObject({ status: 'AcknowledgedUnavailable', reason: 'no close published' })
    expect(JSON.stringify(acknowledged.value.record.marks)).not.toContain('price')
    const withdrawn = saveMark({ ...save, expectedRevision: '1', intention: 'WithdrawAcknowledgment' }, acknowledged.value.record)
    expect(withdrawn.ok).toBe(true)
    if (!withdrawn.ok) return
    expect(resolveKey(withdrawn.value.record, '2026-11-23', [])).toMatchObject({ status: 'Missing' })
    expect(withdrawn.value.record.acknowledgments).toHaveLength(2)
  })

  it('should keep an effective Manual Mark sticky against a later provider close', () => {
    const manual = saveMark(save, empty)
    expect(manual.ok).toBe(true)
    if (!manual.ok) return
    const provider = saveMark({
      ...save, expectedRevision: '1', intention: 'ProviderClose', price: '250.00', source: 'Provider',
    }, manual.value.record)
    expect(provider.ok).toBe(false)
    if (provider.ok) return
    expect(provider.error.issues).toContain('ManualSticky')
    expect(resolveKey(manual.value.record, '2026-11-23', [])).toMatchObject({ status: 'Available', price: '210.00' })
  })

  it('should make a later exact Mark Available while the earlier acknowledgment stays in history', () => {
    const acknowledged = saveMark({ ...save, intention: 'AcknowledgeUnavailable', price: undefined, reason: 'no close' }, empty)
    expect(acknowledged.ok).toBe(true)
    if (!acknowledged.ok) return
    const marked = saveMark({ ...save, expectedRevision: '1', intention: 'RecordManualMark', price: '209.00' }, acknowledged.value.record)
    expect(marked.ok).toBe(true)
    if (!marked.ok) return
    expect(resolveKey(marked.value.record, '2026-11-23', [])).toMatchObject({ status: 'Available', price: '209.00' })
    expect(marked.value.record.acknowledgments).toHaveLength(1)
  })

  it('should reject a stale resolution revision with typed issues and no write', () => {
    const result = saveMark({ ...save, expectedRevision: '7' }, empty)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.issues).toContain('StaleRevision')
    expect(empty.marks).toEqual([])
  })
})
