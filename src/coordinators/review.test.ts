import { describe, it, expect } from 'vitest'
import type { TradeBook } from '@/books/tradebook/trade-book'
import type { Journal } from '@/books/journal/journal'
import type { PriceBook } from '@/books/pricebook/price-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'
import type { EntryType } from '@/books/journal/types'
import { inMemoryBooks } from '../../tests/support/trade-book'
import { Valuations } from './valuations'
import { Review } from './review'

// The Daily Review scenario: fills landed Friday 07-10, the trader marked Monday
// 07-13, skipped Tuesday, and opens the review on Wednesday 07-15.
const MONDAY = '2026-07-13'
const TUESDAY = '2026-07-14'
const WEDNESDAY = '2026-07-15'

const PLAN_TYPE: EntryType = {
  id: 'plan-type',
  name: 'Plan',
  designatedFor: 'plan',
  prompts: [{ id: 'why', text: 'Why this trade, why now?', kind: 'text' }],
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

async function workspace(): Promise<{
  tradeBook: TradeBook
  journal: Journal
  priceBook: PriceBook
  review: Review
  accountId: string
}> {
  const { tradeBook, journal, priceBook } = inMemoryBooks()
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await journal.entryTypes.save({ ...PLAN_TYPE })
  await journal.entryTypes.save({ ...REVIEW_TYPE })
  const review = new Review(new Valuations(tradeBook, priceBook), journal, tradeBook)
  return { tradeBook, journal, priceBook, review, accountId: account.id }
}

function draft(accountId: string, ticker: string): PlanDraft {
  return {
    accountId,
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
}

const REVIEW_TYPE: EntryType = {
  id: 'review-type',
  name: 'Trade Review',
  designatedFor: 'review',
  prompts: [
    {
      id: 'action',
      text: 'What will you do with this Trade?',
      kind: 'select',
      options: ['Hold', 'Exit Soon', 'Adjust', 'Watch Closely'],
    },
  ],
}

// Reviewing a Trade IS recording its Action — the review-anchored entry for the
// date is the only "reviewed" state there is (docs/design/review.md).
async function recordAction(
  journal: Journal,
  tradeId: string,
  date: string,
  action: string,
): Promise<void> {
  await journal.write({
    anchor: { kind: 'review', date, tradeId },
    entryTypeId: REVIEW_TYPE.id,
    at: new Date(`${date}T18:00:00`).getTime(),
    answers: [{ promptId: 'action', value: action }],
    placeholder: false,
  })
}

describe('Review.agenda', () => {
  it('bundles marks needed per Trade, the fetch range, and journal debt', async () => {
    const { tradeBook, journal, priceBook, review, accountId } = await workspace()

    // AAPL: marked Monday, so it needs Tuesday + Wednesday.
    const aapl = await tradeBook.confirmPlan(draft(accountId, 'AAPL'))
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())
    await priceBook.record('AAPL', MONDAY, 16000, 'manual')

    // MSFT: never marked, so it needs Marks from its first Execution date.
    const msft = await tradeBook.confirmPlan(draft(accountId, 'MSFT'))
    await tradeBook.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, fill())

    // One skipped Plan journal — that IS the debt.
    const owed = await journal.write({
      anchor: { kind: 'plan', tradeId: msft },
      entryTypeId: PLAN_TYPE.id,
      at: new Date('2026-07-10T11:00:00').getTime(),
      answers: [],
      placeholder: true,
    })

    const agenda = await review.agenda(WEDNESDAY)

    expect(agenda.marksNeeded).toEqual([
      { tradeId: aapl, instruments: ['AAPL'], range: { from: TUESDAY, to: WEDNESDAY } },
      { tradeId: msft, instruments: ['MSFT'], range: { from: '2026-07-10', to: WEDNESDAY } },
    ])
    expect(agenda.fetchRange).toEqual({ from: '2026-07-10', to: WEDNESDAY })
    expect(agenda.journalDebt.map((e) => e.id)).toEqual([owed])
  })

  it('is empty-agenda when no open Trades and no debt exist', async () => {
    const { review } = await workspace()

    const agenda = await review.agenda(WEDNESDAY)

    expect(agenda.marksNeeded).toEqual([])
    expect(agenda.journalDebt).toEqual([])
    expect(agenda.fetchRange).toEqual({ from: WEDNESDAY, to: WEDNESDAY })
  })

  it('stores nothing — a second agenda for the same day reports the same thing', async () => {
    const { tradeBook, review, accountId } = await workspace()
    const aapl = await tradeBook.confirmPlan(draft(accountId, 'AAPL'))
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())

    const first = await review.agenda(WEDNESDAY)
    const second = await review.agenda(WEDNESDAY)

    expect(second).toEqual(first)
  })
})

