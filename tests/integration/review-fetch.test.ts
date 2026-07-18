import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import { Review } from '@/coordinators/review'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import type { DateRange, PricingSource, SourceObservation } from '@/books/pricebook/types'

// S4.2.T3 — PriceBook.fetch's real orchestration (manual-sticky, priority
// routing, missingMarks-as-remainder) over Dexie + fake-indexeddb. Two Trades: a
// stock (AAPL) and an option contract on the same underlying. A fake adapter
// covers only the stock ticker — never the contract — so the review's one bulk
// fetch resolves the shared AAPL underlying for BOTH Trades (the option Trade's
// own gap includes its underlying, per heldInstrumentsOf) while the contract
// itself stays manual.

const FRIDAY = '2026-07-10'
const MONDAY = '2026-07-13'
const TUESDAY = '2026-07-14'
const WEDNESDAY = '2026-07-15'
const THURSDAY = '2026-07-16'
const CONTRACT = 'AAPL 2027-06-18 C 200'

const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date(`${FRIDAY}T12:00:00`).getTime(),
}

function stockDraft(accountId: string): PlanDraft {
  return {
    accountId,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: FRIDAY,
  }
}

function optionDraft(accountId: string): PlanDraft {
  return {
    accountId,
    thesis: 'AAPL call',
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
    plannedAt: FRIDAY,
  }
}

// Covers only the stock ticker — the option contract is never supported, so it
// stays a manual row regardless of what the adapter returns.
function stockOnlyAdapter(): PricingSource {
  return {
    id: 'fixture-source',
    supports: (instrument) => instrument === 'AAPL',
    fetch: async (_instruments: string[], _range: DateRange): Promise<SourceObservation[]> => [
      // Monday collides with the manual Mark recorded earlier — must be skipped.
      { instrument: 'AAPL', date: MONDAY, close: 16050 },
      { instrument: 'AAPL', date: TUESDAY, close: 16100 },
      { instrument: 'AAPL', date: WEDNESDAY, close: 16200 },
      { instrument: 'AAPL', date: THURSDAY, close: 16300 },
    ],
  }
}

async function seedSession(dbName: string): Promise<{ stock: string; option: string }> {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const priceBook = new PriceBook(binding)

  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const stock = await tradeBook.confirmPlan(stockDraft(account.id))
  await tradeBook.recordExecution({ tradeId: stock, newLeg: 'AAPL' }, buy100)
  const option = await tradeBook.confirmPlan(optionDraft(account.id))
  await tradeBook.recordExecution(
    { tradeId: option, newLeg: CONTRACT },
    { side: 'buy', qty: 1, price: 1200, fees: 65, timestamp: buy100.timestamp },
  )

  // The trader manually marked AAPL Monday, before the source was ever enabled.
  await priceBook.record('AAPL', MONDAY, 16000, 'manual')

  return { stock, option }
}

describe('review fetch over Dexie (with an adapter)', () => {
  it('backfills the shared underlying for both Trades, leaves the contract manual, and never overwrites the earlier manual Mark', async () => {
    const dbName = 'review-fetch-adapter-' + crypto.randomUUID()
    const { stock, option } = await seedSession(dbName)

    // Reopen the database fresh, this time with the adapter registered — the
    // trader enabled a pricing source since the manual Mark was typed.
    const binding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(binding)
    const journal = new Journal(binding)
    const priceBook = new PriceBook(binding, [stockOnlyAdapter()])
    const review = new Review(new Valuations(tradeBook, priceBook), journal, tradeBook)

    const agenda = await review.agenda(THURSDAY)
    const instruments = [
      ...new Set(agenda.marksNeeded.flatMap((item) => item.needs.map((n) => n.instrument))),
    ]
    const report = await priceBook.fetch(instruments, agenda.fetchRange)

    // Three-day gap (Tue/Wed/Thu) stored as fetched Marks — Monday was skipped.
    expect(report.stored).toEqual([
      { instrument: 'AAPL', date: TUESDAY, price: 16100, origin: 'fetched' },
      { instrument: 'AAPL', date: WEDNESDAY, price: 16200, origin: 'fetched' },
      { instrument: 'AAPL', date: THURSDAY, price: 16300, origin: 'fetched' },
    ])
    expect(report.skippedManual).toEqual(['AAPL'])
    expect(report.unsupported).toEqual([CONTRACT])

    // The manual Monday Mark survives the re-fetch untouched.
    const monday = await priceBook.markSet(['AAPL'], MONDAY)
    expect(monday.get('AAPL')).toEqual({
      instrument: 'AAPL',
      date: MONDAY,
      price: 16000,
      origin: 'manual',
    })

    // The stock Trade's own gap is fully resolved.
    const stockNeeds = agenda.marksNeeded.find((m) => m.tradeId === stock)!.needs
    const stockMissing = (
      await Promise.all(stockNeeds.map((n) => priceBook.missingMarks([n.instrument], n.range)))
    ).flat()
    expect(stockMissing).toEqual([])

    // The option Trade's remaining rows are the contract only — its shared
    // underlying gap was resolved by the same fetch.
    const optionNeeds = agenda.marksNeeded.find((m) => m.tradeId === option)!.needs
    const optionMissing = (
      await Promise.all(optionNeeds.map((n) => priceBook.missingMarks([n.instrument], n.range)))
    ).flat()
    expect(optionMissing.every((row) => row.instrument === CONTRACT)).toBe(true)
    expect(optionMissing.length).toBeGreaterThan(0)
  })
})
