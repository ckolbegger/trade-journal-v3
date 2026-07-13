import { describe, it, expect, vi } from 'vitest'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import type { ExitLevel } from '@/domain/trademath/types'
import { inMemoryBooks, inMemoryTradeBook } from '../../tests/support/trade-book'
import { Valuations } from './valuations'

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

async function seedPlan(book: TradeBook, exitLevels: ExitLevel[] = []): Promise<string> {
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels,
    plannedAt: '2026-07-10',
  }
  return book.confirmPlan(draft)
}

async function bookWithPlan(): Promise<{ book: TradeBook; tradeId: string }> {
  const book = inMemoryTradeBook()
  const tradeId = await seedPlan(book)
  return { book, tradeId }
}

// A TradeBook + PriceBook sharing one binding — the wiring detail/value use.
function books(): { tradeBook: TradeBook; priceBook: PriceBook } {
  const { tradeBook, priceBook } = inMemoryBooks()
  return { tradeBook, priceBook }
}

function fill(): ExecutionDraft {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date('2026-07-10T12:00:00').getTime(),
  }
}

describe('Valuations.position', () => {
  it('returns the Position for a Trade id', async () => {
    const { book, tradeId } = await bookWithPlan()
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    const valuations = new Valuations(book)
    const position = await valuations.position(tradeId)
    expect(position.holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100, side: 'long' },
    ])
  })

  it('touches PriceBook not at all (no marks needed)', async () => {
    // Valuations.position is constructed with only a TradeBook — no PriceBook is
    // supplied or consulted; the Position derives purely from Executions.
    const { book, tradeId } = await bookWithPlan()
    const valuations = new Valuations(book)
    const position = await valuations.position(tradeId)
    expect(position.holdings).toEqual([])
  })
})

describe('Valuations.detail', () => {
  it('fetches the record once and the series once (one snapshot feeds every number)', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook, [stop, target])
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', '2026-07-15', 16000, 'manual')
    const getSpy = vi.spyOn(tradeBook, 'get')
    const seriesSpy = vi.spyOn(priceBook, 'series')

    await new Valuations(tradeBook, priceBook).detail(tradeId)

    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(seriesSpy).toHaveBeenCalledTimes(1)
  })

  it('returns facts, Position, Valuation, and RiskReward that agree on the same executions', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook, [stop, target])
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', '2026-07-15', 16000, 'manual')

    const detail = await new Valuations(tradeBook, priceBook).detail(tradeId)

    expect(detail.record.id).toBe(tradeId)
    expect(detail.position.holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100, side: 'long' },
    ])
    expect(detail.valuation?.totalPnL).toBe(99900)
    expect(detail.valuation?.currentValue).toBe(1600000)
    expect(detail.riskReward?.plannedRisk).toBe(200000)
    expect(detail.riskReward?.maxReward).toBe('unlimited')
    expect(detail.marksMissing).toBeUndefined()
  })

  it('uses the latest date in the series as the valuation MarkSet', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook, [stop, target])
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', '2026-07-14', 15500, 'manual')
    await priceBook.record('AAPL', '2026-07-15', 16000, 'manual')

    const detail = await new Valuations(tradeBook, priceBook).detail(tradeId)

    // 160.00 (the latest date) → unrealized 1000.00, not 15500's 500.00.
    expect(detail.valuation?.unrealizedPnL).toBe(100000)
  })

  it('returns a marks-missing signal (instrument list) instead of numbers when no Mark exists yet', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook, [stop, target])
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())

    const detail = await new Valuations(tradeBook, priceBook).detail(tradeId)

    expect(detail.marksMissing).toEqual(['AAPL'])
    expect(detail.valuation).toBeUndefined()
    expect(detail.riskReward).toBeUndefined()
  })
})