describe('Review.walk', () => {
  it('lists open Trades in insertion order', async () => {
    const { tradeBook, review, accountId } = await workspace()
    const aapl = await tradeBook.confirmPlan(draft(accountId, 'AAPL'))
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())
    const msft = await tradeBook.confirmPlan(draft(accountId, 'MSFT'))
    await tradeBook.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, fill())

    const items = await review.walk(WEDNESDAY)

    expect(items.map((i) => i.tradeId)).toEqual([aapl, msft])
  })

  it('flags reviewedToday when a review entry exists for that date', async () => {
    const { tradeBook, journal, review, accountId } = await workspace()
    const aapl = await tradeBook.confirmPlan(draft(accountId, 'AAPL'))
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())
    const msft = await tradeBook.confirmPlan(draft(accountId, 'MSFT'))
    await tradeBook.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, fill())

    await recordAction(journal, aapl, WEDNESDAY, 'Hold')

    const items = await review.walk(WEDNESDAY)

    expect(items.find((i) => i.tradeId === aapl)?.reviewedToday).toBe(true)
    expect(items.find((i) => i.tradeId === msft)?.reviewedToday).toBe(false)
  })

  it('leaves reviewedToday false for entries from other dates', async () => {
    const { tradeBook, journal, review, accountId } = await workspace()
    const aapl = await tradeBook.confirmPlan(draft(accountId, 'AAPL'))
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())

    // Reviewed Monday, not since — Wednesday's walk still owes an Action.
    await recordAction(journal, aapl, MONDAY, 'Hold')

    const items = await review.walk(WEDNESDAY)

    expect(items.map((i) => i.reviewedToday)).toEqual([false])
  })

  it("carries each Trade's unsettled-placeholder count", async () => {
    const { tradeBook, journal, review, accountId } = await workspace()
    const aapl = await tradeBook.confirmPlan(draft(accountId, 'AAPL'))
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())
    const msft = await tradeBook.confirmPlan(draft(accountId, 'MSFT'))
    await tradeBook.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, fill())

    const owed = await journal.write({
      anchor: { kind: 'plan', tradeId: aapl },
      entryTypeId: PLAN_TYPE.id,
      at: new Date('2026-07-10T11:00:00').getTime(),
      answers: [],
      placeholder: true,
    })
    const settled = await journal.write({
      anchor: { kind: 'plan', tradeId: msft },
      entryTypeId: PLAN_TYPE.id,
      at: new Date('2026-07-10T11:00:00').getTime(),
      answers: [],
      placeholder: true,
    })
    await journal.settle(settled, [{ promptId: 'why', value: 'settled last night' }])
    expect(owed).not.toBe(settled)

    const items = await review.walk(WEDNESDAY)

    expect(items.find((i) => i.tradeId === aapl)?.outstandingDebt).toBe(1)
    expect(items.find((i) => i.tradeId === msft)?.outstandingDebt).toBe(0)
  })

  it('excludes planned and closed Trades', async () => {
    const { tradeBook, review, accountId } = await workspace()
    // Planned: never filled.
    await tradeBook.confirmPlan(draft(accountId, 'NVDA'))
    // Closed: filled, then flattened by a sell on the same Leg.
    const tsla = await tradeBook.confirmPlan(draft(accountId, 'TSLA'))
    const opened = await tradeBook.recordExecution({ tradeId: tsla, newLeg: 'TSLA' }, fill())
    await tradeBook.recordExecution(
      { tradeId: tsla, legId: opened.record.legs[0].id },
      { ...fill(), side: 'sell', timestamp: new Date('2026-07-13T12:00:00').getTime() },
    )
    // Open.
    const aapl = await tradeBook.confirmPlan(draft(accountId, 'AAPL'))
    await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, fill())

    const items = await review.walk(WEDNESDAY)

    expect(items.map((i) => i.tradeId)).toEqual([aapl])
  })
})
