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

// The long-call worked example (docs/plan/slice-03-single-leg-options.md):
// Plan Long Call, buy 1 AAPL 2027-06-18 C 200; Exit Levels: structureValue stop
// 6.00, target 24.00. Fill buy 1 @ 12.00, fees $0.65. Mark contract 14.00.
describe('TradeMath.riskReward (structureValue levels)', () => {
  const AAPL_CALL = {
    kind: 'option',
    ticker: 'AAPL',
    expiration: '2027-06-18',
    type: 'call',
    strike: 20000,
  } as const
  const AAPL_PUT_200 = {
    kind: 'option',
    ticker: 'AAPL',
    expiration: '2027-06-18',
    type: 'put',
    strike: 20000,
  } as const

  const structStop: ExitLevel = {
    scope: { level: 'trade' },
    side: 'stop',
    kind: 'structureValue',
    value: 600,
  }
  const structTarget: ExitLevel = {
    scope: { level: 'trade' },
    side: 'target',
    kind: 'structureValue',
    value: 2400,
  }

  function optionTradeWith(
    instrument: typeof AAPL_CALL | typeof AAPL_PUT_200,
    executions: ExecutionFacts[],
    exitLevels: ExitLevel[],
  ): TradeRecord {
    return {
      id: 'trade-1',
      accountId: 'account-1',
      plan: {
        thesis: 'AAPL breaks out',
        strategyId: 'strategy-long-call',
        ideaSourceId: '',
        plannedLegs: [{ side: 'buy', instrument, qty: 1 }],
        exitLevels,
        plannedAt: '2026-07-10',
      },
      legs: executions.length === 0 ? [] : [{ id: 'leg-1', instrument, executions }],
    }
  }

  const buyCall = (): ExecutionFacts => ({
    side: 'buy',
    qty: 1,
    price: 1200,
    fees: 65,
    timestamp: new Date('2026-07-10T12:00:00').getTime(),
  })

  function contractMarks(price: number): MarkSet {
    return new Map([
      [
        'AAPL 2027-06-18 C 200',
        { instrument: 'AAPL 2027-06-18 C 200', date: '2026-07-15', price, origin: 'manual' },
      ],
    ])
  }

  it('computes the long-call worked example: plannedRisk 800.00, worstCase 1400.00, plannedReward 1000.00', () => {
    const rr = riskReward(
      optionTradeWith(AAPL_CALL, [buyCall()], [structStop, structTarget]),
      contractMarks(1400),
    )
    expect(rr.plannedRisk).toBe(80000)
    expect(rr.worstCaseRisk).toBe(140000)
    expect(rr.plannedReward).toBe(100000)
  })

  it('returns maxReward "unlimited" for a long call', () => {
    const rr = riskReward(
      optionTradeWith(AAPL_CALL, [buyCall()], [structStop, structTarget]),
      contractMarks(1400),
    )
    expect(rr.maxReward).toBe('unlimited')
  })

  it('returns maxReward at intrinsic-at-zero for a long put (strike × 100 minus nothing)', () => {
    // Buy 1 AAPL 200 put @ 5.00, fees 65, marked mark-to-market at 6.00 (not at
    // cost — the mark-to-market anchor, ADR 0010): current value = 1 × 600 × 100
    // = $600.00. Intrinsic at underlying 0 is the strike untouched (200 − 0 =
    // 200) × the 100 contract multiplier = $20,000.00.
    // maxReward = $20,000.00 − $600.00 = $19,400.00.
    const buyPut: ExecutionFacts = {
      side: 'buy',
      qty: 1,
      price: 500,
      fees: 65,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    }
    const marks: MarkSet = new Map([
      [
        'AAPL 2027-06-18 P 200',
        { instrument: 'AAPL 2027-06-18 P 200', date: '2026-07-15', price: 600, origin: 'manual' },
      ],
    ])
    const rr = riskReward(optionTradeWith(AAPL_PUT_200, [buyPut], []), marks)
    expect(rr.maxReward).toBe(1940000)
  })

  it('reports original risk 600.00 and reward 1200.00 from entry basis 12.00', () => {
    const rr = riskReward(
      optionTradeWith(AAPL_CALL, [buyCall()], [structStop, structTarget]),
      contractMarks(1400),
    )
    expect(rr.original.risk).toBe(60000)
    expect(rr.original.reward).toBe(120000)
  })
})
