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

// The long-call worked example over Dexie + fake-indexeddb (docs/plan/slice-03-single-leg-options.md):
// Plan Long Call, buy 1 AAPL 2027-06-18 C 200; Exit Levels: structureValue stop
// 6.00, target 24.00. Fill buy 1 @ 12.00, fees $0.65. Marks: contract 14.00,
// underlying 205. Then close at 18.00.

const CONTRACT = 'AAPL 2027-06-18 C 200'

const stop: ExitLevel = {
  scope: { level: 'trade' },
  side: 'stop',
  kind: 'structureValue',
  value: 600,
}
const target: ExitLevel = {
  scope: { level: 'trade' },
  side: 'target',
  kind: 'structureValue',
  value: 2400,
}

const buyCall: ExecutionDraft = {
  side: 'buy',
  qty: 1,
  price: 1200,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

async function seedTrade(dbName: string): Promise<{ tradeId: string; accountId: string }> {
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
    strategyId: 'strategy-long-call',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          expiration: '2027-06-18',
          type: 'call',
          strike: 20000,
        },
        qty: 1,
      },
    ],
    exitLevels: [stop, target],
    plannedAt: '2026-07-10',
  }
  const tradeId = await book.confirmPlan(draft)
  await book.recordExecution({ tradeId, newLeg: CONTRACT }, buyCall)
  return { tradeId, accountId: account.id }
}

describe('long-call lifecycle over Dexie', () => {
  it('reopens the DB and reproduces every worked-example number from detail', async () => {
    const dbName = 'long-call-' + crypto.randomUUID()
    const { tradeId } = await seedTrade(dbName)
    const priceBook = new PriceBook(new DexieBinding(createDatabase(dbName)))
    await priceBook.record(CONTRACT, '2026-07-15', 1400, 'manual')
    await priceBook.record('AAPL', '2026-07-15', 20500, 'manual')

    // Reopen the database fresh.
    const binding = new DexieBinding(createDatabase(dbName))
    const valuations = new Valuations(new TradeBook(binding), new PriceBook(binding))
    const detail = await valuations.detail(tradeId)

    expect(detail.valuation).toMatchObject({
      currentValue: 140000,
      unrealizedPnL: 20000,
      fees: 65,
      totalPnL: 19935,
    })
    expect(detail.riskReward).toMatchObject({
      plannedRisk: 80000,
      worstCaseRisk: 140000,
      plannedReward: 100000,
      maxReward: 'unlimited',
      original: { risk: 60000, reward: 120000 },
    })
    expect(detail.position.holdings).toEqual([
      {
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          expiration: '2027-06-18',
          type: 'call',
          strike: 20000,
        },
        qty: 1,
        side: 'long',
      },
    ])
  })

  it('closes at 18.00 and realizes correctly with the contract multiplier', async () => {
    const dbName = 'long-call-close-' + crypto.randomUUID()
    const { tradeId } = await seedTrade(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const book = new TradeBook(binding)
    const record = await book.get(tradeId)
    const outcome = await book.recordExecution(
      { tradeId, legId: record.legs[0].id },
      {
        side: 'sell',
        qty: 1,
        price: 1800,
        fees: 65,
        timestamp: new Date('2026-07-16T12:00:00').getTime(),
      },
    )
    expect(outcome.nowFlat).toBe(true)
    await book.setCloseReason(tradeId, { id: 'close-reason-hit-target', name: 'Hit Target' })

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const priceBook = new PriceBook(new DexieBinding(createDatabase(dbName)))
    const closed = await reopened.get(tradeId)
    expect(closed.closeReason?.name).toBe('Hit Target')

    const marks = await priceBook.markSet([CONTRACT], '2026-07-16')
    // No Mark ever recorded — valuation reads realized P&L straight from the
    // closed Leg's Executions (multiplier applied: (18.00 - 12.00) × 100 =
    // 600.00, minus 1.30 total fees = 598.70).
    expect(marks.size).toBe(0)
    const valuations = new Valuations(reopened, priceBook)
    const value = await valuations.value(tradeId)
    expect(value.valuation?.realizedPnL).toBe(59870)
    expect(value.valuation?.totalPnL).toBe(59870)
  })
})
