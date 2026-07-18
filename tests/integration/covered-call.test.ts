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

// The covered-call worked example (docs/plan/slice-07-multi-leg.md, S7.1) —
// full lifecycle over Dexie + fake-indexeddb: plan (call TBD) → stock fill →
// call fill → marks → worked-example numbers → call expires worthless (the
// S3.3 path) → sell stock → closed; realized folds both legs.

const CONTRACT = 'XYZ 2026-09-18 C 55'
const EXPIRATION = '2026-09-18'

const buyStock: ExecutionDraft = {
  side: 'buy',
  qty: 100,
  price: 5000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
}
const sellCall: ExecutionDraft = {
  side: 'sell',
  qty: 1,
  price: 150,
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

async function bookWithCoveredCallPlan(
  dbName: string,
): Promise<{ tradeBook: TradeBook; tradeId: string }> {
  const { tradeBook, journal } = books(dbName)
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await new Workspace(tradeBook, journal).ensureSeeded()

  // The Plan's call leg is TBD — no strike/expiration yet, completed by the
  // later fill (decided in Slice 7).
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'Sell premium against XYZ stock',
    strategyId: 'strategy-covered-call',
    ideaSourceId: '',
    plannedLegs: [
      { side: 'buy', instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100 },
      { side: 'sell', instrument: { kind: 'option', ticker: 'XYZ', type: 'call' }, qty: 1 },
    ],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 4600 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 5500 },
    ],
    plannedAt: '2026-07-10',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  return { tradeBook, tradeId }
}

describe('covered call lifecycle over Dexie', () => {
  it('legs in, values the worked example, survives the call expiring worthless, and closes on the stock sale', async () => {
    const dbName = 'covered-call-' + crypto.randomUUID()
    const { tradeBook, tradeId } = await bookWithCoveredCallPlan(dbName)

    // ——— legging in: stock first, call later ———
    const afterStock = await tradeBook.recordExecution({ tradeId, newLeg: 'XYZ' }, buyStock)
    expect(afterStock.record.legs).toHaveLength(1)
    expect(afterStock.record.plan.plannedLegs).toHaveLength(2) // the call is still unfilled

    const afterCall = await tradeBook.recordExecution({ tradeId, newLeg: CONTRACT }, sellCall)
    expect(afterCall.record.legs).toHaveLength(2)
    expect(afterCall.record.id).toBe(tradeId) // the SAME Trade, not a new one

    // ——— marks ———
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      'XYZ',
      '2026-07-15',
      5200,
      'manual',
    )
    await new PriceBook(new DexieBinding(createDatabase(dbName))).record(
      CONTRACT,
      '2026-07-15',
      100,
      'manual',
    )

    // ——— reopen: worked-example numbers ———
    const reopened = books(dbName)
    const detail = await reopened.valuations.detail(tradeId)
    expect(detail.valuation).toMatchObject({
      currentValue: 510000,
      unrealizedPnL: 25000,
      fees: 165,
      totalPnL: 24835,
    })
    expect(detail.riskReward).toMatchObject({
      plannedRisk: 50000,
      worstCaseRisk: 510000,
      plannedReward: 40000,
      maxReward: 40000,
    })
    expect(detail.position.holdings).toEqual(
      expect.arrayContaining([
        { instrument: { kind: 'stock', ticker: 'XYZ' }, qty: 100, side: 'long' },
        {
          instrument: {
            kind: 'option',
            ticker: 'XYZ',
            expiration: EXPIRATION,
            type: 'call',
            strike: 5500,
          },
          qty: 1,
          side: 'short',
        },
      ]),
    )

    // ——— the call expires worthless (S3.3 path) — the review agenda surfaces it ———
    const afterExpiration = books(dbName)
    const agenda = await afterExpiration.review.agenda('2026-09-19')
    expect(agenda.expiredLegs).toEqual([
      {
        tradeId,
        legId: expect.any(String),
        instrument: {
          kind: 'option',
          ticker: 'XYZ',
          expiration: EXPIRATION,
          type: 'call',
          strike: 5500,
        },
        qty: 1,
        side: 'short',
        expiredOn: EXPIRATION,
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
        timestamp: new Date(`${EXPIRATION}T16:00:00`).getTime(),
      },
    )
    // Only the call flattened — the stock Leg still holds 100 shares, so the
    // Trade stays open (a covered call surviving its short call, exactly the
    // "one campaign" point of this story).
    expect(expireOutcome.nowFlat).toBe(false)

    const afterExpireValue = await afterExpiration.valuations.value(tradeId)
    // Call: 150.00 credit − 0.65 fees = 149.35, folded with the still-open
    // stock Leg's own realized (−1.00, its opening fee only, no closes yet).
    expect(afterExpireValue.valuation?.realizedPnL).toBe(14835)

    // ——— sell the stock — the Trade finally closes ———
    const finalSession = books(dbName)
    const record = await finalSession.tradeBook.get(tradeId)
    const stockLeg = record.legs.find((l) => l.instrument.kind === 'stock')!
    const closeStock = await finalSession.tradeBook.recordExecution(
      { tradeId, legId: stockLeg.id },
      {
        side: 'sell',
        qty: 100,
        price: 5400,
        fees: 100,
        timestamp: new Date('2026-09-20T12:00:00').getTime(),
      },
    )
    expect(closeStock.nowFlat).toBe(true)
    await finalSession.tradeBook.setCloseReason(tradeId, {
      id: 'close-reason-hit-target',
      name: 'Hit Target',
    })

    // ——— reopen once more: realized folds BOTH legs ———
    const last = books(dbName)
    const finalValue = await last.valuations.value(tradeId)
    // call: 150.00 − 0.65 = 149.35; stock: (54.00−50.00)×100 − 2.00 fees = 398.00
    expect(finalValue.valuation?.realizedPnL).toBe(54735)
    expect(finalValue.valuation?.totalPnL).toBe(54735)
    expect((await last.tradeBook.query({ status: 'closed' })).map((t) => t.id)).toEqual([tradeId])
  })
})
