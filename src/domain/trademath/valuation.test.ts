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
