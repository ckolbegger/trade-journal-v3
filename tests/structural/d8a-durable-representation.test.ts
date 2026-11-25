import { describe, expect, it } from 'vitest'
import { advisoryImpliedVolatility } from '../../src/domain/advisory-iv'
import { expirationPayoff } from '../../src/domain/expiration-payoff'
import type { OptionContract } from '../../src/domain/option-contract'

const contract: OptionContract = {
  underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100,
}

describe('D8a durable representation (S2 structural)', () => {
  it('should derive advisory values per request without persisting them on canonical rows', () => {
    const advisory = advisoryImpliedVolatility({
      kind: 'Call', mark: '3.00', underlying: '180.00', strike: '190', days: 23,
    }, true)
    expect(advisory?.kind).toBe('Value')
    const payoff = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 1 }],
    })
    expect(payoff.kind).toBe('Value')
    if (payoff.kind !== 'Value') return
    expect(JSON.stringify(payoff.value)).not.toContain('vol')
    expect(JSON.stringify(payoff.value)).not.toContain('theoretical')
    expect(Object.keys(payoff.value)).not.toContain('advisory')
  })

  it('should add no authoritative fact fields to a Trade or Journal row', () => {
    const advisory = advisoryImpliedVolatility({
      kind: 'Call', mark: '3.00', underlying: '180.00', strike: '190', days: 23,
    }, true)
    expect(advisory?.kind === 'Value' ? Object.keys(advisory) : []).toEqual(['kind', 'vol', 'inputs'])
    expect(advisoryImpliedVolatility({
      kind: 'Call', mark: '3.00', underlying: '180.00', strike: '190', days: 23,
    }, false)).toBeNull()
  })
})
