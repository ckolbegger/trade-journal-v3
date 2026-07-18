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

// S5.2 partial close with FIFO over Dexie + fake-indexeddb: the full worked
// example (docs/plan/slice-05-scaling.md) — two buys, a partial sell of 120
// (realizes 1597.00, leaves 80 shares basis 12800.00), a reopen mid-sequence,
// a Daily Review walk that values the 80-share remainder, then the final sell
// of 80 (adds 799.00, totaling 2396.00, Trade flat).

const buyLotA: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const buyLotB: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 16000,
  fees: 100,
  timestamp: new Date('2026-07-12T12:00:00').getTime(),
}
const sell120: ExecutionDraft = {
  side: 'sell',
  qty: 120,
  price: 16500,
  fees: 100,
  timestamp: new Date('2026-07-15T12:00:00').getTime(),
}
const sell80Final: ExecutionDraft = {
  side: 'sell',
  qty: 80,
  price: 17000,
  fees: 100,
  timestamp: new Date('2026-07-20T12:00:00').getTime(),
}

function books(dbName: string) {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const priceBook = new PriceBook(binding)
  const valuations = new Valuations(tradeBook, priceBook)
  const review = new Review(valuations, journal, tradeBook)
  return { tradeBook, journal, priceBook, valuations, review }
}

async function bookWithPlan(dbName: string): Promise<{ tradeBook: TradeBook; tradeId: string }> {
  const { tradeBook, journal } = books(dbName)
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  return { tradeBook, tradeId }
}

describe('scaling out over Dexie (FIFO partial close)', () => {
  it('reopens mid-sequence, values the remainder in a review walk, and finishes at 2396.00 total', async () => {
    const dbName = 'scale-out-' + crypto.randomUUID()
    const { tradeBook, tradeId } = await bookWithPlan(dbName)
    const first = await tradeBook.recordExecution({ tradeId, newLeg: 'AAPL' }, buyLotA)
    const legId = first.record.legs[0].id
    await tradeBook.recordExecution({ tradeId, legId }, buyLotB)

    const partial = await tradeBook.recordExecution({ tradeId, legId }, sell120)
    expect(partial.nowFlat).toBe(false)

    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      'AAPL',
      '2026-07-15',
      16500,
      'manual',
    )

    // ——— reopen mid-sequence ———
    const reopened = books(dbName)

    const afterPartial = await reopened.valuations.value(tradeId)
    expect(afterPartial.valuation?.realizedPnL).toBe(159700) // 1597.00
    expect(afterPartial.valuation?.perLeg[0].basis).toBe(1280000) // 12800.00 over 80
    expect(afterPartial.valuation?.unrealizedPnL).toBe(40000) // 400.00

    const position = await reopened.valuations.position(tradeId)
    expect(position.holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 80, side: 'long' },
    ])

    // A Daily Review walk between the sells: the Trade is still open (a
    // partial close never prompts a Close Reason) and its remainder values
    // correctly from the SAME reopened session.
    const walk = await reopened.review.walk('2026-07-15')
    expect(walk.map((i) => i.tradeId)).toEqual([tradeId])
    const detail = await reopened.valuations.detail(tradeId)
    expect(detail.valuation?.realizedPnL).toBe(159700)
    expect(detail.valuation?.unrealizedPnL).toBe(40000)
    expect(detail.position.holdings[0].qty).toBe(80)

    // ——— the final sell, flattening the Trade ———
    const final = await reopened.tradeBook.recordExecution({ tradeId, legId }, sell80Final)
    expect(final.nowFlat).toBe(true)

    // ——— reopen once more: every number reproduces from the Executions alone ———
    const last = books(dbName)
    const finalValue = await last.valuations.value(tradeId)
    expect(finalValue.valuation?.realizedPnL).toBe(239600) // 2396.00 total

    const restored = await last.tradeBook.get(tradeId)
    expect(restored.legs[0].executions).toEqual([
      { ...buyLotA, kind: 'fill' },
      { ...buyLotB, kind: 'fill' },
      { ...sell120, kind: 'fill' },
      { ...sell80Final, kind: 'fill' },
    ])
    // statusOf derives 'closed' from every Leg netting to zero — no Close
    // Reason needed for that derivation (ADR 0005); the Trade just awaits one.
    expect((await last.tradeBook.query({ status: 'closed' })).map((t) => t.id)).toEqual([tradeId])
    expect(await last.tradeBook.query({ status: 'open' })).toEqual([])
  })
})
