import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace } from '@/workspace/workspace'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'

async function bookWithAccount(name: string): Promise<{ book: TradeBook; accountId: string }> {
  const binding = new DexieBinding(createDatabase(name))
  const book = new TradeBook(binding)
  const journal = new Journal(binding)
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  await new Workspace(book, journal).ensureSeeded()
  return { book, accountId: account.id }
}

function draftFor(accountId: string): PlanDraft {
  return {
    accountId,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 14000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 17000 },
    ],
    plannedAt: '2026-07-10',
    chartLink: 'https://charts.example/aapl',
  }
}

describe('plan confirm over Dexie', () => {
  it('returns an identical record after a close and reopen', async () => {
    const dbName = 'plan-confirm-' + crypto.randomUUID()
    const { book, accountId } = await bookWithAccount(dbName)
    const id = await book.confirmPlan(draftFor(accountId))
    const original = await book.get(id)

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const restored = await reopened.get(id)
    expect(restored).toEqual(original)
  })

  it("finds the Trade via query({status:'planned'}) after reopen", async () => {
    const dbName = 'plan-confirm-' + crypto.randomUUID()
    const { book, accountId } = await bookWithAccount(dbName)
    const id = await book.confirmPlan(draftFor(accountId))

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const planned = await reopened.query({ status: 'planned' })
    expect(planned.map((t) => t.id)).toEqual([id])
  })

  it('keeps the Plan immutable across reopen', async () => {
    const dbName = 'plan-confirm-' + crypto.randomUUID()
    const { book, accountId } = await bookWithAccount(dbName)
    const id = await book.confirmPlan(draftFor(accountId))

    const reopened = new TradeBook(new DexieBinding(createDatabase(dbName)))
    const record = await reopened.get(id)
    record.plan.thesis = 'rewritten'
    record.plan.exitLevels.length = 0

    const again = await reopened.get(id)
    expect(again.plan.thesis).toBe('AAPL breaks out')
    expect(again.plan.exitLevels).toHaveLength(2)
  })
})
