import { describe, it, expect } from 'vitest'
import type { ExecutionFacts, ExitLevel, Mark, MarkSet, TradeRecord } from './types'
import { valuation } from './valuation'
import { riskReward } from './risk-reward'

// The PMCC worked example (docs/plan/slice-07-multi-leg.md, S7.3), all money in
// cents: buy 1 AAPL 2028-01-21 C 150 @ 62.00 fees $0.65, sell 1 AAPL
// 2026-09-18 C 220 @ 3.00 fees $0.65 (fees $1.30 total). Marks: LEAP 65.00,
// short call 2.00, underlying 210.

const FAR_CALL = {
  kind: 'option',
  ticker: 'AAPL',
  expiration: '2028-01-21',
  type: 'call',
  strike: 15000, // 150
} as const

const NEAR_CALL = {
  kind: 'option',
  ticker: 'AAPL',
  expiration: '2026-09-18',
  type: 'call',
  strike: 22000, // 220
} as const

const buyLeap = (): ExecutionFacts => ({
  side: 'buy',
  qty: 1,
  price: 6200, // 62.00
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
})

const sellShortCall = (): ExecutionFacts => ({
  side: 'sell',
  qty: 1,
  price: 300, // 3.00
  fees: 65,
  timestamp: new Date('2026-07-11T12:00:00').getTime(),
})

function pmccTrade(
  exitLevels: ExitLevel[] = [],
  legs: TradeRecord['legs'] = [
    { id: 'leg-far', instrument: FAR_CALL, executions: [buyLeap()] },
    { id: 'leg-near', instrument: NEAR_CALL, executions: [sellShortCall()] },
  ],
): TradeRecord {
  return {
    id: 'trade-1',
    accountId: 'account-1',
    plan: {
      thesis: 'PMCC on AAPL',
      strategyId: 'strategy-pmcc',
      ideaSourceId: '',
      plannedLegs: [
        { side: 'buy', instrument: { kind: 'option', ticker: 'AAPL', type: 'call' }, qty: 1 },
        { side: 'sell', instrument: { kind: 'option', ticker: 'AAPL', type: 'call' }, qty: 1 },
      ],
      exitLevels,
      plannedAt: '2026-07-10',
    },
    legs,
  }
}

function mark(instrument: string, price: number): Mark {
  return { instrument, date: '2026-07-15', price, origin: 'manual' }
}

function pmccMarks(): MarkSet {
  return new Map([
    ['AAPL 2028-01-21 C 150', mark('AAPL 2028-01-21 C 150', 6500)],
    ['AAPL 2026-09-18 C 220', mark('AAPL 2026-09-18 C 220', 200)],
    ['AAPL', mark('AAPL', 21000)],
  ])
}

describe('TradeMath.riskReward (PMCC)', () => {
  it('values the worked example: worstCaseRisk 6300.00, maxReward 700.00', () => {
    const rr = riskReward(pmccTrade(), pmccMarks())
    expect(rr.worstCaseRisk).toBe(630000)
    expect(rr.maxReward).toBe(70000)
  })

  it('computes structureValue stop/target anchors over the combined structure', () => {
    const stop: ExitLevel = {
      scope: { level: 'trade' },
      side: 'stop',
      kind: 'structureValue',
      value: 550000, // 5,500.00
    }
    const target: ExitLevel = {
      scope: { level: 'trade' },
      side: 'target',
      kind: 'structureValue',
      value: 680000, // 6,800.00
    }
    const rr = riskReward(pmccTrade([stop, target]), pmccMarks())
    // currentValue 6,300.00: plannedRisk 800.00 (→5,500), plannedReward
    // 500.00 (→6,800) — the level names the WHOLE structure's value, not one
    // Leg's own Mark scale (generalized from the single-leg case).
    expect(rr.plannedRisk).toBe(80000)
    expect(rr.plannedReward).toBe(50000)
  })

  it('handles the short leg expiring first (extremes over the remaining leg after the expire Execution)', () => {
    const expiredNear = {
      id: 'leg-near',
      instrument: NEAR_CALL,
      executions: [
        sellShortCall(),
        {
          side: 'buy' as const,
          qty: 1,
          price: 0,
          fees: 0,
          kind: 'expire' as const,
          timestamp: new Date('2026-09-19T16:00:00').getTime(),
        },
      ],
    }
    const legs: TradeRecord['legs'] = [
      { id: 'leg-far', instrument: FAR_CALL, executions: [buyLeap()] },
      expiredNear,
    ]
    const marks: MarkSet = new Map([
      ['AAPL 2028-01-21 C 150', mark('AAPL 2028-01-21 C 150', 6500)],
      ['AAPL', mark('AAPL', 21000)],
    ])
    const rr = riskReward(pmccTrade([], legs), marks)
    // Only the LEAP remains held — unbounded upside again (no short leg left
    // to cap it), worstCaseRisk down to the LEAP's own currentValue (S→0
    // intrinsic is 0).
    expect(rr.maxReward).toBe('unlimited')
    expect(rr.worstCaseRisk).toBe(650000)
  })
})

describe('TradeMath.valuation (PMCC)', () => {
  it('values the worked example: currentValue 6300.00, total 398.70', () => {
    const v = valuation(pmccTrade(), pmccMarks())
    expect(v.currentValue).toBe(630000)
    expect(v.unrealizedPnL).toBe(40000)
    expect(v.fees).toBe(130)
    expect(v.totalPnL).toBe(39870)
  })
})