// The Daily Review scenario: the trader marked Monday (07-13), skipped Tuesday,
// and opens the review on Wednesday (07-15). Fills landed Friday 07-10.
describe('Valuations.marksNeeded', () => {
  const monday = '2026-07-13'
  const tuesday = '2026-07-14'
  const wednesday = '2026-07-15'

  it("lists each open Trade's instruments and gap range", async () => {
    const { tradeBook, priceBook } = books()
    const aapl = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', monday, 16000, 'manual')

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade).toEqual([
      { tradeId: aapl, needs: [{ instrument: 'AAPL', range: { from: tuesday, to: wednesday } }] },
    ])
  })

  it("starts a never-marked instrument at its Trade's first Execution date", async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook)
    // The fill is Friday 2026-07-10 — the Trade has needed a Mark since that day.
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade).toEqual([
      {
        tradeId,
        needs: [{ instrument: 'AAPL', range: { from: '2026-07-10', to: wednesday } }],
      },
    ])
  })

  it('starts a marked instrument the day after its last Mark', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', tuesday, 16100, 'manual')

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade[0].needs[0].range).toEqual({ from: wednesday, to: wednesday })
  })

  it('includes skipped days (Monday-marked instrument on Wednesday needs Tue+Wed)', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', monday, 16000, 'manual')

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    // The skipped Tuesday is inside the gap by construction — nobody was asked.
    const missing = await priceBook.missingMarks(
      needed.perTrade[0].needs.map((n) => n.instrument),
      needed.perTrade[0].needs[0].range,
    )
    expect(missing).toEqual([
      { instrument: 'AAPL', date: tuesday },
      { instrument: 'AAPL', date: wednesday },
    ])
  })

  it('excludes closed and planned Trades', async () => {
    const { tradeBook, priceBook } = books()
    await tradeBook.registries.closeReasons.save({ id: 'close-hit-target', name: 'Hit Target' })
    const open = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId: open, newLeg: 'AAPL' }, fill())

    const closed = await seedPlan(tradeBook)
    const { record } = await tradeBook.recordExecution({ tradeId: closed, newLeg: 'AAPL' }, fill())
    await tradeBook.recordExecution(
      { tradeId: closed, legId: record.legs[0].id },
      { ...fill(), side: 'sell' },
    )
    await tradeBook.setCloseReason(closed, { id: 'close-hit-target', name: 'Hit Target' })

    await seedPlan(tradeBook) // planned — never filled

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade.map((t) => t.tradeId)).toEqual([open])
  })

  it('returns an empty list when everything is marked through asOf', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', wednesday, 16000, 'manual')

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade).toEqual([])
  })

  it('reports the fetch range from the earliest gap through asOf', async () => {
    const { tradeBook, priceBook } = books()
    const marked = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId: marked, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', monday, 16000, 'manual')

    const neverMarked = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId: neverMarked, newLeg: 'MSFT' }, fill())

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    // Earliest gap start: the never-marked MSFT Trade's first Execution (07-10),
    // ahead of AAPL's day-after-Monday (07-14).
    expect(needed.fetchRange).toEqual({ from: '2026-07-10', to: wednesday })
  })
})

