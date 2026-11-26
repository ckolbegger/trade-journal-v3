import { describe, expect, it } from 'vitest'
import {
  buildCompleteTradeDetail, payoffForPlan, type CompleteDetailInput,
} from '../../src/domain/complete-detail'
import { expirationPayoff } from '../../src/domain/expiration-payoff'
import type { SessionSeries } from '../../src/domain/session-series'
import type { OptionContract } from '../../src/domain/option-contract'

const series: SessionSeries = {
  expectedDate: '2026-11-24',
  sessions: [{ date: '2026-11-24', status: 'Available', price: '100', gap: false, keyMoments: [] }],
  gaps: [], episodes: [], snapshotId: 'frames-aapl', digest: 'digest', sessionPolicy: 'v1',
}

const contract: OptionContract = {
  underlying: 'AAPL', kind: 'Call', strike: '190', expiration: '2026-12-18', multiplier: 100,
}
const plannedLeg = { contract, quantity: 2, openingAction: 'Buy' as const }
const leg = { contract, openingAction: 'Buy' as const, entry: '3.00', quantity: 2 }

const input = (): CompleteDetailInput => ({
  trade: {
    id: 'trade-call', lifecycle: 'Open', revision: '2', strategyId: 'seed-long-call',
    underlying: 'AAPL', oneR: '2.00',
    plan: { entry: '3.00', stop: '1.00', target: '7.00' },
    positions: [], lots: [], executions: [], realizedToDate: '0.00',
  },
  series, journalRows: [],
  coverage: { instrument: 'AAPL', date: '2026-11-24', status: 'Available' },
})

describe('complete detail payoff', () => {
  it('should derive the option payoff from the frozen Planned Leg through the existing payoff operation', () => {
    const base = input()
    const detail = buildCompleteTradeDetail({
      ...base,
      trade: { ...base.trade, plannedLeg },
    })
    expect(detail.payoff).toEqual(expirationPayoff({ view: 'Planned', legs: [leg] }))
    expect(detail.payoff.kind).toBe('Value')
  })

  it('should keep stock-only without an option anchor NotApplicable and multiple expirations Unavailable', () => {
    expect(payoffForPlan({ entry: '3.00' })).toEqual({ kind: 'NotApplicable', reason: 'StockOnly' })
    const other: OptionContract = { ...contract, expiration: '2027-03-19' }
    expect(payoffForPlan({
      entry: '3.00',
      legs: [leg, { ...leg, contract: other }],
    })).toEqual({ kind: 'Unavailable', reason: 'MultipleExpirations' })
  })

  it('should leave Planned and Current views independent and accept no theoretical price or advisory value', () => {
    const planned = payoffForPlan({ entry: '3.00', plannedLeg })
    const current = payoffForPlan({ entry: '3.00', plannedLeg }, 'Current', '1.00')
    expect(planned).toEqual(expirationPayoff({ view: 'Planned', legs: [leg] }))
    expect(current).toEqual(expirationPayoff({
      view: 'Current', legs: [leg], realizedToDate: '1.00', unconsumedOpeningFees: '0.00',
    }))
    expect(JSON.stringify(planned)).not.toContain('impliedVolatility')
    expect(JSON.stringify(planned)).not.toContain('theoretical')
  })

  it('should byte-match the existing expirationPayoff result for identical inputs', () => {
    for (const view of ['Planned', 'Current'] as const) {
      const actual = payoffForPlan({ entry: '3.00', plannedLeg }, view, '0.00')
      const expected = expirationPayoff({
        view, legs: [leg], ...(view === 'Current' ? { realizedToDate: '0.00', unconsumedOpeningFees: '0.00' } : {}),
      })
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected))
    }
  })
})
