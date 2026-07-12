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
      { tradeId: aapl, instruments: ['AAPL'], range: { from: tuesday, to: wednesday } },
    ])
  })

  it("starts a never-marked instrument at its Trade's first Execution date", async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook)
    // The fill is Friday 2026-07-10 — the Trade has needed a Mark since that day.
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade).toEqual([
      { tradeId, instruments: ['AAPL'], range: { from: '2026-07-10', to: wednesday } },
    ])
  })

  it('starts a marked instrument the day after its last Mark', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', tuesday, 16100, 'manual')

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    expect(needed.perTrade[0].range).toEqual({ from: wednesday, to: wednesday })
  })

  it('includes skipped days (Monday-marked instrument on Wednesday needs Tue+Wed)', async () => {
    const { tradeBook, priceBook } = books()
    const tradeId = await seedPlan(tradeBook)
    await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', monday, 16000, 'manual')

    const needed = await new Valuations(tradeBook, priceBook).marksNeeded(wednesday)

    // The skipped Tuesday is inside the gap by construction — nobody was asked.
    const missing = await priceBook.missingMarks(
      needed.perTrade[0].instruments,
      needed.perTrade[0].range,
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
