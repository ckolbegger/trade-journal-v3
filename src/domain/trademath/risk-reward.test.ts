import { describe, it, expect } from 'vitest'
import type { ExecutionFacts, ExitLevel, Mark, MarkSet, TradeRecord } from './types'
import { riskReward } from './risk-reward'

// Worked example (docs/plan/slice-01-stock-lifecycle.md), money in cents:
// buy 100 AAPL @ 150.00, stop 140.00, target 170.00, mark today 160.00.

const stop: ExitLevel = {
  scope: { level: 'trade' },
  side: 'stop',
  kind: 'underlyingPrice',
  price: 14000,
}
const target: ExitLevel = {
  scope: { level: 'trade' },
  side: 'target',
  kind: 'underlyingPrice',
  price: 17000,
}

function tradeWith(executions: ExecutionFacts[], exitLevels: ExitLevel[]): TradeRecord {
  return {
    id: 'trade-1',
    accountId: 'account-1',
    plan: {
      thesis: 'AAPL breaks out',
      strategyId: 'strategy-long-stock',
      ideaSourceId: 'idea-1',
      plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
      exitLevels,
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

const mark = (price: number): Mark => ({
  instrument: 'AAPL',
  date: '2026-07-15',
  price,
  origin: 'manual',
})
function marks(price: number): MarkSet {
  return new Map([['AAPL', mark(price)]])
}

describe('TradeMath.riskReward', () => {
  it('computes the worked example at 160: plannedRisk 2000.00, worstCaseRisk 16000.00, plannedReward 1000.00, maxReward unlimited', () => {
    const rr = riskReward(tradeWith([buy100()], [stop, target]), marks(16000))
    expect(rr.plannedRisk).toBe(200000)
    expect(rr.worstCaseRisk).toBe(1600000)
    expect(rr.plannedReward).toBe(100000)
    expect(rr.maxReward).toBe('unlimited')
  })

  it('reports original risk 1000.00 and reward 2000.00 from entry basis 150', () => {
    const rr = riskReward(tradeWith([buy100()], [stop, target]), marks(16000))
    expect(rr.original.risk).toBe(100000)
    expect(rr.original.reward).toBe(200000)
  })

  it('counts giveback: after a rise to 165 plannedRisk grows to 2500.00', () => {
    const rr = riskReward(tradeWith([buy100()], [stop, target]), marks(16500))
    expect(rr.plannedRisk).toBe(250000)
  })

  it('returns plannedRisk undefined when the Plan has no stop', () => {
    const rr = riskReward(tradeWith([buy100()], [target]), marks(16000))
    expect(rr.plannedRisk).toBe('undefined')
  })

  it('returns plannedReward undefined when the Plan has no target', () => {
    const rr = riskReward(tradeWith([buy100()], [stop]), marks(16000))
    expect(rr.plannedReward).toBe('undefined')
  })

  it('returns original risk/reward undefined before any Execution', () => {
    const rr = riskReward(tradeWith([], [stop, target]), new Map())
    expect(rr.original.risk).toBe('undefined')
    expect(rr.original.reward).toBe('undefined')
  })
})
