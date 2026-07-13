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

// A cash-secured put whose put expired yesterday, over Dexie + fake-indexeddb
// (docs/plan/slice-03-single-leg-options.md, S3.3): the agenda surfaces it,
// recording it worthless goes through the ordinary Execution path, flattens
// the Trade, realizes the full credit, and the next agenda is clean.

const EXPIRATION = '2026-08-21'
const REVIEW_DAY = '2026-08-22' // the Saturday after expiration
const CONTRACT = `XYZ ${EXPIRATION} P 100`

const sellToOpen: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 250,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

async function seedExpiredCsp(dbName: string): Promise<{ tradeId: string; accountId: string }> {
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
    thesis: 'XYZ range-bound',
    strategyId: 'strategy-cash-secured-put',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'sell',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: EXPIRATION,
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
  await book.recordExecution({ tradeId, newLeg: CONTRACT }, sellToOpen)
  return { tradeId, accountId: account.id }
}

describe('expired CSP over Dexie', () => {
  it('surfaces on the agenda, records worthless, flattens with full credit, and cleans the next agenda', async () => {
    const dbName = 'expiration-' + crypto.randomUUID()
    const { tradeId } = await seedExpiredCsp(dbName)

    // Reopen the database fresh — the review agenda runs against a new session.
    const reviewBinding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(reviewBinding)
    const journal = new Journal(reviewBinding)
    const priceBook = new PriceBook(reviewBinding)
    const valuations = new Valuations(tradeBook, priceBook)
    const review = new Review(valuations, journal, tradeBook)

    const agenda = await review.agenda(REVIEW_DAY)
    expect(agenda.expiredLegs).toEqual([
      {
        tradeId,
        legId: expect.any(String),
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: EXPIRATION,
          type: 'put',
          strike: 10000,
        },
        qty: 1,
        side: 'short',
        expiredOn: EXPIRATION,
      },
    ])

    const [expired] = agenda.expiredLegs
    const outcome = await tradeBook.recordExecution(
      { tradeId: expired.tradeId, legId: expired.legId },
      {
        side: 'buy',
        qty: expired.qty,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date(`${EXPIRATION}T16:00:00`).getTime(),
      },
    )
    expect(outcome.nowFlat).toBe(true)

    await tradeBook.setCloseReason(tradeId, { id: 'close-reason-hit-target', name: 'Hit Target' })

    // Reopen once more — everything must be reproducible from stored facts.
    const finalBinding = new DexieBinding(createDatabase(dbName))
    const finalTradeBook = new TradeBook(finalBinding)
    const finalValuations = new Valuations(finalTradeBook, new PriceBook(finalBinding))
    const finalReview = new Review(finalValuations, new Journal(finalBinding), finalTradeBook)

    const closed = await finalTradeBook.get(tradeId)
    expect(closed.closeReason?.name).toBe('Hit Target')

    const value = await finalValuations.value(tradeId)
    expect(value.valuation?.realizedPnL).toBe(24935) // 250.00 credit − 0.65 fees
    expect(value.valuation?.totalPnL).toBe(24935)

    // The agenda is clean next run — no outcome left to record.
    const nextAgenda = await finalReview.agenda(REVIEW_DAY)
    expect(nextAgenda.expiredLegs).toEqual([])
  })
})
