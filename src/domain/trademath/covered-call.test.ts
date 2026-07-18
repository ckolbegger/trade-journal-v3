import { describe, it, expect } from 'vitest'
import type { ExecutionFacts, ExitLevel, Mark, MarkSet, TradeRecord } from './types'
import { instrumentsOf, valuation } from './valuation'
import { riskReward } from './risk-reward'

// The covered-call worked example (docs/plan/slice-07-multi-leg.md), all money
// in cents: buy 100 XYZ @ 50.00 fees $1.00; sell 1 XYZ 2026-09-18 C 55 @ 1.50
// fees $0.65. Marks: stock 52.00, call 1.00. Exit Levels (trade-scope):
// underlyingPrice stop 46, target 55.

const CALL = {
  kind: 'option',
  ticker: 'XYZ',
  expiration: '2026-09-18',
  type: 'call',
  strike: 5500,
} as const

const stop: ExitLevel = {
  scope: { level: 'trade' },
  side: 'stop',
  kind: 'underlyingPrice',
  price: 4600,
}
const target: ExitLevel = {
  scope: { level: 'trade' },
  side: 'target',
  kind: 'underlyingPrice',
  price: 5500,
}

const buyStock = (): ExecutionFacts => ({
  side: 'buy',
  qty: 100,
  price: 5000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
})

const sellCall = (): ExecutionFacts => ({
  side: 'sell',
  qty: 1,
  price: 150,
  fees: 65,
  timestamp: new Date('2026-07-11T12:00:00').getTime(),
})

function coveredCallTrade(exitLevels: ExitLevel[] = [stop, target]): TradeRecord {
  return {
    id: 'trade-1',
    accountId: 'account-1',
    plan: {
      thesis: 'Sell premium against XYZ stock',
      strategyId: 'strategy-covered-call',
      ideaSourceId: '',
      plannedLegs: [
        { side: 'buy', instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100 },
        { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'call' }, qty: 1 },
      ],
      exitLevels,
      plannedAt: '2026-07-10',
    },
    legs: [
      { id: 'leg-stock', instrument: { kind: 'stock', ticker: 'XYZ' }, executions: [buyStock()] },
      { id: 'leg-call', instrument: CALL, executions: [sellCall()] },
    ],
  }
}

function mark(instrument: string, price: number): Mark {
  return { instrument, date: '2026-07-15', price, origin: 'manual' }
}

function coveredCallMarks(): MarkSet {
  return new Map([
    ['XYZ', mark('XYZ', 5200)],
    ['XYZ 2026-09-18 C 55', mark('XYZ 2026-09-18 C 55', 100)],
  ])
}

describe('TradeMath.instrumentsOf (multi-leg)', () => {
  it('returns stock, contract, and underlying deduplicated (stock IS the underlying — once)', () => {
    const keys = instrumentsOf(coveredCallTrade())
    expect(keys).toEqual(['XYZ', 'XYZ 2026-09-18 C 55'])
  })
})

describe('TradeMath.valuation (covered call)', () => {
  it('values the worked example: currentValue 5100.00, unrealized 250.00, total 248.35', () => {
    const v = valuation(coveredCallTrade(), coveredCallMarks())
    expect(v.currentValue).toBe(510000)
    expect(v.unrealizedPnL).toBe(25000)
    expect(v.fees).toBe(165)
    expect(v.totalPnL).toBe(24835)
  })

  it('reports per-Leg valuations (stock +200 gross, short call +50 gross)', () => {
    const v = valuation(coveredCallTrade(), coveredCallMarks())
    const stockLeg = v.perLeg.find((l) => l.instrument.kind === 'stock')
    const callLeg = v.perLeg.find((l) => l.instrument.kind === 'option')
    expect(stockLeg?.unrealized).toBe(20000)
    expect(callLeg?.unrealized).toBe(5000)
  })
})

describe('TradeMath.riskReward (covered call)', () => {
  it('computes plannedRisk 500.00 and plannedReward 400.00 via intrinsic projection', () => {
    const rr = riskReward(coveredCallTrade(), coveredCallMarks())
    expect(rr.plannedRisk).toBe(50000)
    expect(rr.plannedReward).toBe(40000)
  })

  it('computes worstCaseRisk 5100.00 and capped maxReward 400.00', () => {
    const rr = riskReward(coveredCallTrade(), coveredCallMarks())
    expect(rr.worstCaseRisk).toBe(510000)
    expect(rr.maxReward).toBe(40000)
  })

  // Entry value 4,850.00 (100×50.00 − 1×1.50×100 = 5,000.00 − 150.00): the
  // WHOLE structure's entry, stock and call summed — not just whichever Leg
  // `entryBasisLegs` happens to iterate first (multi-leg, Slice 7).
  it('computes original risk 250.00 (→4,600 at the 46 stop) and reward 650.00 (→5,500 at the 55 target)', () => {
    const rr = riskReward(coveredCallTrade(), coveredCallMarks())
    expect(rr.original.risk).toBe(25000)
    expect(rr.original.reward).toBe(65000)
  })
})

// A ratio write — 100 shares long + 2 short XYZ 2026-09-18 C 55 (uncovered
// beyond the first 100 shares) — proves structural extremes must sample the
// held strike, not just S→0/S→∞: the payoff climbs from 0 to a PEAK of
// 5,500.00 exactly at the 55 strike (100×55 − 2×0×100), then falls without
// bound past it (slope 100 − 200×1 = −100). An S→0/S→∞-only scan sees slope
// < 0 and would report the S→0 value (0) as the max — a NEGATIVE "max
// reward" once netted against currentValue. Marks: stock 52.00, calls 1.00
// each → currentValue 100×5200 − 2×100×100 = 5,000.00.
describe('TradeMath.riskReward (ratio write — kink-sampled extremes)', () => {
  function ratioWriteTrade(): TradeRecord {
    return {
      id: 'trade-2',
      accountId: 'account-1',
      plan: {
        thesis: 'Ratio write against XYZ stock',
        strategyId: 'strategy-covered-call',
        ideaSourceId: '',
        plannedLegs: [
          { side: 'buy', instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100 },
          { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'call' }, qty: 2 },
        ],
        exitLevels: [],
        plannedAt: '2026-07-10',
      },
      legs: [
        { id: 'leg-stock', instrument: { kind: 'stock', ticker: 'XYZ' }, executions: [buyStock()] },
        {
          id: 'leg-calls',
          instrument: CALL,
          executions: [
            { side: 'sell', qty: 2, price: 150, fees: 65, timestamp: sellCall().timestamp },
          ],
        },
      ],
    }
  }

  function ratioWriteMarks(): MarkSet {
    return new Map([
      ['XYZ', mark('XYZ', 5200)],
      ['XYZ 2026-09-18 C 55', mark('XYZ 2026-09-18 C 55', 100)],
    ])
  }

  it('finds the peak at the short strike: worstCaseRisk unlimited, maxReward 500.00 (not negative)', () => {
    const rr = riskReward(ratioWriteTrade(), ratioWriteMarks())
    expect(rr.worstCaseRisk).toBe('unlimited')
    expect(rr.maxReward).toBe(50000)
  })
})
