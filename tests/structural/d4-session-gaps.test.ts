import { describe, expect, it } from 'vitest'
import { resolveExpectedMarkDate, completedSessionsBetween } from '../../src/domain/calendar'

describe('D4 session policy and explicit gaps (S3 structural)', () => {
  it('should resolve a Monday Mark at noon Tuesday and skip weekends', () => {
    expect(resolveExpectedMarkDate(new Date('2026-11-24T17:00:00Z'))).toBe('2026-11-23')
    expect(resolveExpectedMarkDate(new Date('2026-11-23T21:00:00Z'))).toBe('2026-11-23')
  })

  it('should enumerate completed sessions with explicit weekend gaps', () => {
    expect(completedSessionsBetween('2026-11-23', '2026-11-27')).toEqual([
      '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27',
    ])
    expect(completedSessionsBetween('2026-11-27', '2026-11-30')).toEqual([
      '2026-11-27', '2026-11-30',
    ])
  })

  it('should bind a stable session-policy revision', async () => {
    const { SESSION_POLICY_REVISION } = await import('../../src/domain/market-frames')
    expect(SESSION_POLICY_REVISION).toBe('v1')
  })
})
