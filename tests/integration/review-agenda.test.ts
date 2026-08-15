import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace, REVIEW_ENTRY_TYPE_ID } from '@/workspace/workspace'
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
      { tradeId: aapl, needs: [{ instrument: 'AAPL', range: { from: TUESDAY, to: WEDNESDAY } }] },
      { tradeId: msft, needs: [{ instrument: 'MSFT', range: { from: FRIDAY, to: WEDNESDAY } }] },
    ])
    expect(agenda.fetchRange).toEqual({ from: FRIDAY, to: WEDNESDAY })

    // The debt count matches the placeholders written.
    expect(agenda.journalDebt).toHaveLength(1)
    expect(agenda.journalDebt[0].anchor).toEqual({ kind: 'plan', tradeId: msft })
    expect(agenda.journalDebt[0].placeholder).toBe(true)

    // The skipped Tuesday is inside AAPL's gap; MSFT owes every day since its fill.
    const aaplRows = await priceBook.missingMarks(['AAPL'], agenda.marksNeeded[0].needs[0].range)
    expect(aaplRows).toEqual([
      { instrument: 'AAPL', date: TUESDAY },
      { instrument: 'AAPL', date: WEDNESDAY },
    ])
    // 2026-07-11 and 2026-07-12 are a Saturday and Sunday — weekend-quiet (S4.4)
    // excludes them even though MSFT's range spans them.
    const msftRows = await priceBook.missingMarks(['MSFT'], agenda.marksNeeded[1].needs[0].range)
    expect(msftRows.map((r) => r.date)).toEqual([FRIDAY, MONDAY, TUESDAY, WEDNESDAY])
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

// S4.4.T3 — the weekend-quiet ruling over Dexie: a Friday Mark followed by a
// Monday review needs Monday only, in both the agenda's collection path and the
// walk. The unit-level equivalent (Valuations.marksNeeded (weekend-quiet)) fixes
// the same worked example; this proves it survives Dexie's round trip end to end.
describe('review agenda over Dexie (weekend-quiet, S4.4)', () => {
  it('a Friday Mark and a Monday review need Monday only — no weekend rows in the agenda or the walk', async () => {
    const dbName = 'review-weekend-quiet-' + crypto.randomUUID()
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
    await priceBook.record('AAPL', FRIDAY, 16000, 'manual')

    // Reopen the database fresh, as the trader would on Monday.
    const session = {
      tradeBook: new TradeBook(binding),
      journal: new Journal(binding),
      priceBook: new PriceBook(binding),
    }
    const review = new Review(
      new Valuations(session.tradeBook, session.priceBook),
      session.journal,
      session.tradeBook,
    )

    const agenda = await review.agenda(MONDAY)
    // The range's `from` lands on Saturday (the day after Friday's Mark) — that's
    // structural bookkeeping, not a prompt (docs/plan/slice-04-automated-pricing.md).
    expect(agenda.marksNeeded).toEqual([
      { tradeId: aapl, needs: [{ instrument: 'AAPL', range: { from: '2026-07-11', to: MONDAY } }] },
    ])

    const missing = await session.priceBook.missingMarks(
      ['AAPL'],
      agenda.marksNeeded[0].needs[0].range,
    )
    expect(missing).toEqual([{ instrument: 'AAPL', date: MONDAY }])

    const walk = await review.walk(MONDAY)
    expect(walk).toEqual([{ tradeId: aapl, reviewedToday: false, outstandingDebt: 0 }])

    // Fill Monday's Mark and record the Action — the only checkpoint work owed.
    await session.priceBook.record('AAPL', MONDAY, 16500, 'manual')
    await session.journal.write({
      anchor: { kind: 'review', date: MONDAY, tradeId: aapl },
      entryTypeId: REVIEW_ENTRY_TYPE_ID,
      at: new Date(`${MONDAY}T18:00:00`).getTime(),
      answers: [
        { promptId: 'action', value: 'Hold' },
        { promptId: 'conviction', value: 4 },
      ],
      placeholder: false,
    })

    const walkAgain = await review.walk(MONDAY)
    expect(walkAgain).toEqual([{ tradeId: aapl, reviewedToday: true, outstandingDebt: 0 }])
    // Caught up: nothing left to collect, and Saturday/Sunday never appear.
    const after = await review.agenda(MONDAY)
    expect(after.marksNeeded).toEqual([])
  })
})

// S4.4.T3 — the no-source notice's data source (`Settings.pricingSources`) round-
// trips through Dexie. The notice's rendering is unit-tested at the ReviewPage
// seam (ReviewPage.test.tsx's "ReviewCollection (no source)" describe, over the
// in-memory binding); duplicating that render assertion here over Dexie would
// only prove Dexie can store an array, which dexie-binding.test.ts already
// covers generically — so this confirms the one thing that IS new: the specific
// empty/populated shapes the notice branches on survive a reopen.
describe('pricingSources settings over Dexie (S4.4 no-source notice)', () => {
  it('defaults to empty (no source configured) and round-trips an enabled source after reopen', async () => {
    const dbName = 'review-no-source-' + crypto.randomUUID()
    const binding = new DexieBinding(createDatabase(dbName))
    const workspace = new Workspace(new TradeBook(binding), new Journal(binding), binding)

    expect(await workspace.settings.get('pricingSources')).toEqual([])

    await workspace.settings.set('pricingSources', [{ id: 'marketdata.app', enabled: true }])

    const reopenedBinding = new DexieBinding(createDatabase(dbName))
    const reopened = new Workspace(
      new TradeBook(reopenedBinding),
      new Journal(reopenedBinding),
      reopenedBinding,
    )
    expect(await reopened.settings.get('pricingSources')).toEqual([
      { id: 'marketdata.app', enabled: true },
    ])
  })
})
