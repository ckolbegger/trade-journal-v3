import { describe, it, expect } from 'vitest'
import type { ExecutionFacts, Mark, MarkSet, TradeRecord } from './types'
import { instrumentsOf, valuation, MissingMarkError } from './valuation'

// The worked example (docs/plan/slice-01-stock-lifecycle.md), all money in cents:
// Plan Long Stock buy 100 AAPL, stop 140.00, target 170.00.
// Fill buy 100 @ 150.00 fees 1.00. Mark today 160.00.

function tradeWith(executions: ExecutionFacts[]): TradeRecord {
  return {
    id: 'trade-1',
    accountId: 'account-1',
    plan: {
      thesis: 'AAPL breaks out',
      strategyId: 'strategy-long-stock',
      ideaSourceId: 'idea-1',
      plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
      exitLevels: [
        { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 14000 },
        { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 17000 },
      ],
      plannedAt: '2026-07-10',
    },
    legs:
      executions.length === 0
        ? []
        : [{ id: 'leg-1', instrument: { kind: 'stock', ticker: 'AAPL' }, executions }],
  }
}

const buy100 = (): ExecutionFacts => ({
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
})

const sell100 = (): ExecutionFacts => ({
  side: 'sell',
  qty: 100,
  price: 16800,
  fees: 100,
  timestamp: new Date('2026-07-20T12:00:00').getTime(),
})

function markSet(marks: Mark[]): MarkSet {
  return new Map(marks.map((m) => [m.instrument, m]))
}

const mark = (price: number): Mark => ({
  instrument: 'AAPL',
  date: '2026-07-15',
  price,
  origin: 'manual',
})

describe('TradeMath.instrumentsOf', () => {
  it('returns the stock instrument for a one-leg stock Trade', () => {
    expect(instrumentsOf(tradeWith([buy100()]))).toEqual(['AAPL'])
  })
})

describe('TradeMath.instrumentsOf (options)', () => {
  it('returns the contract and its underlying for an option Leg', () => {
    const AAPL_CALL = {
      kind: 'option',
      ticker: 'AAPL',
      expiration: '2027-06-18',
      type: 'call',
      strike: 20000,
    } as const
    const trade: TradeRecord = {
      id: 'trade-1',
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
              price: 1200,
              fees: 65,
              timestamp: new Date('2026-07-10T12:00:00').getTime(),
            },
          ],
        },
      ],
    }
    expect(instrumentsOf(trade)).toEqual(['AAPL 2027-06-18 C 200', 'AAPL'])
  })
})

describe('TradeMath.valuation', () => {
  it('values the worked example at mark 160: currentValue 16000.00, unrealized 1000.00, fees 1.00, total 999.00', () => {
    const v = valuation(tradeWith([buy100()]), markSet([mark(16000)]))
    expect(v.currentValue).toBe(1600000)
    expect(v.unrealizedPnL).toBe(100000)
    expect(v.fees).toBe(100)
    expect(v.totalPnL).toBe(99900)
  })

  it('computes realized 1798.00 after the closing sell at 168 (net of both executions fees)', () => {
    const v = valuation(tradeWith([buy100(), sell100()]), markSet([mark(16800)]))
    expect(v.realizedPnL).toBe(179800)
  })

  it('reports per-Leg basis, realized, and unrealized', () => {
    const v = valuation(tradeWith([buy100()]), markSet([mark(16000)]))
    expect(v.perLeg).toEqual([
      {
        instrument: { kind: 'stock', ticker: 'AAPL' },
        basis: 1500000,
        avgCost: 15000,
        realized: -100,
        unrealized: 100000,
      },
    ])
  })

  it('returns zero unrealized when the Mark equals basis price', () => {
    const v = valuation(tradeWith([buy100()]), markSet([mark(15000)]))
    expect(v.unrealizedPnL).toBe(0)
  })

  it('throws a typed error when a held instrument Mark is absent from the MarkSet', () => {
    expect(() => valuation(tradeWith([buy100()]), markSet([]))).toThrow(MissingMarkError)
  })
})

