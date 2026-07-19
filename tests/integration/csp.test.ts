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

// The cash-secured put worked example over Dexie + fake-indexeddb
// (docs/plan/slice-03-single-leg-options.md): Plan Cash-Secured Put, sell 1
// XYZ 2026-08-21 P 100; Exit Levels: underlyingPrice stop 95, Position price
// target 0.50 (amended per exit-level ruling 2026-07-19, was pctOfMaxProfit
// 80%). Fill sell 1 @ 2.50, fees $0.65. Mark contract 1.25. Then buy back
// 0.60, closed.

const CONTRACT = 'XYZ 2026-08-21 P 100'

const stop: ExitLevel = {
  scope: { level: 'trade' },
  side: 'stop',
  kind: 'underlyingPrice',
  price: 9500,
}
const target: ExitLevel = {
  scope: { level: 'trade' },
  side: 'target',
  kind: 'structureValue',
  value: 50,
}

const sellToOpen: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 250,
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
    thesis: 'XYZ range-bound',
    strategyId: 'strategy-cash-secured-put',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'sell',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: '2026-08-21',
          type: 'put',
          strike: 10000,
        },
        qty: 1,
      },
    ],
    exitLevels: [stop, target],
    plannedAt: '2026-07-10',
  }
  const tradeId = await book.confirmPlan(draft)
  await book.recordExecution({ tradeId, newLeg: CONTRACT }, sellToOpen)
  return { tradeId, accountId: account.id }
}

describe('cash-secured put lifecycle over Dexie', () => {
  it('reopens the DB and reproduces every worked-example number from detail', async () => {
    const dbName = 'csp-' + crypto.randomUUID()
    const { tradeId } = await seedTrade(dbName)
    const priceBook = new PriceBook(new DexieBinding(createDatabase(dbName)))
    await priceBook.record(CONTRACT, '2026-07-15', 125, 'manual')

    // Reopen the database fresh.
    const binding = new DexieBinding(createDatabase(dbName))
    const valuations = new Valuations(new TradeBook(binding), new PriceBook(binding))
    const detail = await valuations.detail(tradeId)

    expect(detail.valuation).toMatchObject({
      currentValue: -12500,
      unrealizedPnL: 12500,
      fees: 65,
      totalPnL: 12435,
    })
    expect(detail.riskReward).toMatchObject({
      plannedRisk: 37500,
      worstCaseRisk: 987500,
      plannedReward: 7500,
      maxReward: 12500,
    })
    expect(detail.position.holdings).toEqual([
      {
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: '2026-08-21',
          type: 'put',
          strike: 10000,
        },
        qty: 1,
        side: 'short',
      },
    ])
  })

  it('buys back at 0.60 and realizes 188.70, closed', async () => {
    const dbName = 'csp-close-' + crypto.randomUUID()
    const { tradeId } = await seedTrade(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const book = new TradeBook(binding)
    const record = await book.get(tradeId)
    const outcome = await book.recordExecution(
      { tradeId, legId: record.legs[0].id },
      {
        side: 'buy',
        qty: 1,
        price: 60,
        fees: 65,
        timestamp: new Date('2026-07-20T12:00:00').getTime(),
      },
    )
    expect(outcome.nowFlat).toBe(true)
    await book.setCloseReason(tradeId, { id: 'close-reason-hit-target', name: 'Hit Target' })

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const priceBook = new PriceBook(new DexieBinding(createDatabase(dbName)))
    const closed = await reopened.get(tradeId)
    expect(closed.closeReason?.name).toBe('Hit Target')

    const valuations = new Valuations(reopened, priceBook)
    const value = await valuations.value(tradeId)
    expect(value.valuation?.realizedPnL).toBe(18870)
    expect(value.valuation?.totalPnL).toBe(18870)
  })
})
