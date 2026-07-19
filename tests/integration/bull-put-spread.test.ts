import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'

// The bull-put-spread worked example (docs/plan/slice-07-multi-leg.md, S7.2) —
// full lifecycle over Dexie + fake-indexeddb: both fills same day → marks →
// worked-example numbers → buy back both legs → closed.

const SHORT_PUT = 'XYZ 2026-08-21 P 100'
const LONG_PUT = 'XYZ 2026-08-21 P 90'
const EXPIRATION = '2026-08-21'

const sellShortPut: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 260,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const buyLongPut: ExecutionDraft = {
  side: 'buy',
  qty: 1,
  price: 60,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}

function books(dbName: string) {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const priceBook = new PriceBook(binding)
  const valuations = new Valuations(tradeBook, priceBook)
  return { tradeBook, journal, priceBook, valuations }
}

async function bookWithSpreadPlan(
  dbName: string,
): Promise<{ tradeBook: TradeBook; tradeId: string }> {
  const { tradeBook, journal } = books(dbName)
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'XYZ range-bound, bullish bias',
    strategyId: 'strategy-bull-put-spread',
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
      {
        side: 'buy',
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: EXPIRATION,
          type: 'put',
          strike: 9000,
        },
        qty: 1,
      },
    ],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 9700 },
      { scope: { level: 'trade' }, side: 'target', kind: 'pctOfMaxProfit', pct: 75 },
    ],
    plannedAt: '2026-07-10',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  return { tradeBook, tradeId }
}

describe('bull put spread lifecycle over Dexie', () => {
  it('both fills same day, values the worked example, and closes buying back both legs', async () => {
    const dbName = 'bull-put-spread-' + crypto.randomUUID()
    const { tradeBook, tradeId } = await bookWithSpreadPlan(dbName)

    // ——— both fills, same day ———
    const afterShort = await tradeBook.recordExecution({ tradeId, newLeg: SHORT_PUT }, sellShortPut)
    expect(afterShort.record.legs).toHaveLength(1)
    const afterLong = await tradeBook.recordExecution({ tradeId, newLeg: LONG_PUT }, buyLongPut)
    expect(afterLong.record.legs).toHaveLength(2)
    expect(afterLong.record.id).toBe(tradeId)

    // ——— marks ———
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      SHORT_PUT,
      '2026-07-15',
      110,
      'manual',
    )
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      LONG_PUT,
      '2026-07-15',
      20,
      'manual',
    )

    // ——— reopen: worked-example numbers ———
    const reopened = books(dbName)
    const detail = await reopened.valuations.detail(tradeId)
    expect(detail.valuation).toMatchObject({
      currentValue: -9000,
      unrealizedPnL: 11000,
      fees: 130,
      totalPnL: 10870,
    })
    expect(detail.riskReward).toMatchObject({
      plannedRisk: 21000,
      worstCaseRisk: 91000,
      plannedReward: 4000,
      maxReward: 9000,
    })

    // ——— buy back both legs — exactly at the 75% target (net 0.50) ———
    // Short put: sold 2.60, bought back 0.60 → gross (260-60)*100 = 20000,
    // minus its 130 total fees (65 open + 65 close) = 19870 ($198.70).
    const finalSession = books(dbName)
    const record = await finalSession.tradeBook.get(tradeId)
    const shortLeg = record.legs.find(
      (l) => l.instrument.kind === 'option' && l.instrument.strike === 10000,
    )!
    const longLeg = record.legs.find(
      (l) => l.instrument.kind === 'option' && l.instrument.strike === 9000,
    )!
    await finalSession.tradeBook.recordExecution(
      { tradeId, legId: shortLeg.id },
      {
        side: 'buy',
        qty: 1,
        price: 60,
        fees: 65,
        timestamp: new Date('2026-07-20T12:00:00').getTime(),
      },
    )
    // Long put: bought 0.60, sold back 0.10 → gross (10-60)*100 = -5000,
    // minus its 130 total fees = -5130 (-$51.30).
    const closeLong = await finalSession.tradeBook.recordExecution(
      { tradeId, legId: longLeg.id },
      {
        side: 'sell',
        qty: 1,
        price: 10,
        fees: 65,
        timestamp: new Date('2026-07-20T12:00:00').getTime(),
      },
    )
    expect(closeLong.nowFlat).toBe(true)
    await finalSession.tradeBook.setCloseReason(tradeId, {
      id: 'close-reason-hit-target',
      name: 'Hit Target',
    })

    // ——— reopen once more: realized folds both legs — the $108.70 already
    // banked at the mark snapshot (net -90.00) plus the remaining move to
    // the actual close (net -50.00, a further $40.00 favorable move) minus
    // the two closing fills' $1.30 in fees: 108.70 + 40.00 - 1.30 = 147.40.
    const last = books(dbName)
    const finalValue = await last.valuations.value(tradeId)
    expect(finalValue.valuation?.realizedPnL).toBe(14740)
    expect(finalValue.valuation?.totalPnL).toBe(14740)
    expect((await last.tradeBook.query({ status: 'closed' })).map((t) => t.id)).toEqual([tradeId])
  })
})
