import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from './trade-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from './types'
import type { CloseReason } from '@/domain/trademath/types'

const HIT_TARGET: CloseReason = { id: 'close-hit-target', name: 'Hit Target' }
const NEVER_FILLED: CloseReason = { id: 'close-never-filled', name: 'Never Filled' }

async function bookWithPlan(): Promise<{ book: TradeBook; tradeId: string }> {
  const book = new TradeBook(new InMemoryBinding())
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await book.registries.closeReasons.save({ ...HIT_TARGET })
  await book.registries.closeReasons.save({ ...NEVER_FILLED })
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
  const tradeId = await book.confirmPlan(draft)
  return { book, tradeId }
}

function fill(overrides: Partial<ExecutionDraft> = {}): ExecutionDraft {
  return {
    side: 'buy',
    qty: 100,
    price: 15000,
    fees: 100,
    timestamp: new Date('2026-07-10T12:00:00').getTime(),
    ...overrides,
  }
}

describe('TradeBook.setCloseReason', () => {
  it('attaches a reason from the closeReasons registry to a flat Trade', async () => {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ side: 'buy' }))
    const legId = first.record.legs[0].id
    await book.recordExecution({ tradeId, legId }, fill({ side: 'sell' }))

    await book.setCloseReason(tradeId, HIT_TARGET)

    const stored = await book.get(tradeId)
    expect(stored.closeReason).toEqual(HIT_TARGET)
    expect((await book.query({ status: 'closed' })).map((t) => t.id)).toEqual([tradeId])
  })

  it("attaches a reason to a planned Trade (abandonment) making statusOf 'closed'", async () => {
    const { book, tradeId } = await bookWithPlan()

    await book.setCloseReason(tradeId, NEVER_FILLED)

    const stored = await book.get(tradeId)
    expect(stored.closeReason).toEqual(NEVER_FILLED)
    expect((await book.query({ status: 'closed' })).map((t) => t.id)).toEqual([tradeId])
    expect(await book.query({ status: 'planned' })).toEqual([])
  })

  it('rejects a reason id not in the registry', async () => {
    const { book, tradeId } = await bookWithPlan()
    await expect(
      book.setCloseReason(tradeId, { id: 'close-bogus', name: 'Bogus' }),
    ).rejects.toThrow()
  })

  it('rejects when the Trade is open (holding quantity)', async () => {
    const { book, tradeId } = await bookWithPlan()
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ side: 'buy' }))
    await expect(book.setCloseReason(tradeId, HIT_TARGET)).rejects.toThrow()
  })
})
