import { describe, expect, it } from 'vitest'
import { canonicalInstrument, type OptionContract } from '../../src/domain/option-contract'
import { expirationPayoff } from '../../src/domain/expiration-payoff'
import type { OptionPosition } from '../../src/domain/option-position'

const contract: OptionContract = {
  underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100,
}

describe('D8 durable representation (S2 structural)', () => {
  it('should freeze the exact contract and store matches as links without price or P&L', () => {
    expect(canonicalInstrument(contract)).toBe('AAPL 190Call 2026-12-18 x100')
    const match: OptionPosition['lotMatches'][number] = {
      id: 'match-e2-lot-e1', executionId: 'e2', lotId: 'lot-e1',
      matchingMethod: 'FIFO', quantity: '2',
    }
    expect(Object.keys(match)).not.toContain('price')
    expect(Object.keys(match)).not.toContain('realizedPnl')
    expect(match.matchingMethod).toBe('FIFO')
  })

  it('should derive payoff views and never store a theoretical price', () => {
    const result = expirationPayoff({
      view: 'Planned', legs: [{ contract, openingAction: 'Buy', entry: '3.00', quantity: 2 }],
    })
    expect(result.kind).toBe('Value')
    if (result.kind !== 'Value') return
    expect(typeof result.value.segments[0].intercept).toBe('string')
    expect(JSON.stringify(result.value)).not.toContain('theoretical')
  })
})
