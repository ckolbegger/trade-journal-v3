import { describe, it, expect } from 'vitest'
import type { ExecutionFacts, ExitLevel, Mark, MarkSet, TradeRecord } from './types'
import { valuation } from './valuation'
import { riskReward } from './risk-reward'

// The bull-put-spread worked example (docs/plan/slice-07-multi-leg.md, S7.2),
// all money in cents: sell 1 XYZ 2026-08-21 P 100 @ 2.60, buy 1 XYZ
// 2026-08-21 P 90 @ 0.60; net credit 2.00, total fees $1.30. Marks: short put
// 1.10, long put 0.20 → structure −$90. Exit Levels: underlyingPrice stop 97,
// Position price target 0.50 (75% of the 2.00 credit — amended per exit-level
// ruling 2026-07-19, was pctOfMaxProfit).

const SHORT_PUT = {
  kind: 'option',
  ticker: 'XYZ',
  expiration: '2026-08-21',
  type: 'put',
  strike: 10000, // 100
} as const

const LONG_PUT = {
  kind: 'option',
  ticker: 'XYZ',
  expiration: '2026-08-21',
  type: 'put',
  strike: 9000, // 90
} as const

const stop: ExitLevel = {
  scope: { level: 'trade' },
  side: 'stop',
  kind: 'underlyingPrice',
  price: 9700, // 97
}
const positionPriceTarget: ExitLevel = {
  scope: { level: 'trade' },
  side: 'target',
  kind: 'structureValue',
  value: 50, // 0.50 buyback — 75% of the 2.00 credit
}

const timestamp = new Date('2026-07-10T12:00:00').getTime()

const sellShortPut = (): ExecutionFacts => ({
  side: 'sell',
  qty: 1,
  price: 260,
  fees: 65,
  timestamp,
})

const buyLongPut = (): ExecutionFacts => ({
  side: 'buy',
  qty: 1,
  price: 60,
  fees: 65,
  timestamp,
})

function spreadTrade(exitLevels: ExitLevel[] = [stop, positionPriceTarget]): TradeRecord {
  return {
    id: 'trade-1',
    accountId: 'account-1',
    plan: {
      thesis: 'XYZ range-bound, bullish bias',
      strategyId: 'strategy-bull-put-spread',
      ideaSourceId: '',
      plannedLegs: [
        { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'put' }, qty: 1 },
        { side: 'buy', instrument: { kind: 'option', ticker: 'XYZ', type: 'put' }, qty: 1 },
      ],
      exitLevels,
      plannedAt: '2026-07-10',
    },
    legs: [
      { id: 'leg-short', instrument: SHORT_PUT, executions: [sellShortPut()] },
      { id: 'leg-long', instrument: LONG_PUT, executions: [buyLongPut()] },
    ],
  }
}

function mark(instrument: string, price: number): Mark {
  return { instrument, date: '2026-07-15', price, origin: 'manual' }
}

function spreadMarks(): MarkSet {
  return new Map([
    ['XYZ 2026-08-21 P 100', mark('XYZ 2026-08-21 P 100', 110)],
    ['XYZ 2026-08-21 P 90', mark('XYZ 2026-08-21 P 90', 20)],
  ])
}

// The ADR 0010 marks the doc frames as "risking $950 to make $50": the
// spread has moved toward the 75% target (net 0.50 to buy back) but marks
// haven't reached it yet — short put marked 0.60, long put marked 0.10.
function framingMarks(): MarkSet {
  return new Map([
    ['XYZ 2026-08-21 P 100', mark('XYZ 2026-08-21 P 100', 60)],
    ['XYZ 2026-08-21 P 90', mark('XYZ 2026-08-21 P 90', 10)],
  ])
}

describe('TradeMath.valuation (bull put spread)', () => {
  it('values the worked example: structure -90.00, unrealized +110.00, total 108.70', () => {
    const v = valuation(spreadTrade(), spreadMarks())
    expect(v.currentValue).toBe(-9000)
    expect(v.unrealizedPnL).toBe(11000)
    expect(v.fees).toBe(130)
    expect(v.totalPnL).toBe(10870)
  })
})

describe('TradeMath.riskReward (bull put spread)', () => {
  it('computes plannedRisk 210.00 (intrinsic at the 97 stop)', () => {
    const rr = riskReward(spreadTrade(), spreadMarks())
    expect(rr.plannedRisk).toBe(21000)
  })

  it('resolves the 0.50 Position price target (75% of net credit 2.00) → plannedReward 40.00', () => {
    const rr = riskReward(spreadTrade(), spreadMarks())
    expect(rr.plannedReward).toBe(4000)
  })

  it('computes worstCaseRisk 910.00 (full width beyond the long strike, net of credit)', () => {
    const rr = riskReward(spreadTrade(), spreadMarks())
    expect(rr.worstCaseRisk).toBe(91000)
  })

  it('computes maxReward 90.00', () => {
    const rr = riskReward(spreadTrade(), spreadMarks())
    expect(rr.maxReward).toBe(9000)
  })

  it('frames the ADR 0010 marks as risking 950.00 to make 50.00', () => {
    const rr = riskReward(spreadTrade(), framingMarks())
    expect(rr.worstCaseRisk).toBe(95000)
    expect(rr.maxReward).toBe(5000)
  })

  // The debit twin: buy the 100 put, sell the 90 put — the exact opposite
  // side on each Leg, same strikes/marks. Structural extremes swap (a
  // credit spread's maxReward is a debit spread's worstCaseRisk, and vice
  // versa) because the structure's signed value negates at every S — proof
  // that the SAME formula (structureValueAt, structuralExtremes) handles
  // both without any credit/debit branch (ADR 0012).
  it('produces identical formulas for a debit spread (signs carry direction — no credit/debit branch)', () => {
    const debitTrade: TradeRecord = {
      id: 'trade-2',
      accountId: 'account-1',
      plan: {
        thesis: 'XYZ bearish bias',
        strategyId: 'strategy-bull-put-spread',
        ideaSourceId: '',
        plannedLegs: [
          { side: 'buy', instrument: { kind: 'option', ticker: 'XYZ', type: 'put' }, qty: 1 },
          { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'put' }, qty: 1 },
        ],
        exitLevels: [],
        plannedAt: '2026-07-10',
      },
      legs: [
        {
          id: 'leg-long',
          instrument: SHORT_PUT,
          executions: [{ side: 'buy', qty: 1, price: 260, fees: 65, timestamp }],
        },
        {
          id: 'leg-short',
          instrument: LONG_PUT,
          executions: [{ side: 'sell', qty: 1, price: 60, fees: 65, timestamp }],
        },
      ],
    }
    const rr = riskReward(debitTrade, spreadMarks())
    expect(rr.worstCaseRisk).toBe(9000) // mirrors the credit spread's maxReward 90.00
    expect(rr.maxReward).toBe(91000) // mirrors the credit spread's worstCaseRisk 910.00
  })
})
