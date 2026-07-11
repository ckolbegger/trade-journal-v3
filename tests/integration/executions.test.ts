import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'

async function bookWithPlan(dbName: string): Promise<{ book: TradeBook; tradeId: string }> {
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
  const tradeId = await book.confirmPlan(draft)
  return { book, tradeId }
}

const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

describe('executions over Dexie', () => {
  it('reopens the DB with position +100, status open, and execution history intact', async () => {
    const dbName = 'executions-' + crypto.randomUUID()
    const { book, tradeId } = await bookWithPlan(dbName)
    await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buy100)

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const valuations = new Valuations(reopened)

    const position = await valuations.position(tradeId)
    expect(position.holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100, side: 'long' },
    ])

    const open = await reopened.query({ status: 'open' })
    expect(open.map((t) => t.id)).toEqual([tradeId])

    const restored = await reopened.get(tradeId)
    expect(restored.legs).toHaveLength(1)
    expect(restored.legs[0].instrument).toEqual({ kind: 'stock', ticker: 'AAPL' })
    expect(restored.legs[0].executions).toEqual([buy100])
  })
})
