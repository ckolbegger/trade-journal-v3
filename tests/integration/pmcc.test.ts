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

// The PMCC worked example (docs/plan/slice-07-multi-leg.md, S7.3) — full
// lifecycle over Dexie + fake-indexeddb: plan (near call TBD) → LEAP fill →
// short-call fill (TBD completed) → marks → worked-example numbers → short
// call expires worthless (S3.3 path) → extremes recompute over the LEAP
// alone.

const FAR = 'AAPL 2028-01-21 C 150'
const NEAR = 'AAPL 2026-09-18 C 220'
const NEAR_EXPIRATION = '2026-09-18'

const buyLeap: ExecutionDraft = {
  side: 'buy',
  qty: 1,
  price: 6200,
  fees: 65,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const sellNearCall: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 300,
  fees: 65,
  timestamp: new Date('2026-07-11T12:00:00').getTime(),
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

async function bookWithPmccPlan(
  dbName: string,
): Promise<{ tradeBook: TradeBook; tradeId: string }> {
  const { tradeBook, journal } = books(dbName)
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  // The near call is TBD at plan time — completed by its later fill
  // (decided in Slice 7); the far LEAP is concrete up front.
  const draft: PlanDraft = {
    accountId: account.id,
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
      { side: 'sell', instrument: { kind: 'option', ticker: 'AAPL', type: 'call' }, qty: 1 },
    ],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'structureValue', value: 550000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'structureValue', value: 680000 },
    ],
    plannedAt: '2026-07-10',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  return { tradeBook, tradeId }
}

describe('PMCC lifecycle over Dexie', () => {
  it('legs in, values the worked example, and recomputes extremes once the short call expires worthless', async () => {
    const dbName = 'pmcc-' + crypto.randomUUID()
    const { tradeBook, tradeId } = await bookWithPmccPlan(dbName)

    // ——— legging in: the LEAP first, the short call later ———
    const afterLeap = await tradeBook.recordExecution({ tradeId, newLeg: FAR }, buyLeap)
    expect(afterLeap.record.legs).toHaveLength(1)
    expect(afterLeap.record.plan.plannedLegs).toHaveLength(2) // the near call is still unfilled

    const afterNear = await tradeBook.recordExecution({ tradeId, newLeg: NEAR }, sellNearCall)
    expect(afterNear.record.legs).toHaveLength(2)
    expect(afterNear.record.id).toBe(tradeId) // the SAME Trade, not a new one

    // ——— marks ———
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      FAR,
      '2026-07-15',
      6500,
      'manual',
    )
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      NEAR,
      '2026-07-15',
      200,
      'manual',
    )

    // ——— reopen: worked-example numbers ———
    const reopened = books(dbName)
    const detail = await reopened.valuations.detail(tradeId)
    expect(detail.valuation).toMatchObject({
      currentValue: 630000,
      unrealizedPnL: 40000,
      fees: 130,
      totalPnL: 39870,
    })
    expect(detail.riskReward).toMatchObject({
      worstCaseRisk: 630000,
      maxReward: 70000,
      plannedRisk: 80000,
      plannedReward: 50000,
    })
    expect(detail.position.holdings).toEqual(
      expect.arrayContaining([
        {
          instrument: {
            kind: 'option',
            ticker: 'AAPL',
            expiration: '2028-01-21',
            type: 'call',
            strike: 15000,
          },
          qty: 1,
          side: 'long',
        },
        {
          instrument: {
            kind: 'option',
            ticker: 'AAPL',
            expiration: NEAR_EXPIRATION,
            type: 'call',
            strike: 22000,
          },
          qty: 1,
          side: 'short',
        },
      ]),
    )

    // ——— the short call expires worthless (S3.3 path) — the review agenda surfaces it ———
    const afterExpiration = books(dbName)
    const agenda = await afterExpiration.review.agenda('2026-09-19')
    expect(agenda.expiredLegs).toEqual([
      {
        tradeId,
        legId: expect.any(String),
        instrument: {
          kind: 'option',
          ticker: 'AAPL',
          expiration: NEAR_EXPIRATION,
          type: 'call',
          strike: 22000,
        },
        qty: 1,
        side: 'short',
        expiredOn: NEAR_EXPIRATION,
      },
    ])
    const [expired] = agenda.expiredLegs
    const expireOutcome = await afterExpiration.tradeBook.recordExecution(
      { tradeId: expired.tradeId, legId: expired.legId },
      {
        side: 'buy',
        qty: 1,
        price: 0,
        fees: 0,
        kind: 'expire',
        timestamp: new Date(`${NEAR_EXPIRATION}T16:00:00`).getTime(),
      },
    )
    // Only the near call flattened — the LEAP Leg still holds, so the Trade
    // stays open (the PMCC surviving its short call, the point of the story).
    expect(expireOutcome.nowFlat).toBe(false)

    // ——— reopen once more: extremes recompute over the LEAP alone ———
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      FAR,
      '2026-09-19',
      6500,
      'manual',
    )
    const last = books(dbName)
    const afterExpireDetail = await last.valuations.detail(tradeId)
    expect(afterExpireDetail.riskReward?.maxReward).toBe('unlimited')
    expect(afterExpireDetail.riskReward?.worstCaseRisk).toBe(650000)
  })
})
