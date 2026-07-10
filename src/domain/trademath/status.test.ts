import { describe, it, expect } from 'vitest'
import { statusOf } from './status'
import type { ExecutionFacts, LegFacts, TradeRecord } from './types'

const AAPL: LegFacts['instrument'] = { kind: 'stock', ticker: 'AAPL' }

function exec(side: 'buy' | 'sell', qty: number): ExecutionFacts {
  return { side, qty, price: 15000, fees: 100, timestamp: 0 }
}

function trade(legs: LegFacts[], closeReason?: TradeRecord['closeReason']): TradeRecord {
  return {
    id: 't1',
    accountId: 'a1',
    plan: {
      thesis: 'up',
      strategyId: 's1',
      ideaSourceId: 'i1',
      plannedLegs: [{ side: 'buy', instrument: AAPL, qty: 100 }],
      exitLevels: [],
      plannedAt: '2026-07-10',
    },
    legs,
    closeReason,
  }
}

describe('TradeMath.statusOf', () => {
  it("returns 'planned' for a Trade with no Executions and no Close Reason", () => {
    expect(statusOf(trade([]))).toBe('planned')
  })

  it("returns 'closed' for a Trade with no Executions but a Close Reason (abandoned plan)", () => {
    expect(statusOf(trade([], { id: 'never-filled', name: 'Never Filled' }))).toBe('closed')
  })

  it("returns 'open' when any Leg has nonzero net quantity", () => {
    expect(statusOf(trade([{ instrument: AAPL, executions: [exec('buy', 100)] }]))).toBe('open')
  })

  it("returns 'closed' when Executions exist and every Leg nets to zero", () => {
    expect(
      statusOf(trade([{ instrument: AAPL, executions: [exec('buy', 100), exec('sell', 100)] }])),
    ).toBe('closed')
  })
})
