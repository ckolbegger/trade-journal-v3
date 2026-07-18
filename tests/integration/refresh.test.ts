import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import type { DateRange, PricingSource, SourceObservation } from '@/books/pricebook/types'

// S4.3.T2 — Valuations.refresh (the Trade detail "Refresh prices" action) over
// Dexie + fake-indexeddb: a fixture adapter's today-only close lands as a Mark
// and immediately feeds Valuations.detail's numbers; a manual Mark for the same
// date is never overwritten (pricebook.md's manual-sticky rule).

const TODAY = '2026-07-20'

const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

function fixtureAdapter(close: number): PricingSource {
  return {
    id: 'fixture-source',
    supports: (instrument) => instrument === 'AAPL',
    fetch: async (instruments: string[], range: DateRange): Promise<SourceObservation[]> =>
      instruments.map((instrument) => ({ instrument, date: range.from, close })),
  }
}

async function seedTrade(dbName: string): Promise<string> {
  const binding = new DexieBinding(createDatabase(dbName))
  const book = new TradeBook(binding)
  const journal = new Journal(binding)
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  await book.recordExecution({ tradeId: id, newLeg: 'AAPL' }, buy100)
  return id
}

describe('ad-hoc refresh over Dexie (with a fixture adapter)', () => {
  it("stores today's fetched Mark and the next detail() reads it", async () => {
    const dbName = 'refresh-fetch-' + crypto.randomUUID()
    const tradeId = await seedTrade(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const priceBook = new PriceBook(binding, [fixtureAdapter(16000)])
    const valuations = new Valuations(new TradeBook(binding), priceBook)

    const report = await valuations.refresh(tradeId, TODAY)
    expect(report.stored).toEqual([
      { instrument: 'AAPL', date: TODAY, price: 16000, origin: 'fetched' },
    ])

    // Reopen fresh — detail() reads the same Mark refresh just stored.
    const reopened = new DexieBinding(createDatabase(dbName))
    const detail = await new Valuations(new TradeBook(reopened), new PriceBook(reopened)).detail(
      tradeId,
    )
    expect(detail.valuation?.unrealizedPnL).toBe(100000)
  })

  it("never overwrites today's manual Mark, and detail() keeps reading it", async () => {
    const dbName = 'refresh-manual-sticky-' + crypto.randomUUID()
    const tradeId = await seedTrade(dbName)

    const seedBinding = new DexieBinding(createDatabase(dbName))
    await new PriceBook(seedBinding).record('AAPL', TODAY, 15500, 'manual')

    const binding = new DexieBinding(createDatabase(dbName))
    const priceBook = new PriceBook(binding, [fixtureAdapter(16000)])
    const valuations = new Valuations(new TradeBook(binding), priceBook)

    const report = await valuations.refresh(tradeId, TODAY)
    expect(report.stored).toEqual([])
    expect(report.skippedManual).toEqual(['AAPL'])

    const mark = await priceBook.markSet(['AAPL'], TODAY)
    expect(mark.get('AAPL')).toEqual({
      instrument: 'AAPL',
      date: TODAY,
      price: 15500,
      origin: 'manual',
    })

    const reopened = new DexieBinding(createDatabase(dbName))
    const detail = await new Valuations(new TradeBook(reopened), new PriceBook(reopened)).detail(
      tradeId,
    )
    expect(detail.valuation?.unrealizedPnL).toBe(50000)
  })
})