// A Trade holding an option Leg needs Marks for the contract AND its underlying
// (TradeMath.instrumentsOf) — and the two gap independently (S3.1, resolving the
// S1.6 review question: a shared per-Trade range would resurface one
// instrument's deliberately-skipped dates as the other's gap).
describe('Valuations.marksNeeded (per-instrument ranges)', () => {
  const monday = '2026-07-13'
  const tuesday = '2026-07-14'
  const wednesday = '2026-07-15'
  const CONTRACT = 'AAPL 2027-06-18 C 200'

  async function seedCallPlan(book: TradeBook): Promise<string> {
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
    const draft: PlanDraft = {
      accountId: account.id,
      thesis: 'AAPL breaks out',
      strategyId: 'strategy-long-call',
      ideaSourceId: '',
      plannedLegs: [
        {
          side: 'buy',
          instrument: {
            kind: 'option',
            ticker: 'AAPL',
            expiration: '2027-06-18',
            type: 'call',
            strike: 20000,
          },
          qty: 1,
        },
      ],
      exitLevels: [],
      plannedAt: '2026-07-10',
    }
    return book.confirmPlan(draft)
  }

  function optionFill(): ExecutionDraft {
    return {
      side: 'buy',
      qty: 1,
      price: 1200,
      fees: 65,
      timestamp: new Date('2026-07-10T12:00:00').getTime(),
    }
  }

  it('returns independent ranges when the contract and underlying were last marked on different dates', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedCallPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: CONTRACT }, optionFill())
    await priceBook.record(CONTRACT, monday, 1400, 'manual')
    await priceBook.record('AAPL', tuesday, 20500, 'manual')

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade).toEqual([
      {
        tradeId,
        needs: [
          { instrument: CONTRACT, range: { from: tuesday, to: wednesday } },
          { instrument: 'AAPL', range: { from: wednesday, to: wednesday } },
        ],
      },
    ])
  })

  it("starts a never-marked underlying at the Trade's first Execution date while the contract keeps its own gap", async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedCallPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: CONTRACT }, optionFill())
    await priceBook.record(CONTRACT, monday, 1400, 'manual')
    // AAPL (the underlying) has never been marked.

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade).toEqual([
      {
        tradeId,
        needs: [
          { instrument: CONTRACT, range: { from: tuesday, to: wednesday } },
          { instrument: 'AAPL', range: { from: '2026-07-10', to: wednesday } },
        ],
      },
    ])
  })

  it('keeps fetchRange = earliest gap start across all instruments → asOf', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedCallPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: CONTRACT }, optionFill())
    await priceBook.record(CONTRACT, monday, 1400, 'manual')
    // AAPL's gap starts 2026-07-10 (first Execution) — earlier than the
    // contract's day-after-Monday gap.

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.fetchRange).toEqual({ from: '2026-07-10', to: wednesday })
  })
})

