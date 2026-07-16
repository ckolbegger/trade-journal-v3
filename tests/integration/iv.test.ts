import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import { Valuations } from '@/coordinators/valuations'
import type { Account, ExecutionDraft, Institution, PlanDraft } from '@/books/tradebook/types'

// IV display over Dexie + fake-indexeddb (docs/plan/slice-03-single-leg-options.md
// S3.5): a single-Leg long call, the independently-computed Black-Scholes worked
// case (domain/trademath/implied-vol.test.ts) — AAPL 2027-01-01 C 200, Marked
// 2026-01-01 at 23.67 with the underlying at 200.00, r=0.04 → IV ~0.25 (25%).

const CONTRACT = 'AAPL 2027-01-01 C 200'

const buyCall: ExecutionDraft = {
  side: 'buy',
  qty: 1,
  price: 2367,
  fees: 0,
  timestamp: new Date('2026-01-01T12:00:00').getTime(),
}

async function seedLongCall(dbName: string): Promise<string> {
  const binding = new DexieBinding(createDatabase(dbName))
  const book = new TradeBook(binding)
  const journal = new Journal(binding)
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal, binding).ensureSeeded()

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
          expiration: '2027-01-01',
          type: 'call',
          strike: 20000,
        },
        qty: 1,
      },
    ],
    exitLevels: [],
    plannedAt: '2026-01-01',
  }
  const tradeId = await book.confirmPlan(draft)
  await book.recordExecution({ tradeId, newLeg: CONTRACT }, buyCall)
  return tradeId
}

describe('IV display over Dexie', () => {
  it('set rate → mark contract + underlying → detail carries the IV figure; unmarking the underlying drops it', async () => {
    const dbName = 'iv-' + crypto.randomUUID()
    const tradeId = await seedLongCall(dbName)

    const settingsBinding = new DexieBinding(createDatabase(dbName))
    const tradeBookForSettings = new TradeBook(settingsBinding)
    const journalForSettings = new Journal(settingsBinding)
    const workspace = new Workspace(tradeBookForSettings, journalForSettings, settingsBinding)
    await workspace.settings.set('riskFreeRate', 0.04)

    const priceBook = new PriceBook(new DexieBinding(createDatabase(dbName)))
    await priceBook.record(CONTRACT, '2026-01-01', 2367, 'manual')
    await priceBook.record('AAPL', '2026-01-01', 20000, 'manual')

    // Reopen everything fresh, as a real session would.
    const binding = new DexieBinding(createDatabase(dbName))
    const valuations = new Valuations(new TradeBook(binding), new PriceBook(binding))
    const rate = await new Workspace(
      new TradeBook(binding),
      new Journal(binding),
      binding,
    ).settings.get('riskFreeRate')

    const detail = await valuations.detail(tradeId, rate)
    expect(detail.impliedVols).toHaveLength(1)
    expect(detail.impliedVols?.[0].markPrice).toBe(2367)
    expect(Math.abs((detail.impliedVols?.[0].iv ?? 0) - 0.25)).toBeLessThan(0.001)

    // Unmark the underlying (delete its Mark record directly — no PriceBook
    // "unmark" operation exists yet) — the contract Mark stays, IV drops.
    await new DexieBinding(createDatabase(dbName)).delete('marks', 'AAPL|2026-01-01')

    const reopenedBinding = new DexieBinding(createDatabase(dbName))
    const reopenedValuations = new Valuations(
      new TradeBook(reopenedBinding),
      new PriceBook(reopenedBinding),
    )
    const detailAfter = await reopenedValuations.detail(tradeId, rate)
    expect(detailAfter.impliedVols).toEqual([
      { legId: detail.impliedVols![0].legId, markPrice: 2367, iv: undefined },
    ])
  })
})
