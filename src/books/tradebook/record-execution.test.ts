import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from './trade-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from './types'

async function bookWithPlan(): Promise<{ book: TradeBook; tradeId: string }> {
  const book = new TradeBook(new InMemoryBinding())
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

describe('TradeBook.recordExecution', () => {
  it('appends an Execution to a new Leg on first fill', async () => {
    const { book, tradeId } = await bookWithPlan()
    const outcome = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    expect(outcome.record.legs).toHaveLength(1)
    const leg = outcome.record.legs[0]
    expect(leg.instrument).toEqual({ kind: 'stock', ticker: 'AAPL' })
    expect(leg.executions).toHaveLength(1)
    expect(leg.executions[0]).toMatchObject({ side: 'buy', qty: 100, price: 15000, fees: 100 })
    const stored = await book.get(tradeId)
    expect(stored.legs[0].executions).toHaveLength(1)
  })

  it('appends the closing fill to the existing Leg of the same instrument', async () => {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    const legId = first.record.legs[0].id
    const outcome = await book.recordExecution({ tradeId, legId }, fill({ side: 'sell', qty: 100 }))
    expect(outcome.record.legs).toHaveLength(1)
    expect(outcome.record.legs[0].executions).toHaveLength(2)
    expect(outcome.record.legs[0].executions[1]).toMatchObject({ side: 'sell', qty: 100 })
  })

  it('rejects a target Trade that does not exist', async () => {
    const { book } = await bookWithPlan()
    await expect(
      book.recordExecution({ tradeId: 'nope', newLeg: 'AAPL' }, fill()),
    ).rejects.toThrow()
  })

  it('rejects zero or negative qty and negative price or fees', async () => {
    const { book, tradeId } = await bookWithPlan()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ qty: 0 })),
    ).rejects.toThrow()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ qty: -5 })),
    ).rejects.toThrow()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ price: -1 })),
    ).rejects.toThrow()
    await expect(
      book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ fees: -1 })),
    ).rejects.toThrow()
  })

  it('returns nowFlat=false while quantity remains', async () => {
    const { book, tradeId } = await bookWithPlan()
    const outcome = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    expect(outcome.nowFlat).toBe(false)
  })

  it('returns nowFlat=true when the Execution nets the Trade to zero', async () => {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution(
      { tradeId, newLeg: 'AAPL' },
      fill({ side: 'buy', qty: 100 }),
    )
    const legId = first.record.legs[0].id
    const outcome = await book.recordExecution({ tradeId, legId }, fill({ side: 'sell', qty: 100 }))
    expect(outcome.nowFlat).toBe(true)
  })

  it('derives status open after the first fill (statusOf, never stored)', async () => {
    const { book, tradeId } = await bookWithPlan()
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill({ side: 'buy', qty: 100 }))
    expect((await book.query({ status: 'open' })).map((t) => t.id)).toEqual([tradeId])
    expect(await book.query({ status: 'planned' })).toEqual([])
  })

  it('always returns an empty newDeviations (detection arrives in Slice 9)', async () => {
    const { book, tradeId } = await bookWithPlan()
    const outcome = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, fill())
    expect(outcome.newDeviations).toEqual([])
  })
})
