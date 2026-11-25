import { describe, expect, it } from 'vitest'
import * as replayModule from '../../src/domain/replay'
import * as payoffModule from '../../src/domain/expiration-payoff'
import * as ivModule from '../../src/domain/advisory-iv'
import * as decompositionModule from '../../src/domain/advisory-decomposition'

describe('D8a public contract (S4 structural)', () => {
  it('should reuse D5 replay and D8 payoff without new parameters', () => {
    expect(replayModule.replay.length).toBe(1)
    expect(payoffModule.expirationPayoff.length).toBe(1)
    expect(replayModule.replay({ tradeId: 't', stop: '95', frames: [] })).toEqual({
      episodes: [], gaps: [], coveredDates: [],
    })
  })

  it('should expose advisory derivation only, with no valuer, P&L or lifecycle operation', () => {
    for (const forbidden of [
      'value', 'valuate', 'valuation', 'pnl', 'realizedPnl', 'setLifecycle',
      'closeTrade', 'theoreticalPrice', 'predict', 'coach',
    ]) {
      for (const module of [ivModule, decompositionModule]) {
        expect(Object.keys(module).some(k => k.toLowerCase().includes(forbidden))).toBe(false)
      }
    }
    expect(typeof ivModule.advisoryImpliedVolatility).toBe('function')
    expect(typeof decompositionModule.advisoryShareEquivalent).toBe('function')
    expect(typeof decompositionModule.priceMoveDecomposition).toBe('function')
  })
})
