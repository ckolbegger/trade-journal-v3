import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'

// S5.1 scaling in over Dexie + fake-indexeddb: two buys on the same Leg,
// reopen the DB, and confirm position 200, average cost 155.00, and both
// fills intact (docs/plan/slice-05-scaling.md worked example).

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

describe('scaling in over Dexie', () => {
  it('reopens the DB with position 200, average cost 155.00, and both fills intact', async () => {
    const dbName = 'scale-in-' + crypto.randomUUID()
    const { book, tradeId } = await bookWithPlan(dbName)
    const first = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buyLotA)
    await book.recordExecution({ tradeId, legId: first.record.legs[0].id }, buyLotB)
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      'AAPL',
      '2026-07-15',
      16500,
      'manual',
    )

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const valuations = new Valuations(
      reopened,
      new PriceBook(new DexieBinding(createDatabase(dbName))),
    )

    const position = await valuations.position(tradeId)
    expect(position.holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 200, side: 'long' },
    ])

    const value = await valuations.value(tradeId)
    expect(value.valuation?.perLeg[0].basis).toBe(3100000) // 31000.00
    expect(value.valuation?.perLeg[0].avgCost).toBe(15500) // average cost 155.00
    expect(value.valuation?.fees).toBe(200)
    expect(value.valuation?.unrealizedPnL).toBe(200000) // 2000.00 at mark 165

    const restored = await reopened.get(tradeId)
    expect(restored.legs).toHaveLength(1)
    expect(restored.legs[0].executions).toEqual([
      { ...buyLotA, kind: 'fill' },
      { ...buyLotB, kind: 'fill' },
    ])
  })
})
