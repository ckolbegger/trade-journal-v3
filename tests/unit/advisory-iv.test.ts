import { describe, expect, it } from 'vitest'
import { advisoryImpliedVolatility, type AdvisoryIvInput } from '../../src/domain/advisory-iv'
import { expirationPayoff } from '../../src/domain/expiration-payoff'
import type { OptionContract } from '../../src/domain/option-contract'

const input = (overrides: Partial<AdvisoryIvInput> = {}): AdvisoryIvInput => ({
  kind: 'Call', mark: '3.00', underlying: '100.00', strike: '100', days: 30, ...overrides,
})

describe('advisory implied volatility', () => {
  it('should invert an observed option Mark to a stable volatility with its exact inputs', () => {
    const first = advisoryImpliedVolatility(input(), true)
    const second = advisoryImpliedVolatility(input(), true)
    expect(first).toEqual(second)
    expect(first?.kind).toBe('Value')
    if (first?.kind !== 'Value') return
    expect(first.vol).toBeGreaterThan(0.05)
    expect(first.vol).toBeLessThan(1)
    expect(first.inputs).toEqual({
      kind: 'Call', mark: '3.00', underlying: '100.00', strike: '100', days: 30, rate: 0.04,
    })
  })

  it('should return stable Unavailable reasons for a missing Mark, expiration-day Mark, no fit and negligible sensitivity', () => {
    expect(advisoryImpliedVolatility(input({ mark: undefined }), true)).toMatchObject({
      kind: 'Unavailable', reason: 'a Mark is missing',
    })
    expect(advisoryImpliedVolatility(input({ days: 0 }), true)).toMatchObject({
      kind: 'Unavailable', reason: 'on the expiration session the price no longer depends on volatility',
    })
    expect(advisoryImpliedVolatility(input({ mark: '0.01' }), true)).toMatchObject({
      kind: 'Unavailable', reason: 'the Mark is at or below the option’s exercise value, so no volatility fits',
    })
    expect(advisoryImpliedVolatility(input({ mark: '1000.00' }), true)).toMatchObject({
      kind: 'Unavailable', reason: 'no volatility fits this Mark',
    })
    expect(advisoryImpliedVolatility(input({
      underlying: '100.00', strike: '105', days: 1, mark: '0.01',
    }), true)).toMatchObject({
      kind: 'Unavailable', reason: 'this far from the strike, or this close to expiration, the price barely depends on volatility',
    })
  })

  it('should be removed when the advisory capability is absent without changing any canonical result', () => {
    expect(advisoryImpliedVolatility(input(), false)).toBeNull()
    const contract: OptionContract = {
      underlying: 'AAPL', kind: 'Call', strike: '100', expiration: '2026-12-18', multiplier: 100,
    }
    const canonical = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 1 }],
    })
    const withAdvisory = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 1 }],
      impliedVolatility: 0.42,
    })
    expect(withAdvisory).toEqual(canonical)
  })

  it('should never be an input to payoff, evaluation, P&L, risk, Stop/Target, lifecycle, Deviations, Daily Review or reports', () => {
    const contract: OptionContract = {
      underlying: 'AAPL', kind: 'Call', strike: '100', expiration: '2026-12-18', multiplier: 100,
    }
    const clean = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 1 }],
    })
    const tainted = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 1 }],
      mark: '9.99', impliedVolatility: 0.9,
    } as Parameters<typeof expirationPayoff>[0])
    expect(tainted).toEqual(clean)
    expect(JSON.stringify(tainted)).not.toContain('volatility')
  })
})
