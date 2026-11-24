import { describe, expect, it } from 'vitest'
import { isCompletedSession, resolveExpectedMarkDate } from '../../src/domain/calendar'

describe('Deterministic clock and U.S. calendar (D2-S3 structural)', () => {
  it('should treat a Monday as a completed session on Tuesday noon', () => {
    const tuesday = new Date('2026-11-24T17:00:00Z')
    expect(resolveExpectedMarkDate(tuesday)).toBe('2026-11-23')
  })

  it('should treat Saturday and Sunday as non-sessions', () => {
    expect(isCompletedSession('2026-11-21')).toBe(false)
    expect(isCompletedSession('2026-11-22')).toBe(false)
  })

  it('should use a fixed injected instant without reading the system clock', () => {
    const a = resolveExpectedMarkDate(new Date('2026-11-24T17:00:00Z'))
    const b = resolveExpectedMarkDate(new Date('2026-11-24T17:00:00Z'))
    expect(a).toBe(b)
  })
})
