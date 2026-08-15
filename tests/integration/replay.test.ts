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

// A partial close over Dexie (the S5.2 worked example, docs/plan/slice-05-scaling.md),
// replayed and hand-verified at three dates: before the partial (07-12), the
// partial date itself (07-15), and after the partial (07-16) — the Trade stays
// open (80 shares remain), so all three dates fall inside replay's held window.
//
// Fills (cents): buy 100 @ 150.00 fees 1.00 (Lot A, 07-10); buy 100 @ 160.00
// fees 1.00 (Lot B, 07-12); sell 120 @ 165.00 fees 1.00 (partial, 07-15) —
// consumes Lot A fully + 20 of Lot B (FIFO), leaving 80 shares @ Lot B's
// 160.00 (basis 12800.00).
//
// Hand-derived (independent of the implementation, extending S5.2's own
// worked numbers):
//   07-12 (before partial, mark 165.00): both Lots open, basis 31000.00,
//     unrealized 2000.00 (200 * (165-155)), fees-to-date 2.00 (two buys),
//     realized -2.00 (no close yet, net of fees), total 1998.00.
//   07-15 (the partial date, mark 165.00 — S5.2's own worked point): realized
//     1597.00, remaining basis 12800.00 over 80 shares, unrealized 400.00,
//     total 1997.00 (realized + unrealized), fees-to-date 3.00.
//   07-16 (after the partial, mark 170.00): same 80-share holding (basis
//     12800.00), unrealized now 800.00 (80 * (170-160)), realized unchanged
//     at 1597.00, total 2397.00.

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
const sell120: ExecutionDraft = {
  side: 'sell',
  qty: 120,
  price: 16500,
  fees: 100,
  timestamp: new Date('2026-07-15T12:00:00').getTime(),
}

describe('Valuations.replay over Dexie (partial close)', () => {
  it('hand-verifies replay points before, on, and after the partial close', async () => {
    const dbName = 'replay-partial-' + crypto.randomUUID()
    const binding = new DexieBinding(createDatabase(dbName))
    const book = new TradeBook(binding)
    const journal = new Journal(binding)
    const priceBook = new PriceBook(binding)
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
      exitLevels: [stop, target],
      plannedAt: '2026-07-10',
    }
    const tradeId = await book.confirmPlan(draft)
    const first = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buyLotA)
    const legId = first.record.legs[0].id
    await book.recordExecution({ tradeId, legId }, buyLotB)
    await book.recordExecution({ tradeId, legId }, sell120)

    await priceBook.record('AAPL', '2026-07-12', 16500, 'manual')
    await priceBook.record('AAPL', '2026-07-15', 16500, 'manual')
    await priceBook.record('AAPL', '2026-07-16', 17000, 'manual')

    // Reopen the database fresh, as the app would.
    const reopened = new DexieBinding(createDatabase(dbName))
    const valuations = new Valuations(new TradeBook(reopened), new PriceBook(reopened))
    const points = await valuations.replay(tradeId)

    expect(points.map((p) => p.date)).toEqual(['2026-07-12', '2026-07-15', '2026-07-16'])

    const [beforePartial, onPartial, afterPartial] = points

    expect(beforePartial.valuation).toMatchObject({
      currentValue: 3300000,
      unrealizedPnL: 200000,
      realizedPnL: -200,
      fees: 200,
      totalPnL: 199800,
    })

    expect(onPartial.valuation).toMatchObject({
      realizedPnL: 159700,
      unrealizedPnL: 40000,
      fees: 300,
      totalPnL: 199700,
    })
    expect(onPartial.valuation.perLeg[0]).toMatchObject({ basis: 1280000, avgCost: 16000 })

    expect(afterPartial.valuation).toMatchObject({
      realizedPnL: 159700,
      unrealizedPnL: 80000,
      fees: 300,
      totalPnL: 239700,
    })
    expect(afterPartial.valuation.perLeg[0]).toMatchObject({ basis: 1280000, avgCost: 16000 })
  })
})
