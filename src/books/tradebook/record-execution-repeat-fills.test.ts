import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from './trade-book'
import type { Account, ExecutionDraft, Institution, PlanDraft } from './types'

// S5.1 scaling in: repeat fills on an existing Leg (deferred from Slice 1).
// Worked example (docs/plan/slice-05-scaling.md): buy 100 AAPL @ 150.00 fees
// 1.00 (Lot A), then buy 100 @ 160.00 fees 1.00 (Lot B) on the same Leg.

async function bookWithPlan(): Promise<{ book: TradeBook; tradeId: string }> {
  const book = new TradeBook(new InMemoryBinding())
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
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

const buyLotA = (): ExecutionDraft => ({
  side: 'buy',
  qty: 100,
  price: 15000,
  fees: 100,
  timestamp: new Date('2026-07-10T12:00:00').getTime(),
})

const buyLotB = (): ExecutionDraft => ({
  side: 'buy',
  qty: 100,
  price: 16000,
  fees: 100,
  timestamp: new Date('2026-07-12T12:00:00').getTime(),
})

describe('TradeBook.recordExecution (repeat fills)', () => {
  it('appends a second opening Execution to the same Leg', async () => {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buyLotA())
    const legId = first.record.legs[0].id

    const outcome = await book.recordExecution({ tradeId, legId }, buyLotB())

    expect(outcome.record.legs).toHaveLength(1)
    expect(outcome.record.legs[0].executions).toHaveLength(2)

    const stored = await book.get(tradeId)
    expect(stored.legs).toHaveLength(1)
    expect(stored.legs[0].executions).toHaveLength(2)
  })

  it("keeps each fill's own price, fees, and timestamp (no averaging in storage)", async () => {
    const { book, tradeId } = await bookWithPlan()
    const first = await book.recordExecution({ tradeId, newLeg: 'AAPL' }, buyLotA())
    const legId = first.record.legs[0].id

    const outcome = await book.recordExecution({ tradeId, legId }, buyLotB())

    const [execA, execB] = outcome.record.legs[0].executions
    expect(execA).toMatchObject({ price: 15000, fees: 100, timestamp: buyLotA().timestamp })
    expect(execB).toMatchObject({ price: 16000, fees: 100, timestamp: buyLotB().timestamp })
  })
})
