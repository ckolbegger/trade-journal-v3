import { describe, it, expect } from 'vitest'
import type { ExecutionFacts, Mark, MarkSet, TradeRecord } from './types'
import { positionOf } from './position'
import { valuation } from './valuation'

// The Slice 5 worked example (docs/plan/slice-05-scaling.md), all money in
// cents: buy 100 AAPL @ 150.00 fees 1.00 (Lot A) · buy 100 @ 160.00 fees 1.00
// (Lot B) -> position 200, basis 31000.00, average cost 155.00, fees 2.00.

function tradeWith(executions: ExecutionFacts[]): TradeRecord {
  return {
    id: 'trade-1',
    accountId: 'account-1',
    plan: {
      thesis: 'AAPL breaks out',
      strategyId: 'strategy-long-stock',
      ideaSourceId: '',
      plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
      exitLevels: [],
      plannedAt: '2026-07-10',
    },
    legs: [{ id: 'leg-1', instrument: { kind: 'stock', ticker: 'AAPL' }, executions }],
  }
}

const buyLotA = (): ExecutionFacts => ({
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
})

const buyLotB = (): ExecutionFacts => ({
  side: 'buy',
  qty: 100,
  price: 16000,
  fees: 100,
  timestamp: new Date('2026-07-12T12:00:00').getTime(),
})

function markSet(price: number): MarkSet {
  const mark: Mark = { instrument: 'AAPL', date: '2026-07-15', price, origin: 'manual' }
  return new Map([[mark.instrument, mark]])
}

describe('TradeMath.positionOf (multi-lot)', () => {
  it('returns 200 after the two worked-example buys', () => {
    const trade = tradeWith([buyLotA(), buyLotB()])
    expect(positionOf(trade).holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 200, side: 'long' },
    ])
  })
})

describe('TradeMath.valuation (multi-lot, no closes)', () => {
  it('reports basis 31000.00 and average cost 155.00', () => {
    const v = valuation(tradeWith([buyLotA(), buyLotB()]), markSet(16500))
    expect(v.perLeg[0].basis).toBe(3100000) // 31000.00
    expect(v.perLeg[0].avgCost).toBe(15500) // average cost 155.00
  })

  it('reports unrealized 2000.00 at mark 165 (gross of fees)', () => {
    const v = valuation(tradeWith([buyLotA(), buyLotB()]), markSet(16500))
    expect(v.unrealizedPnL).toBe(200000)
  })

  it('reports fees 2.00', () => {
    const v = valuation(tradeWith([buyLotA(), buyLotB()]), markSet(16500))
    expect(v.fees).toBe(200)
  })
})

// avgCost is per-unit (no contract multiplier) — pins the 100× class of bug a
// naive basis/qty UI derivation would introduce for options (basis already
// has the multiplier baked in; avgCost must not).
describe('TradeMath.valuation (avgCost, option multiplier)', () => {
  const AAPL_CALL = {
    kind: 'option',
    ticker: 'AAPL',
    expiration: '2027-06-18',
    type: 'call',
    strike: 20000,
  } as const

  it('reports avgCost 500 (not 50000) for a 1-contract call bought at 5.00', () => {
    const trade: TradeRecord = {
      id: 'trade-2',
      accountId: 'account-1',
      plan: {
        thesis: 'AAPL breaks out',
        strategyId: 'strategy-long-call',
        ideaSourceId: '',
        plannedLegs: [{ side: 'buy', instrument: AAPL_CALL, qty: 1 }],
        exitLevels: [],
        plannedAt: '2026-07-10',
      },
      legs: [
        {
          id: 'leg-1',
          instrument: AAPL_CALL,
          executions: [
            {
              side: 'buy',
              qty: 1,
              price: 500,
              fees: 0,
              timestamp: new Date('2026-07-10T12:00:00').getTime(),
            },
          ],
        },
      ],
    }
    const marks: MarkSet = new Map([
      [
        'AAPL 2027-06-18 C 200',
        { instrument: 'AAPL 2027-06-18 C 200', date: '2026-07-15', price: 500, origin: 'manual' },
      ],
      ['AAPL', { instrument: 'AAPL', date: '2026-07-15', price: 20000, origin: 'manual' }],
    ])
    const v = valuation(trade, marks)
    expect(v.perLeg[0].basis).toBe(50000) // 500.00, the multiplied total
    expect(v.perLeg[0].avgCost).toBe(500) // 5.00 per contract-unit, no multiplier
  })
})
