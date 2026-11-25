import { describe, expect, it } from 'vitest'
import { expirationPayoff, type PayoffLeg } from '../../src/domain/expiration-payoff'
import type { OptionContract } from '../../src/domain/option-contract'

const call: OptionContract = {
  underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100,
}
const put: OptionContract = { ...call, kind: 'Put' }

const leg = (contract: OptionContract, openingAction: 'Buy' | 'Sell', entry: string, quantity = 2): PayoffLeg => ({
  contract, openingAction, entry, quantity,
})

describe('expiration payoff', () => {
  it('should derive the Planned payoff for a long Call from intrinsic settlement only', () => {
    const result = expirationPayoff({ view: 'Planned', legs: [leg(call, 'Buy', '3.00')] })
    expect(result.kind).toBe('Value')
    if (result.kind !== 'Value') return
    expect(result.value.segments).toEqual([
      { from: '0', to: '190', slope: '0', intercept: '-600.00' },
      { from: '190', to: 'Infinity', slope: '200', intercept: '-38600.00' },
    ])
    expect(result.value.zeroCrossings).toEqual(['193'])
    expect(result.value.breakEven).toEqual(['193'])
  })

  it('should derive the Planned payoff for a long Put and a short Put', () => {
    const longPut = expirationPayoff({ view: 'Planned', legs: [leg(put, 'Buy', '2.00', 1)] })
    expect(longPut.kind).toBe('Value')
    if (longPut.kind !== 'Value') return
    expect(longPut.value.zeroCrossings).toEqual(['188'])

    const shortPut = expirationPayoff({ view: 'Planned', legs: [leg(put, 'Sell', '2.00', 1)] })
    expect(shortPut.kind).toBe('Value')
    if (shortPut.kind !== 'Value') return
    expect(shortPut.value.zeroCrossings).toEqual(['188'])
    expect(shortPut.value.segments[0]).toMatchObject({ from: '0', to: '190', slope: '100' })
  })

  it('should derive Current payoff as realized-to-date offset plus remaining exposure with no closing fee', () => {
    const planned = expirationPayoff({ view: 'Planned', legs: [leg(call, 'Buy', '3.00')] })
    const current = expirationPayoff({
      view: 'Current', legs: [leg(call, 'Buy', '3.00')],
      realizedToDate: '100.00', unconsumedOpeningFees: '0.00',
    })
    expect(planned.kind).toBe('Value')
    expect(current.kind).toBe('Value')
    if (planned.kind !== 'Value' || current.kind !== 'Value') return
    expect(current.value.segments[0].intercept).toBe('-500.00')
    expect(current.value.zeroCrossings).toEqual(['192.5'])
    expect(JSON.stringify(current.value)).not.toContain('closingFee')
  })

  it('should return all zero crossings, signed extrema and attainment sets', () => {
    const result = expirationPayoff({ view: 'Planned', legs: [leg(call, 'Buy', '3.00')] })
    expect(result.kind).toBe('Value')
    if (result.kind !== 'Value') return
    expect(result.value.zeroCrossings).toEqual(['193'])
    expect(result.value.extrema).toEqual([
      { kind: 'Minimum', value: '-600.00', attainedOn: '0..190' },
      { kind: 'Maximum', value: 'Unbounded', attainedOn: '193..Infinity' },
    ])
    expect(result.value.attainment).toContain('0..190')
  })

  it('should bound Put extrema at their correct attainment ranges', () => {
    const longPut = expirationPayoff({ view: 'Planned', legs: [leg(put, 'Buy', '3.00', 2)] })
    expect(longPut.kind).toBe('Value')
    if (longPut.kind !== 'Value') return
    expect(longPut.value.zeroCrossings).toEqual(['187'])
    expect(longPut.value.extrema).toEqual([
      { kind: 'Minimum', value: '-600.00', attainedOn: '190..Infinity' },
      { kind: 'Maximum', value: '37400.00', attainedOn: '0..0' },
    ])

    const shortPut = expirationPayoff({ view: 'Planned', legs: [leg(put, 'Sell', '3.00', 2)] })
    expect(shortPut.kind).toBe('Value')
    if (shortPut.kind !== 'Value') return
    expect(shortPut.value.zeroCrossings).toEqual(['187'])
    expect(shortPut.value.extrema).toEqual([
      { kind: 'Minimum', value: '-37400.00', attainedOn: '0..0' },
      { kind: 'Maximum', value: '600.00', attainedOn: '190..Infinity' },
    ])
  })

  it('should return NotApplicable for flat exposure or a stock-only Trade and Unavailable for multiple expirations', () => {
    expect(expirationPayoff({ view: 'Current', legs: [] })).toMatchObject({
      kind: 'NotApplicable', reason: 'FlatExposure',
    })
    expect(expirationPayoff({ view: 'Planned', legs: [], stockOnly: true })).toMatchObject({
      kind: 'NotApplicable', reason: 'StockOnly',
    })
    expect(expirationPayoff({
      view: 'Planned', legs: [leg(call, 'Buy', '3.00'), leg({ ...call, expiration: '2027-01-15' }, 'Buy', '1.00')],
    })).toMatchObject({ kind: 'Unavailable', reason: 'MultipleExpirations' })
  })

  it('should accept no theoretical price, Mark or advisory IV as an input', () => {
    const clean = expirationPayoff({ view: 'Planned', legs: [leg(call, 'Buy', '3.00')] })
    const withExtras = expirationPayoff({
      view: 'Planned', legs: [leg(call, 'Buy', '3.00')],
      mark: '4.00', impliedVolatility: 0.4,
    } as Parameters<typeof expirationPayoff>[0])
    expect(withExtras).toEqual(clean)
  })
})
