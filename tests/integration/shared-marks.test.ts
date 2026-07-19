import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'

// Shared-Mark proof (S7.3.T2): two PMCC Trades, each buying its own lot of the
// SAME LEAP contract (a trader running two separate monthly campaigns off one
// underlying LEAP position) — the roadmap's dedup requirement, mechanically
// present since Slice 1, proven here over Dexie + fake-indexeddb.

const LEAP = 'AAPL 2028-01-21 C 150'
const NEAR_A = 'AAPL 2026-09-18 C 220'
const NEAR_B = 'AAPL 2026-10-16 C 230'

const buyLeap: ExecutionDraft = {
  side: 'buy',
  qty: 1,
  price: 6200,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const sellNearA: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 300,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const sellNearB: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 280,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

function pmccDraft(accountId: string): PlanDraft {
  return {
    accountId,
    thesis: 'PMCC on AAPL',
    strategyId: 'strategy-pmcc',
    ideaSourceId: '',
    plannedLegs: [
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          type: 'call',
          strike: 15000,
          expiration: '2028-01-21',
        },
        qty: 1,
      },
      {
        side: 'sell',
        instrument: { kind: 'option', ticker: 'AAPL', type: 'call' },
        qty: 1,
      },
    ],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
}

async function seedTwoPmccTrades(dbName: string): Promise<{ tradeA: string; tradeB: string }> {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const tradeA = await tradeBook.confirmPlan(pmccDraft(account.id))
  await tradeBook.recordExecution({ tradeId: tradeA, newLeg: LEAP }, buyLeap)
  await tradeBook.recordExecution({ tradeId: tradeA, newLeg: NEAR_A }, sellNearA)

  const tradeB = await tradeBook.confirmPlan(pmccDraft(account.id))
  await tradeBook.recordExecution({ tradeId: tradeB, newLeg: LEAP }, buyLeap)
  await tradeBook.recordExecution({ tradeId: tradeB, newLeg: NEAR_B }, sellNearB)

  return { tradeA, tradeB }
}

describe('shared Marks across Trades (integration)', () => {
  it('stores one Mark when two Trades hold the same contract', async () => {
    const dbName = 'shared-marks-' + crypto.randomUUID()
    await seedTwoPmccTrades(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const priceBook = new PriceBook(binding)
    await priceBook.record(LEAP, '2026-07-15', 6500, 'manual')

    const series = await priceBook.series([LEAP])
    expect(series.get(LEAP)).toHaveLength(1)
    expect(series.get(LEAP)?.[0]).toMatchObject({ price: 6500, origin: 'manual' })
  })

  it('prompts the contract once in a walk covering both Trades', async () => {
    const dbName = 'shared-marks-' + crypto.randomUUID()
    const { tradeA, tradeB } = await seedTwoPmccTrades(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(binding)
    const priceBook = new PriceBook(binding)
    const valuations = new Valuations(tradeBook, priceBook)

    // Before any Mark, both Trades' agendas ask for the LEAP.
    const before = await valuations.marksNeeded('2026-07-15')
    const beforeInstruments = before.perTrade.map((t) => ({
      tradeId: t.tradeId,
      instruments: t.needs.map((n) => n.instrument),
    }))
    expect(beforeInstruments.find((t) => t.tradeId === tradeA)?.instruments).toContain(LEAP)
    expect(beforeInstruments.find((t) => t.tradeId === tradeB)?.instruments).toContain(LEAP)

    // The trader answers the LEAP prompt once, on Trade A's checkpoint.
    await priceBook.record(LEAP, '2026-07-15', 6500, 'manual')

    // Trade B's own checkpoint asks PriceBook.missingMarks the same way
    // WalkCheckpoint does — the LEAP row is already gone, so it is never
    // asked a second time. Only its own near call remains missing.
    const stillMissingForB = await priceBook.missingMarks([LEAP, NEAR_B], {
      from: '2026-07-15',
      to: '2026-07-15',
    })
    expect(stillMissingForB.some((r) => r.instrument === LEAP)).toBe(false)
    expect(stillMissingForB.some((r) => r.instrument === NEAR_B)).toBe(true)
  })

  it('warns on manual edit naming both Trades (tradesHolding)', async () => {
    const dbName = 'shared-marks-' + crypto.randomUUID()
    const { tradeA, tradeB } = await seedTwoPmccTrades(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(binding)
    const priceBook = new PriceBook(binding)
    await priceBook.record(LEAP, '2026-07-15', 6500, 'manual')

    const holders = await tradeBook.tradesHolding(LEAP)
    expect(holders.map((h) => h.id).sort()).toEqual([tradeA, tradeB].sort())
  })

  it('revalues both Trades from the edited Mark', async () => {
    const dbName = 'shared-marks-' + crypto.randomUUID()
    const { tradeA, tradeB } = await seedTwoPmccTrades(dbName)

    const binding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(binding)
    const priceBook = new PriceBook(binding)
    const valuations = new Valuations(tradeBook, priceBook)

    await priceBook.record(LEAP, '2026-07-15', 6500, 'manual')
    await priceBook.record(NEAR_A, '2026-07-15', 200, 'manual')
    await priceBook.record(NEAR_B, '2026-07-15', 180, 'manual')

    const beforeA = await valuations.value(tradeA)
    const beforeB = await valuations.value(tradeB)
    expect(beforeA.valuation?.currentValue).toBeDefined()
    expect(beforeB.valuation?.currentValue).toBeDefined()

    // Editing the shared LEAP Mark ($65.00 → $70.00, a $500.00 swing on 1
    // contract × the 100 multiplier) revalues BOTH Trades by exactly that.
    await priceBook.record(LEAP, '2026-07-15', 7000, 'manual')
    const afterA = await valuations.value(tradeA)
    const afterB = await valuations.value(tradeB)

    expect(afterA.valuation!.currentValue - beforeA.valuation!.currentValue).toBe(50000)
    expect(afterB.valuation!.currentValue - beforeB.valuation!.currentValue).toBe(50000)
  })
})