// The mark-entry seam for an option Trade: today's valuation and R/R never
// require the underlying's Mark in this slice (Long Call/Put use structureValue
// Exit Levels, compared straight to the contract's own Mark) — only Marks
// collection (above) treats the underlying as needed, for future underlyingPrice
// levels and IV display.
describe('MarkEntry (options)', () => {
  const CONTRACT = 'AAPL 2027-06-18 C 200'

  async function seedCallPlan(book: TradeBook): Promise<string> {
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
    const draft: PlanDraft = {
      accountId: account.id,
      thesis: 'AAPL breaks out',
      strategyId: 'strategy-long-call',
      ideaSourceId: '',
      plannedLegs: [
        {
          side: 'buy',
          instrument: {
            kind: 'option',
            ticker: 'AAPL',
            expiration: '2027-06-18',
            type: 'call',
            strike: 20000,
          },
          qty: 1,
        },
      ],
      exitLevels: [
        { scope: { level: 'trade' }, side: 'stop', kind: 'structureValue', value: 600 },
        { scope: { level: 'trade' }, side: 'target', kind: 'structureValue', value: 2400 },
      ],
      plannedAt: '2026-07-10',
    }
    return book.confirmPlan(draft)
  }

  it('computes valuation from the contract Mark alone when the underlying is unmarked (R/R shows marks-missing for underlying-anchored levels only)', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedCallPlan(tradeBook)
    await tradeBook.recordExecution(
      { tradeId, newLeg: CONTRACT },
      {
        side: 'buy',
        qty: 1,
        price: 1200,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    await priceBook.record(CONTRACT, '2026-07-15', 1400, 'manual')
    // AAPL (the underlying) is never marked.

    const detail = await new Valuations(tradeBook, priceBook).detail(tradeId)

    expect(detail.marksMissing).toBeUndefined()
    expect(detail.valuation?.currentValue).toBe(140000)
    expect(detail.valuation?.totalPnL).toBe(19935)
    expect(detail.riskReward?.plannedRisk).toBe(80000)
  })
})

// Facts + positionOf only — no Marks (docs/design/overview.md). A contract past
// its expiration date still holding quantity is surfaced for Review's agenda to
// present; nothing else in the system notices expiration on its own.
describe('Valuations.expiredHoldings', () => {
  const CONTRACT = 'XYZ 2026-08-21 P 100'

  async function seedCsp(book: TradeBook, side: 'buy' | 'sell' = 'sell'): Promise<string> {
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
    const draft: PlanDraft = {
      accountId: account.id,
      thesis: 'XYZ range-bound',
      strategyId: 'strategy-cash-secured-put',
      ideaSourceId: '',
      plannedLegs: [
        {
          side,
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: '2026-08-21',
            type: 'put',
            strike: 10000,
          },
          qty: 1,
        },
      ],
      exitLevels: [],
      plannedAt: '2026-07-10',
    }
    const tradeId = await book.confirmPlan(draft)
    await book.recordExecution(
      { tradeId, newLeg: CONTRACT },
      {
        side,
        qty: 1,
        price: 250,
        fees: 65,
        timestamp: new Date('2026-07-10T12:00:00').getTime(),
      },
    )
    return tradeId
  }

  it('lists Legs past expiration still holding quantity, with trade, qty, expiredOn', async () => {
    const book = inMemoryTradeBook()
    const tradeId = await seedCsp(book)

    const expired = await new Valuations(book).expiredHoldings('2026-08-22')

    expect(expired).toEqual([
      {
        tradeId,
        legId: expect.any(String),
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: '2026-08-21',
          type: 'put',
          strike: 10000,
        },
        qty: 1,
        side: 'short',
        expiredOn: '2026-08-21',
      },
    ])
  })

  it('ignores expired Legs already closed to zero', async () => {
    const book = inMemoryTradeBook()
    const tradeId = await seedCsp(book)
    const record = await book.get(tradeId)
    await book.recordExecution(
      { tradeId, legId: record.legs[0].id },
      {
        side: 'buy',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date('2026-08-21T16:00:00').getTime(),
      },
    )

    const expired = await new Valuations(book).expiredHoldings('2026-08-22')

    expect(expired).toEqual([])
  })

  it('ignores stock Legs and unexpired contracts', async () => {
    const { book, tradeId } = await bookWithPlan() // a stock Trade
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    const stillOpenContract = inMemoryTradeBook()
    await seedCsp(stillOpenContract)

    const stockExpired = await new Valuations(book).expiredHoldings('2026-08-22')
    expect(stockExpired).toEqual([])

    // The contract has not reached its expiration date yet.
    const notYetExpired = await new Valuations(stillOpenContract).expiredHoldings('2026-08-21')
    expect(notYetExpired).toEqual([])
  })

  it('consults no Marks', async () => {
    // Constructed with no PriceBook at all — expiredHoldings must not need one.
    const book = inMemoryTradeBook()
    await seedCsp(book)

    const expired = await new Valuations(book).expiredHoldings('2026-08-22')

    expect(expired).toHaveLength(1)
  })

  // Watch item from the S3.3 review: Holding carries no legId, so the Leg lookup
  // matches by InstrumentKey. A stock Leg's key ("XYZ") and this option's key
  // ("XYZ 2026-08-21 P 100") never collide, so a Trade that also holds stock
  // (e.g. from an earlier assignment on a different contract, ADR 0002) must
  // still resolve the expired OPTION Leg correctly.
  it('resolves the option Leg correctly when the Trade also holds a stock Leg', async () => {
    const book = inMemoryTradeBook()
    const tradeId = await seedCsp(book)
    await book.recordExecution(
      { tradeId, newLeg: 'XYZ' },
      {
        side: 'buy',
        qty: 100,
        price: 10000,
        fees: 0,
        timestamp: new Date('2026-07-15T12:00:00').getTime(),
      },
    )

    const expired = await new Valuations(book).expiredHoldings('2026-08-22')

    expect(expired).toHaveLength(1)
    expect(expired[0].instrument.kind).toBe('option')
    expect(expired[0].qty).toBe(1)
  })
})

describe('Valuations.value', () => {
  it('returns the Valuation for a marked Trade (lighter list-row pair)', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook, [stop, target])
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', '2026-07-15', 16000, 'manual')

    const value = await new Valuations(tradeBook, priceBook).value(tradeId)
    expect(value.valuation?.totalPnL).toBe(99900)
  })

  it('returns a marks-missing signal when the Trade has no Mark', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook, [stop, target])
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())

    const value = await new Valuations(tradeBook, priceBook).value(tradeId)
    expect(value.marksMissing).toEqual(['AAPL'])
    expect(value.valuation).toBeUndefined()
  })
})
