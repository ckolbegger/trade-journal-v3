import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import type {
  Account,
  ExecutionDraft,
  ExitLevel,
  Institution,
  PlanDraft,
} from '@/books/tradebook/types'

// The worked example over Dexie + fake-indexeddb (cents): buy 100 AAPL @ 150.00
// fees 1.00, stop 140.00, target 170.00, Mark today 160.00.

const stop: ExitLevel = {
  scope: { level: 'trade' },
  side: 'stop',
  kind: 'underlyingPrice',
  price: 14000,
}
const target: ExitLevel = {
  scope: { level: 'trade' },
  side: 'target',
  kind: 'underlyingPrice',
  price: 17000,
}
const buy100: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

async function seedTrade(dbName: string, ticker = 'AAPL'): Promise<string> {
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
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [stop, target],
    plannedAt: '2026-07-10',
  }
  const id = await book.confirmPlan(draft)
  await book.recordExecution({ tradeId: id, newLeg: ticker }, buy100)
  return id
}

describe('valuation over Dexie', () => {
  it('reopens the DB and reproduces every worked-example number from detail', async () => {
    const dbName = 'valuation-' + crypto.randomUUID()
    const tradeId = await seedTrade(dbName)
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      'AAPL',
      '2026-07-15',
      16000,
      'manual',
    )

    // Reopen the database fresh.
    const binding = new DexieBinding(createDatabase(dbName))
    const valuations = new Valuations(new TradeBook(binding), new PriceBook(binding))
    const detail = await valuations.detail(tradeId)

    expect(detail.valuation).toMatchObject({
      currentValue: 1600000,
      unrealizedPnL: 100000,
      fees: 100,
      totalPnL: 99900,
    })
    expect(detail.riskReward).toMatchObject({
      plannedRisk: 200000,
      worstCaseRisk: 1600000,
      plannedReward: 100000,
      maxReward: 'unlimited',
      original: { risk: 100000, reward: 200000 },
    })
    expect(detail.position.holdings).toEqual([
      { instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100, side: 'long' },
    ])
  })

  it('re-records the Mark and reports the prior Mark in overwrote', async () => {
    const dbName = 'valuation-overwrite-' + crypto.randomUUID()
    await seedTrade(dbName)
    const priceBook = new PriceBook(new DexieBinding(createDatabase(dbName)))
    await priceBook.record('AAPL', '2026-07-15', 16000, 'manual')

    const reopened = new PriceBook(new DexieBinding(createDatabase(dbName)))
    const result = await reopened.record('AAPL', '2026-07-15', 16100, 'manual')

    expect(result.overwrote).toEqual({
      instrument: 'AAPL',
      date: '2026-07-15',
      price: 16000,
      origin: 'manual',
    })
  })

  it('shares one stored Mark across two Trades holding the same instrument', async () => {
    const dbName = 'valuation-shared-' + crypto.randomUUID()
    const binding = new DexieBinding(createDatabase(dbName))
    const book = new TradeBook(binding)
    const journal = new Journal(binding)
    const priceBook = new PriceBook(binding)
    const institution = { id: '', name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
    await book.registries.accounts.save(account)
    await new Workspace(book, journal).ensureSeeded()
    const mkDraft = (): PlanDraft => ({
      accountId: account.id,
      thesis: 'AAPL breaks out',
      strategyId: 'strategy-long-stock',
      ideaSourceId: '',
      plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
      exitLevels: [stop, target],
      plannedAt: '2026-07-10',
    })
    const a = await book.confirmPlan(mkDraft())
    const b = await book.confirmPlan(mkDraft())
    await book.recordExecution({ tradeId: a, newLeg: 'AAPL' }, buy100)
    await book.recordExecution({ tradeId: b, newLeg: 'AAPL' }, buy100)

    await priceBook.record('AAPL', '2026-07-15', 16000, 'manual')

    // Both Trades see the same Mark — stored exactly once.
    const stored = await binding.where('marks', 'instrument', 'AAPL')
    expect(stored).toHaveLength(1)

    const valuations = new Valuations(book, priceBook)
    const detailA = await valuations.detail(a)
    const detailB = await valuations.detail(b)
    expect(detailA.valuation?.currentValue).toBe(1600000)
    expect(detailB.valuation?.currentValue).toBe(1600000)

    const holders = await book.tradesHolding('AAPL')
    expect(holders.map((t) => t.id).sort()).toEqual([a, b].sort())
  })
})
