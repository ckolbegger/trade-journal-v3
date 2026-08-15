import { describe, it, expect } from 'vitest'
import type { ExecutionFacts, Mark, MarkSeries, TradeRecord } from './types'
import { replay } from './replay'

// Reuses the Slice 1 worked example (docs/plan/slice-01-stock-lifecycle.md,
// also src/domain/trademath/valuation.test.ts): Plan Long Stock buy 100 AAPL,
// stop 140.00, target 170.00. Fill buy 100 @ 150.00 fees 1.00.

function stockTrade(executions: ExecutionFacts[]): TradeRecord {
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

const buy100 = (date: string): ExecutionFacts => ({
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date(`${date}T12:00:00`).getTime(),
})

function series(instrument: string, marks: { date: string; price: number }[]): MarkSeries {
  const list: Mark[] = marks.map((m) => ({
    instrument,
    date: m.date,
    price: m.price,
    origin: 'manual',
  }))
  return new Map([[instrument, list]])
}

describe('TradeMath.replay', () => {
  it('returns one ReplayPoint per marked date the Trade held quantity', () => {
    const trade = stockTrade([buy100('2026-07-10')])
    const marks = series('AAPL', [
      { date: '2026-07-10', price: 15000 },
      { date: '2026-07-11', price: 15500 },
      { date: '2026-07-12', price: 16000 },
    ])
    const points = replay(trade, marks)
    expect(points.map((p) => p.date)).toEqual(['2026-07-10', '2026-07-11', '2026-07-12'])
  })

  it("computes each point's Valuation and RiskReward from that date's Marks", () => {
    // The exact Slice 1 worked example, at the mark-160 date: currentValue
    // 16000.00, unrealized 1000.00, fees 1.00, total 999.00; plannedRisk
    // 2000.00, worstCaseRisk 16000.00, plannedReward 1000.00, maxReward
    // unlimited; original risk 1000.00, reward 2000.00.
    const trade = stockTrade([buy100('2026-07-10')])
    const marks = series('AAPL', [{ date: '2026-07-15', price: 16000 }])
    const [point] = replay(trade, marks)

    expect(point.date).toBe('2026-07-15')
    expect(point.valuation).toMatchObject({
      currentValue: 1600000,
      unrealizedPnL: 100000,
      fees: 100,
      totalPnL: 99900,
    })
    expect(point.riskReward).toMatchObject({
      plannedRisk: 200000,
      worstCaseRisk: 1600000,
      plannedReward: 100000,
      maxReward: 'unlimited',
      original: { risk: 100000, reward: 200000 },
    })
  })

  it("reflects executions as of each date (a partial close changes later points' basis)", () => {
    // The S5.2 worked example (docs/plan/slice-05-scaling.md): buy 100 @
    // 150.00 fees 1.00 (Lot A, 07-10), buy 100 @ 160.00 fees 1.00 (Lot B,
    // 07-12), sell 120 @ 165.00 fees 1.00 (partial, 07-15) — basis before the
    // partial is 31000.00 (avgCost 155.00, both Lots open); after, basis is
    // the remaining 80 shares' 12800.00 (avgCost 160.00, Lot B only, FIFO).
    const buyLotA = buy100('2026-07-10')
    const buyLotB: ExecutionFacts = {
      side: 'buy',
      qty: 100,
      price: 16000,
      fees: 100,
      timestamp: new Date('2026-07-12T12:00:00').getTime(),
    }
    const sell120: ExecutionFacts = {
      side: 'sell',
      qty: 120,
      price: 16500,
      fees: 100,
      timestamp: new Date('2026-07-15T12:00:00').getTime(),
    }
    const trade = stockTrade([buyLotA, buyLotB, sell120])
    const marks = series('AAPL', [
      { date: '2026-07-12', price: 16500 },
      { date: '2026-07-16', price: 16500 },
    ])

    const [beforePartial, afterPartial] = replay(trade, marks)

    expect(beforePartial.date).toBe('2026-07-12')
    expect(beforePartial.valuation.perLeg[0].basis).toBe(3100000)
    expect(beforePartial.valuation.perLeg[0].avgCost).toBe(15500)

    expect(afterPartial.date).toBe('2026-07-16')
    expect(afterPartial.valuation.perLeg[0].basis).toBe(1280000)
    expect(afterPartial.valuation.perLeg[0].avgCost).toBe(16000)
  })

  it('renders no point for gap dates (a gap is a gap, never a flat line)', () => {
    // The S7.2 bull-put-spread worked example (docs/plan/slice-07-multi-leg.md):
    // sell 1 XYZ 2026-08-21 P 100, buy 1 XYZ 2026-08-21 P 90 — TWO held Legs,
    // each needing its OWN Mark (fix, review round 1: the required set is
    // "what the Trade actually holds", never a held Leg's underlying — an
    // option Trade has no stock Leg here at all, so an underlying-based gap
    // rule would never even fire; a date missing EITHER put's own Mark is the
    // real gap, any-missing).
    const SHORT_PUT = {
      kind: 'option',
      ticker: 'XYZ',
      expiration: '2026-08-21',
      type: 'put',
      strike: 10000,
    } as const
    const LONG_PUT = {
      kind: 'option',
      ticker: 'XYZ',
      expiration: '2026-08-21',
      type: 'put',
      strike: 9000,
    } as const
    const timestamp = new Date('2026-07-10T12:00:00').getTime()
    const trade: TradeRecord = {
      id: 'trade-spread',
      accountId: 'account-1',
      plan: {
        thesis: 'XYZ range-bound, bullish bias',
        strategyId: 'strategy-bull-put-spread',
        ideaSourceId: '',
        plannedLegs: [
          { side: 'sell', instrument: SHORT_PUT, qty: 1 },
          { side: 'buy', instrument: LONG_PUT, qty: 1 },
        ],
        exitLevels: [],
        plannedAt: '2026-07-10',
      },
      legs: [
        {
          id: 'leg-short',
          instrument: SHORT_PUT,
          executions: [{ side: 'sell', qty: 1, price: 260, fees: 65, timestamp }],
        },
        {
          id: 'leg-long',
          instrument: LONG_PUT,
          executions: [{ side: 'buy', qty: 1, price: 60, fees: 65, timestamp }],
        },
      ],
    }

    const shortKey = 'XYZ 2026-08-21 P 100'
    const longKey = 'XYZ 2026-08-21 P 90'
    const marks: MarkSeries = new Map([
      [
        shortKey,
        [
          { instrument: shortKey, date: '2026-07-10', price: 110, origin: 'manual' },
          { instrument: shortKey, date: '2026-07-11', price: 120, origin: 'manual' },
          { instrument: shortKey, date: '2026-07-12', price: 130, origin: 'manual' },
        ],
      ],
      [
        longKey,
        [
          { instrument: longKey, date: '2026-07-10', price: 20, origin: 'manual' },
          // 2026-07-11's long-put Mark is missing — a gap for that date only,
          // even though the short put itself has a Mark that day.
          { instrument: longKey, date: '2026-07-12', price: 25, origin: 'manual' },
        ],
      ],
    ])

    const points = replay(trade, marks)
    expect(points.map((p) => p.date)).toEqual(['2026-07-10', '2026-07-12'])
  })

  it('replays a closed Trade start to finish', () => {
    // The full S5.2 worked example through its final close: buy 100 @ 150.00
    // fees 1.00 (07-10), buy 100 @ 160.00 fees 1.00 (07-12), sell 120 @
    // 165.00 fees 1.00 (07-15, partial), sell 80 @ 170.00 fees 1.00 (07-20,
    // flattens) — total realized 2396.00, Trade flat.
    const buyLotA = buy100('2026-07-10')
    const buyLotB: ExecutionFacts = {
      side: 'buy',
      qty: 100,
      price: 16000,
      fees: 100,
      timestamp: new Date('2026-07-12T12:00:00').getTime(),
    }
    const sell120: ExecutionFacts = {
      side: 'sell',
      qty: 120,
      price: 16500,
      fees: 100,
      timestamp: new Date('2026-07-15T12:00:00').getTime(),
    }
    const sell80Final: ExecutionFacts = {
      side: 'sell',
      qty: 80,
      price: 17000,
      fees: 100,
      timestamp: new Date('2026-07-20T12:00:00').getTime(),
    }
    const trade = stockTrade([buyLotA, buyLotB, sell120, sell80Final])
    const marks = series('AAPL', [
      { date: '2026-07-10', price: 15000 },
      { date: '2026-07-12', price: 16000 },
      { date: '2026-07-15', price: 16500 },
      { date: '2026-07-20', price: 17000 },
      // A date AFTER the flattening fill — never a point (the boundary the
      // "dates after the flattening fill produce no points" ruling names).
      { date: '2026-07-21', price: 17100 },
    ])

    const points = replay(trade, marks)

    expect(points.map((p) => p.date)).toEqual([
      '2026-07-10',
      '2026-07-12',
      '2026-07-15',
      '2026-07-20',
    ])
    const last = points[points.length - 1]
    expect(last.valuation.realizedPnL).toBe(239600)
    expect(last.valuation.unrealizedPnL).toBe(0)
  })

  it('renders nothing through a flat interval between a close and a later reopen', () => {
    // buy 100 @ 150.00 (07-10) — held; sell 100 @ 160.00 (07-12) — flattens,
    // still gets a point (still held going INTO that day); 07-13 through
    // 07-15 are flat — TradeBook permits reopening a flat Leg freely, so this
    // is not a "closed Trade" (no [first,last] window applies) but an
    // interior gap; buy 100 @ 170.00 (07-16) reopens — gets a point (held by
    // day's end); 07-17 stays held.
    const buy: ExecutionFacts = {
      side: 'buy',
      qty: 100,
      price: 15000,
      fees: 100,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    }
    const sell: ExecutionFacts = {
      side: 'sell',
      qty: 100,
      price: 16000,
      fees: 100,
      timestamp: new Date('2026-07-12T12:00:00').getTime(),
    }
    const reopen: ExecutionFacts = {
      side: 'buy',
      qty: 100,
      price: 17000,
      fees: 100,
      timestamp: new Date('2026-07-16T12:00:00').getTime(),
    }
    const trade = stockTrade([buy, sell, reopen])
    const marks = series(
      'AAPL',
      [
        '2026-07-10',
        '2026-07-11',
        '2026-07-12',
        '2026-07-13',
        '2026-07-14',
        '2026-07-15',
        '2026-07-16',
        '2026-07-17',
      ].map((date) => ({ date, price: 16000 })),
    )

    const points = replay(trade, marks)

    expect(points.map((p) => p.date)).toEqual([
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
      '2026-07-16',
      '2026-07-17',
    ])
  })
})
