import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from './trade-book'
import type { Account, Institution, PlanDraft } from './types'

// Multi-leg Plans + TBD legs + legging in (docs/plan/slice-07-multi-leg.md,
// S7.1): a covered call's Plan names two Planned Legs up front — buy 100
// stock, sell 1 call with strike/expiration left TBD — and the Trade opens at
// the stock fill, with the call arriving later as a second Leg of the SAME
// Trade once the trader knows its strike/expiration.

async function bookWithAccount(): Promise<{ book: TradeBook; accountId: string }> {
  const book = new TradeBook(new InMemoryBinding())
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  return { book, accountId: account.id }
}

function coveredCallDraft(accountId: string): PlanDraft {
  return {
    accountId,
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
}

describe('PlanDraft (multi-leg)', () => {
  it('confirms a Plan with two Planned Legs', async () => {
    const { book, accountId } = await bookWithAccount()
    const tradeId = await book.confirmPlan(coveredCallDraft(accountId))
    const trade = await book.get(tradeId)
    expect(trade.plan.plannedLegs).toHaveLength(2)
    expect(trade.plan.plannedLegs[0].instrument).toEqual({ kind: 'stock', ticker: 'XYZ' })
    expect(trade.plan.plannedLegs[1].instrument).toMatchObject({
      kind: 'option',
      ticker: 'XYZ',
      type: 'call',
    })
  })

  it('accepts TBD strike/expiration on the call leg', async () => {
    const { book, accountId } = await bookWithAccount()
    const tradeId = await book.confirmPlan(coveredCallDraft(accountId))
    const trade = await book.get(tradeId)
    const callLeg = trade.plan.plannedLegs[1].instrument
    expect(callLeg.kind).toBe('option')
    expect('strike' in callLeg ? callLeg.strike : undefined).toBeUndefined()
    expect('expiration' in callLeg ? callLeg.expiration : undefined).toBeUndefined()
  })
})

describe('legging in', () => {
  it('opens the Trade at the stock fill and shows one planned leg unfilled', async () => {
    const { book, accountId } = await bookWithAccount()
    const tradeId = await book.confirmPlan(coveredCallDraft(accountId))
    await book.recordExecution(
      { tradeId, newLeg: 'XYZ' },
      { side: 'buy', qty: 100, price: 5000, fees: 100, timestamp: Date.now() },
    )
    const trade = await book.get(tradeId)
    expect(trade.legs).toHaveLength(1)
    expect(trade.legs[0].instrument).toEqual({ kind: 'stock', ticker: 'XYZ' })
    expect(trade.plan.plannedLegs).toHaveLength(2) // the call leg is still unfilled
  })

  it('attaches the later call fill as the second Leg of the same Trade', async () => {
    const { book, accountId } = await bookWithAccount()
    const tradeId = await book.confirmPlan(coveredCallDraft(accountId))
    await book.recordExecution(
      { tradeId, newLeg: 'XYZ' },
      { side: 'buy', qty: 100, price: 5000, fees: 100, timestamp: Date.now() },
    )
    await book.recordExecution(
      { tradeId, newLeg: 'XYZ 2026-09-18 C 55' },
      { side: 'sell', qty: 1, price: 150, fees: 65, timestamp: Date.now() },
    )
    const trade = await book.get(tradeId)
    expect(trade.legs).toHaveLength(2)
    expect(trade.legs[1].instrument).toEqual({
      kind: 'option',
      ticker: 'XYZ',
      expiration: '2026-09-18',
      type: 'call',
      strike: 5500,
    })
    expect(trade.id).toBe(tradeId) // still the same campaign — no new Trade
  })
})
