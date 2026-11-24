import { describe, expect, it } from 'vitest'
import { unavailable, value } from '../../src/domain/calculation'

describe('D4 Calculation Result vocabulary (S4 structural)', () => {
  it('should expose a closed union with stable reasons and structured details', () => {
    expect(value('12.00')).toEqual({ kind: 'Value', value: '12.00' })
    expect(unavailable('ExpectedMarkMissing', 'AAPL', '2026-11-23')).toEqual({
      kind: 'Unavailable', reason: 'ExpectedMarkMissing',
      details: { instrument: 'AAPL', date: '2026-11-23' },
    })
  })

  it('should never use zero or fill cost as a missing-value substitute', () => {
    const result = unavailable('ExpectedMarkMissing', 'AAPL', '2026-11-23')
    expect(result.kind).toBe('Unavailable')
    expect('value' in result).toBe(false)
  })
})
