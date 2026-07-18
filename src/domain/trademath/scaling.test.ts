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

// S5.2 partial close (docs/plan/slice-05-scaling.md), continuing the worked
// example above: sell 120 @ 165.00 fees 1.00 consumes Lot A fully (100 @
// 150.00) plus 20 of Lot B (@ 160.00), then a final sell 80 @ 170.00 fees
// 1.00 consumes the rest of Lot B and flattens the Leg.
const sell120 = (): ExecutionFacts => ({
  side: 'sell',
  qty: 120,
  price: 16500,
  fees: 100,
  timestamp: new Date('2026-07-15T12:00:00').getTime(),
})

const sell80Final = (): ExecutionFacts => ({
  side: 'sell',
  qty: 80,
  price: 17000,
  fees: 100,
  timestamp: new Date('2026-07-20T12:00:00').getTime(),
})

describe('TradeMath.valuation (FIFO partial close)', () => {
  it('realizes 1597.00 on the worked-example sell of 120 (Lot A fully, Lot B 20; all fees to date netted)', () => {
    const v = valuation(tradeWith([buyLotA(), buyLotB(), sell120()]), markSet(16500))
    expect(v.realizedPnL).toBe(159700)
  })

  it('reports remaining basis 12800.00 over 80 shares', () => {
    const v = valuation(tradeWith([buyLotA(), buyLotB(), sell120()]), markSet(16500))
    expect(v.perLeg[0].basis).toBe(1280000)
    // avgCost is the REMAINING Lots' average (Lot B only, 160.00) — not the
    // whole-Trade weighted average across every opening fill (155.00), which
    // is what a pre-FIFO basis-sum implementation would report here.
    expect(v.perLeg[0].avgCost).toBe(16000)
    expect(positionOf(tradeWith([buyLotA(), buyLotB(), sell120()])).holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 80, side: 'long' },
    ])
  })

  it('reports unrealized 400.00 at mark 165 on the remainder', () => {
    const v = valuation(tradeWith([buyLotA(), buyLotB(), sell120()]), markSet(16500))
    expect(v.unrealizedPnL).toBe(40000)
  })

  it('realizes 799.00 more on the final sell of 80, totaling 2396.00', () => {
    const afterPartial = valuation(tradeWith([buyLotA(), buyLotB(), sell120()]), markSet(16500))
    const afterFinal = valuation(
      tradeWith([buyLotA(), buyLotB(), sell120(), sell80Final()]),
      markSet(17000),
    )
    expect(afterFinal.realizedPnL - afterPartial.realizedPnL).toBe(79900)
    expect(afterFinal.realizedPnL).toBe(239600)
  })

  it('reproduces identical numbers recomputed from the Execution record alone', () => {
    const executions = [buyLotA(), buyLotB(), sell120(), sell80Final()]
    // A fresh TradeRecord built from a structurally-cloned copy of the same
    // Execution facts — proves the numbers come from the Execution record
    // alone, not from any Lot state carried between calls.
    const replayed = tradeWith(structuredClone(executions))
    const original = valuation(tradeWith(executions), markSet(17000))
    const reproduced = valuation(replayed, markSet(17000))
    expect(reproduced).toEqual(original)
    expect(reproduced.realizedPnL).toBe(239600)
  })

  // Short Lots consume FIFO symmetrically: sell-to-open two option Lots, then
  // buy-to-close the first Lot only (hand-computed independently of the
  // implementation, mirroring the long worked example's fee/FIFO rules).
  // Lot A: sell 1 @ 5.00 fees 0.10 · Lot B: sell 1 @ 5.20 fees 0.10 -> position
  // short 2, basis 1020.00 (avg 5.10). Buy-to-close 1 @ 4.00 fees 0.05
  // consumes Lot A only: gross realized = (500 - 400) * 100 = 10000 cents;
  // fees to date 0.10 + 0.10 + 0.05 = 0.25 -> realized 10000 - 25 = 9975
  // (99.75). Remainder: short 1 from Lot B, basis 520.00; at mark 4.50,
  // unrealized = -1 * 1 * (450 - 520) * 100 = 7000 (70.00).
  it('consumes short Lots FIFO symmetrically (partial buy-to-close of a -2 contract position)', () => {
    const XYZ_PUT = {
      kind: 'option',
      ticker: 'XYZ',
      expiration: '2026-08-21',
      type: 'put',
      strike: 10000,
    } as const

    function shortTrade(executions: ExecutionFacts[]): TradeRecord {
      return {
        id: 'trade-short',
        accountId: 'account-1',
        plan: {
          thesis: 'XYZ range-bound',
          strategyId: 'strategy-cash-secured-put',
          ideaSourceId: '',
          plannedLegs: [{ side: 'sell', instrument: XYZ_PUT, qty: 2 }],
          exitLevels: [],
          plannedAt: '2026-07-10',
        },
        legs: [{ id: 'leg-1', instrument: XYZ_PUT, executions }],
      }
    }

    const sellLotA: ExecutionFacts = {
      side: 'sell',
      qty: 1,
      price: 500,
      fees: 10,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    }
    const sellLotB: ExecutionFacts = {
      side: 'sell',
      qty: 1,
      price: 520,
      fees: 10,
      timestamp: new Date('2026-07-11T12:00:00').getTime(),
    }
    const buyToCloseLotA: ExecutionFacts = {
      side: 'buy',
      qty: 1,
      price: 400,
      fees: 5,
      timestamp: new Date('2026-07-15T12:00:00').getTime(),
    }

    const marks: MarkSet = new Map([
      [
        'XYZ 2026-08-21 P 100',
        { instrument: 'XYZ 2026-08-21 P 100', date: '2026-07-15', price: 450, origin: 'manual' },
      ],
    ])
    const v = valuation(shortTrade([sellLotA, sellLotB, buyToCloseLotA]), marks)
    expect(v.perLeg[0].realized).toBe(9975)
    expect(v.perLeg[0].basis).toBe(52000)
    expect(v.perLeg[0].unrealized).toBe(7000)
  })
})
