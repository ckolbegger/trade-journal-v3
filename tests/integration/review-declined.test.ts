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

// S1.9.T5 — a full Daily Review session over Dexie: two open Trades, one
// declined ("nothing to note today"), one carrying a written considered-action
// and Action select — round-tripped through a reopen.

const FRIDAY = '2026-07-10'
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

function books(dbName: string) {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const priceBook = new PriceBook(binding)
  const review = new Review(new Valuations(tradeBook, priceBook), journal, tradeBook)
  return { tradeBook, journal, priceBook, review }
}

async function seedSession(dbName: string): Promise<{ aapl: string; msft: string }> {
  const { tradeBook, journal, priceBook } = books(dbName)

  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const aapl = await tradeBook.confirmPlan(draft(account.id, 'AAPL'))
  await tradeBook.recordExecution({ tradeId: aapl, newLeg: 'AAPL' }, buy100)
  const msft = await tradeBook.confirmPlan(draft(account.id, 'MSFT'))
  await tradeBook.recordExecution({ tradeId: msft, newLeg: 'MSFT' }, buy100)

  await priceBook.record('AAPL', WEDNESDAY, 16000, 'manual')
  await priceBook.record('MSFT', WEDNESDAY, 32000, 'manual')

  return { aapl, msft }
}

describe('the Daily Review walk — declining and considered-actions over Dexie', () => {
  it('reopens with both Trades reviewed, one declined, the other carrying its considered-action', async () => {
    const dbName = 'review-declined-' + crypto.randomUUID()
    const { aapl, msft } = await seedSession(dbName)

    const session = books(dbName)

    // AAPL: "nothing to note today" — declined, no Action chosen.
    await session.journal.write({
      anchor: { kind: 'review', date: WEDNESDAY, tradeId: aapl },
      entryTypeId: REVIEW_ENTRY_TYPE_ID,
      at: new Date(`${WEDNESDAY}T18:00:00`).getTime(),
      answers: [],
      placeholder: false,
      declined: true,
    })

    // MSFT: a written considered-action alongside the Action select.
    await session.journal.write({
      anchor: { kind: 'review', date: WEDNESDAY, tradeId: msft },
      entryTypeId: REVIEW_ENTRY_TYPE_ID,
      at: new Date(`${WEDNESDAY}T18:05:00`).getTime(),
      answers: [
        { promptId: 'action', value: 'Hold' },
        { promptId: 'considered', value: 'Thought about adding, held off' },
      ],
      placeholder: false,
    })

    const next = books(dbName)

    const walk = await next.review.walk(WEDNESDAY)
    expect(walk.every((item) => item.reviewedToday)).toBe(true)

    const aaplEntries = await next.journal.entriesFor({ trade: aapl })
    const aaplReview = aaplEntries.find((e) => e.anchor.kind === 'review')!
    expect(aaplReview.declined).toBe(true)
    expect(aaplReview.placeholder).toBe(false)

    const msftEntries = await next.journal.entriesFor({ trade: msft })
    const msftReview = msftEntries.find((e) => e.anchor.kind === 'review')!
    expect(msftReview.declined).toBeUndefined()
    expect(msftReview.answered.find((a) => a.prompt.id === 'action')?.answer).toEqual({
      promptId: 'action',
      value: 'Hold',
    })
    expect(msftReview.answered.find((a) => a.prompt.id === 'considered')?.answer).toEqual({
      promptId: 'considered',
      value: 'Thought about adding, held off',
    })

    expect(await next.journal.outstandingDebt()).toEqual([])
  })
})