// The long-call worked example (docs/plan/slice-03-single-leg-options.md):
// Plan Long Call, buy 1 AAPL 2027-06-18 C 200 @ limit; Fill buy 1 @ 12.00, fees
// $0.65. Marks: contract 14.00, underlying 205.
describe('TradeMath.valuation (options)', () => {
  const AAPL_CALL = {
    kind: 'option',
    ticker: 'AAPL',
    expiration: '2027-06-18',
    type: 'call',
    strike: 20000,
  } as const

  function longCallTrade(): TradeRecord {
    return {
      id: 'trade-1',
      accountId: 'account-1',
      plan: {
        thesis: 'AAPL breaks out',
        strategyId: 'strategy-long-call',
        ideaSourceId: '',
        plannedLegs: [{ side: 'buy', instrument: AAPL_CALL, qty: 1 }],
        exitLevels: [
          { scope: { level: 'trade' }, side: 'stop', kind: 'structureValue', value: 600 },
          { scope: { level: 'trade' }, side: 'target', kind: 'structureValue', value: 2400 },
        ],
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
              price: 1200,
              fees: 65,
              timestamp: new Date('2026-07-10T12:00:00').getTime(),
            },
          ],
        },
      ],
    }
  }

  function longCallMarks(): MarkSet {
    return markSet([
      { instrument: 'AAPL 2027-06-18 C 200', date: '2026-07-15', price: 1400, origin: 'manual' },
      { instrument: 'AAPL', date: '2026-07-15', price: 20500, origin: 'manual' },
    ])
  }

  it('values the long-call worked example: currentValue 1400.00, unrealized 200.00, total 199.35', () => {
    const v = valuation(longCallTrade(), longCallMarks())
    expect(v.currentValue).toBe(140000)
    expect(v.unrealizedPnL).toBe(20000)
    expect(v.fees).toBe(65)
    expect(v.totalPnL).toBe(19935)
  })
})

// The cash-secured put worked example (docs/plan/slice-03-single-leg-options.md):
// Plan Cash-Secured Put, sell 1 XYZ 2026-08-21 P 100. Fill sell 1 @ 2.50, fees
// $0.65. Mark contract 1.25.
describe('TradeMath.valuation (short)', () => {
  const XYZ_PUT = {
    kind: 'option',
    ticker: 'XYZ',
    expiration: '2026-08-21',
    type: 'put',
    strike: 10000,
  } as const

  function cspTrade(executions: ExecutionFacts[]): TradeRecord {
    return {
      id: 'trade-1',
      accountId: 'account-1',
      plan: {
        thesis: 'XYZ range-bound',
        strategyId: 'strategy-cash-secured-put',
        ideaSourceId: '',
        plannedLegs: [{ side: 'sell', instrument: XYZ_PUT, qty: 1 }],
        exitLevels: [
          { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 9500 },
          { scope: { level: 'trade' }, side: 'target', kind: 'structureValue', value: 50 },
        ],
        plannedAt: '2026-07-10',
      },
      legs: executions.length === 0 ? [] : [{ id: 'leg-1', instrument: XYZ_PUT, executions }],
    }
  }

  const sellToOpen = (): ExecutionFacts => ({
    side: 'sell',
    qty: 1,
    price: 250,
    fees: 65,
    timestamp: new Date('2026-07-10T12:00:00').getTime(),
  })

  it('values the CSP worked example: currentValue -125.00, unrealized 125.00, total 124.35', () => {
    const marks = markSet([
      { instrument: 'XYZ 2026-08-21 P 100', date: '2026-07-15', price: 125, origin: 'manual' },
    ])
    const v = valuation(cspTrade([sellToOpen()]), marks)
    expect(v.currentValue).toBe(-12500)
    expect(v.unrealizedPnL).toBe(12500)
    expect(v.fees).toBe(65)
    expect(v.totalPnL).toBe(12435)
  })

  it('realizes credit minus buyback on a buy-to-close at 0.60: realized 188.70 (250 - 60 - 1.30 fees)', () => {
    const buyToClose: ExecutionFacts = {
      side: 'buy',
      qty: 1,
      price: 60,
      fees: 65,
      timestamp: new Date('2026-07-20T12:00:00').getTime(),
    }
    const v = valuation(cspTrade([sellToOpen(), buyToClose]), new Map())
    expect(v.realizedPnL).toBe(18870)
  })
})
