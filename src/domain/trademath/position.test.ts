import { describe, it, expect } from 'vitest'
import { positionOf } from './position'
import type { ExecutionFacts, LegFacts, TradeRecord } from './types'

// Local noon avoids DST edge cases; positionOf compares Execution timestamps
// against the asOf trading date.
function at(iso: string): number {
  return new Date(`${iso}T12:00:00`).getTime()
}

function exec(overrides: Partial<ExecutionFacts>): ExecutionFacts {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: at('2026-07-10'),
    ...overrides,
  }
}

function tradeWith(legs: LegFacts[]): TradeRecord {
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
    legs,
  }
}

const AAPL = { kind: 'stock', ticker: 'AAPL' } as const

describe('TradeMath.positionOf', () => {
  it('returns empty holdings for a planned Trade', () => {
    const position = positionOf(tradeWith([]))
    expect(position.holdings).toEqual([])
  })

  it('returns +100 AAPL after buying 100', () => {
    const trade = tradeWith([
      { id: 'leg-1', instrument: AAPL, executions: [exec({ side: 'buy', qty: 100 })] },
    ])
    const position = positionOf(trade)
    expect(position.holdings).toEqual([{ instrument: AAPL, qty: 100, side: 'long' }])
  })

  it('returns zero holdings after buying 100 and selling 100', () => {
    const trade = tradeWith([
      {
        id: 'leg-1',
        instrument: AAPL,
        executions: [exec({ side: 'buy', qty: 100 }), exec({ side: 'sell', qty: 100 })],
      },
    ])
    expect(positionOf(trade).holdings).toEqual([])
  })

  it('reports per-Leg quantity and side', () => {
    const trade = tradeWith([
      { id: 'leg-1', instrument: AAPL, executions: [exec({ side: 'buy', qty: 100 })] },
    ])
    const [holding] = positionOf(trade).holdings
    expect(holding.qty).toBe(100)
    expect(holding.side).toBe('long')
    expect(holding.instrument).toEqual(AAPL)
  })

  it('honors asOf: executions after the date are excluded', () => {
    const trade = tradeWith([
      {
        id: 'leg-1',
        instrument: AAPL,
        executions: [
          exec({ side: 'buy', qty: 100, timestamp: at('2026-07-10') }),
          exec({ side: 'buy', qty: 50, timestamp: at('2026-07-12') }),
        ],
      },
    ])
    expect(positionOf(trade, '2026-07-10').holdings).toEqual([
      { instrument: AAPL, qty: 100, side: 'long' },
    ])
  })
})
