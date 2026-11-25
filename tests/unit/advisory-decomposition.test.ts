import { describe, expect, it } from 'vitest'
import {
  advisoryShareEquivalent, priceMoveDecomposition, type AdvisoryFrame,
} from '../../src/domain/advisory-decomposition'
import { expirationPayoff } from '../../src/domain/expiration-payoff'
import type { OptionContract } from '../../src/domain/option-contract'

const frame = (overrides: Partial<AdvisoryFrame> = {}): AdvisoryFrame => ({
  date: '2026-11-20', kind: 'Call', mark: '3.00', underlying: '100.00',
  strike: '100', days: 30, multiplier: 100, quantity: 2, side: 1, ...overrides,
})

describe('advisory explanation outputs', () => {
  it('should return a share-equivalent sensitivity beside IV that is never a Position or hedge instruction', () => {
    const result = advisoryShareEquivalent({ frame: frame(), installed: true })
    expect(result?.kind).toBe('Value')
    if (result?.kind !== 'Value') return
    expect(result.shares).toBeGreaterThan(0)
    expect(result.shares).toBeLessThanOrEqual(200)
    expect(Object.keys(result)).not.toContain('position')
    expect(Object.keys(result)).not.toContain('action')
    expect(advisoryShareEquivalent({ frame: frame(), installed: false })).toBeNull()
  })

  it('should split an option price change into underlying, time and volatility contributions and label the split an estimate', () => {
    const result = priceMoveDecomposition({
      before: frame({ date: '2026-11-20', mark: '3.00', underlying: '100.00', days: 30 }),
      after: frame({ date: '2026-11-23', mark: '3.80', underlying: '102.00', days: 27 }),
      installed: true,
    })
    expect(result.kind).toBe('Value')
    if (result.kind !== 'Value') return
    expect(result.estimate).toBe(true)
    expect(result.label).toBe('Estimate')
    expect(typeof result.fromUnderlying).toBe('number')
    expect(typeof result.fromTime).toBe('number')
    expect(typeof result.fromVolatility).toBe('number')
    expect(result.total).toBeCloseTo(
      result.fromUnderlying + result.fromTime + result.fromVolatility + result.unexplained, 6,
    )
  })

  it('should return no partial split when either session has no reliable volatility', () => {
    expect(priceMoveDecomposition({
      before: frame({ mark: '0.01' }),
      after: frame({ date: '2026-11-23', mark: '3.80', underlying: '102.00', days: 27 }),
      installed: true,
    })).toMatchObject({ kind: 'Unavailable' })

    expect(priceMoveDecomposition({
      before: frame(),
      after: frame({ date: '2026-11-23', mark: undefined, underlying: '102.00', days: 27 }),
      installed: true,
    })).toMatchObject({ kind: 'Unavailable' })

    expect(priceMoveDecomposition({
      before: frame(), after: frame(), installed: false,
    })).toBeNull()
  })

  it('should leave canonical results byte-equivalent with the advisory capability present or absent', () => {
    const contract: OptionContract = {
      underlying: 'AAPL', kind: 'Call', strike: '100', expiration: '2026-12-18', multiplier: 100,
    }
    const canonical = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 2 }],
    })
    advisoryShareEquivalent({ frame: frame(), installed: true })
    priceMoveDecomposition({
      before: frame(), after: frame({ date: '2026-11-23', underlying: '102.00', days: 27 }),
      installed: true,
    })
    const after = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 2 }],
    })
    expect(after).toEqual(canonical)
    expect(JSON.stringify(after)).not.toContain('volatility')
  })
})
