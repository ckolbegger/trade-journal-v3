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

// The Daily Review agenda over Dexie + fake-indexeddb. The trader filled both
// Trades on Friday 07-10, marked AAPL on Monday 07-13, skipped Tuesday, and opens
// the review on Wednesday 07-15 — so AAPL owes Tuesday + Wednesday and the
// never-marked MSFT owes everything back to its first Execution date.

const FRIDAY = '2026-07-10'
const MONDAY = '2026-07-13'
const TUESDAY = '2026-07-14'
const WEDNESDAY = '2026-07-15'

const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date(`${FRIDAY}T12:00:00`).getTime(),
}

function draft(accountId: string, ticker: string): PlanDraft {
  return {
    accountId,
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: FRIDAY,
  }
}

async function seedSession(dbName: string): Promise<{ aapl: string; msft: string }> {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const priceBook = new PriceBook(binding)

  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const aapl = await tradeBook.confirmPlan(draft(account.id, 'AAPL'))
  await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, buy100)
  const msft = await tradeBook.confirmPlan(draft(account.id, 'MSFT'))
  await tradeBook.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, buy100)

  // AAPL was marked Monday; MSFT never was.
  await priceBook.record('AAPL', MONDAY, 16000, 'manual')

  // The MSFT plan journal was skipped — that placeholder IS the debt.
  const planType = (await journal.entryTypes.list()).find((t) => t.designatedFor === 'plan')!
  await journal.write({
    anchor: { kind: 'plan', tradeId: msft },
    entryTypeId: planType.id,
    at: new Date(`${FRIDAY}T11:00:00`).getTime(),
    answers: [],
    placeholder: true,
  })

  return { aapl, msft }
}

describe('review agenda over Dexie', () => {
  it('reopens the DB and reports each open Trade’s gap rows and the journal debt', async () => {
    const dbName = 'review-agenda-' + crypto.randomUUID()
    const { aapl, msft } = await seedSession(dbName)

    // Reopen the database fresh.
    const binding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(binding)
    const journal = new Journal(binding)
    const priceBook = new PriceBook(binding)
    const review = new Review(new Valuations(tradeBook, priceBook), journal, tradeBook)

    const agenda = await review.agenda(WEDNESDAY)

    expect(agenda.marksNeeded).toEqual([
      { tradeId: aapl, instruments: ['AAPL'], range: { from: TUESDAY, to: WEDNESDAY } },
      { tradeId: msft, instruments: ['MSFT'], range: { from: FRIDAY, to: WEDNESDAY } },
    ])
    expect(agenda.fetchRange).toEqual({ from: FRIDAY, to: WEDNESDAY })

    // The debt count matches the placeholders written.
    expect(agenda.journalDebt).toHaveLength(1)
    expect(agenda.journalDebt[0].anchor).toEqual({ kind: 'plan', tradeId: msft })
    expect(agenda.journalDebt[0].placeholder).toBe(true)

    // The skipped Tuesday is inside AAPL's gap; MSFT owes every day since its fill.
    const aaplRows = await priceBook.missingMarks(['AAPL'], agenda.marksNeeded[0].range)
    expect(aaplRows).toEqual([
      { instrument: 'AAPL', date: TUESDAY },
      { instrument: 'AAPL', date: WEDNESDAY },
    ])
    const msftRows = await priceBook.missingMarks(['MSFT'], agenda.marksNeeded[1].range)
    expect(msftRows.map((r) => r.date)).toEqual([
      FRIDAY,
      '2026-07-11',
      '2026-07-12',
      MONDAY,
      TUESDAY,
      WEDNESDAY,
    ])
  })

  it('stores nothing when the session fetches with no adapters registered', async () => {
    const dbName = 'review-fetch-' + crypto.randomUUID()
    await seedSession(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const priceBook = new PriceBook(binding)

    const report = await priceBook.fetch(['AAPL', 'MSFT'], { from: FRIDAY, to: WEDNESDAY })

    expect(report.unsupported).toEqual(['AAPL', 'MSFT'])
    expect(report.stored).toEqual([])
    // Only Monday's manual AAPL Mark exists — the fetch wrote nothing.
    const stored = await binding.list('marks')
    expect(stored).toHaveLength(1)
  })

  it('reports all-caught-up once every gap day is marked through asOf', async () => {
    const dbName = 'review-caught-up-' + crypto.randomUUID()
    const { msft } = await seedSession(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(binding)
    const journal = new Journal(binding)
    const priceBook = new PriceBook(binding)
    const review = new Review(new Valuations(tradeBook, priceBook), journal, tradeBook)

    // Wednesday's Marks land for both instruments; older gaps become interior
    // history and never nag again.
    await priceBook.record('AAPL', WEDNESDAY, 16000, 'manual')
    await priceBook.record('MSFT', WEDNESDAY, 40000, 'manual')

    const agenda = await review.agenda(WEDNESDAY)

    expect(agenda.marksNeeded).toEqual([])
    expect(agenda.fetchRange).toEqual({ from: WEDNESDAY, to: WEDNESDAY })
    // The MSFT plan journal is still owed — settlement arrives in S1.7.
    expect(agenda.journalDebt.map((e) => e.anchor)).toEqual([{ kind: 'plan', tradeId: msft }])
  })
})
