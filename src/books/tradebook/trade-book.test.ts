import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from './trade-book'
import type { Account, Institution, PlanDraft } from './types'

function makeBook(): TradeBook {
  return new TradeBook(new InMemoryBinding())
}

async function bookWithAccount(): Promise<{ book: TradeBook; accountId: string }> {
  const book = makeBook()
  const institution = { id: '', name: 'Schwab' } as Institution
  await book.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await book.registries.accounts.save(account)
  return { book, accountId: account.id }
}

function draftFor(accountId: string, overrides: Partial<PlanDraft> = {}): PlanDraft {
  return {
    accountId,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: 'idea-scan',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 14000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 17000 },
    ],
    plannedAt: '2026-07-10',
    ...overrides,
  }
}

describe('TradeBook.confirmPlan', () => {
  it('creates a Trade bound to an existing Account and returns its id', async () => {
    const { book, accountId } = await bookWithAccount()
    const id = await book.confirmPlan(draftFor(accountId))
    const trade = await book.get(id)
    expect(trade.id).toBe(id)
    expect(trade.accountId).toBe(accountId)
    expect(trade.legs).toEqual([])
  })

  it('rejects a draft whose accountId does not exist', async () => {
    const book = makeBook()
    await expect(book.confirmPlan(draftFor('nope'))).rejects.toThrow()
  })

  it('rejects a draft with an empty thesis', async () => {
    const { book, accountId } = await bookWithAccount()
    await expect(book.confirmPlan(draftFor(accountId, { thesis: '   ' }))).rejects.toThrow()
  })

  it('rejects a draft with no Planned Legs', async () => {
    const { book, accountId } = await bookWithAccount()
    await expect(book.confirmPlan(draftFor(accountId, { plannedLegs: [] }))).rejects.toThrow()
  })

  it('stores plannedAt, Idea Source, Strategy id, and optional chart link', async () => {
    const { book, accountId } = await bookWithAccount()
    const id = await book.confirmPlan(
      draftFor(accountId, { chartLink: 'https://charts.example/aapl' }),
    )
    const { plan } = await book.get(id)
    expect(plan.plannedAt).toBe('2026-07-10')
    expect(plan.ideaSourceId).toBe('idea-scan')
    expect(plan.strategyId).toBe('strategy-long-stock')
    expect(plan.chartLink).toBe('https://charts.example/aapl')
  })

  it('exposes no operation that mutates plan after confirmation', async () => {
    const { book, accountId } = await bookWithAccount()
    const id = await book.confirmPlan(draftFor(accountId))
    const trade = await book.get(id)
    trade.plan.thesis = 'rewritten'
    trade.plan.exitLevels.length = 0
    const again = await book.get(id)
    expect(again.plan.thesis).toBe('AAPL breaks out')
    expect(again.plan.exitLevels).toHaveLength(2)
  })
})

describe('TradeBook.query', () => {
  it('returns Trades in insertion order', async () => {
    const { book, accountId } = await bookWithAccount()
    const first = await book.confirmPlan(draftFor(accountId, { thesis: 'first' }))
    const second = await book.confirmPlan(draftFor(accountId, { thesis: 'second' }))
    const ids = (await book.query({})).map((t) => t.id)
    expect(ids).toEqual([first, second])
  })

  it("filters by derived status 'planned'", async () => {
    const { book, accountId } = await bookWithAccount()
    const id = await book.confirmPlan(draftFor(accountId))
    const planned = await book.query({ status: 'planned' })
    expect(planned.map((t) => t.id)).toEqual([id])
    expect(await book.query({ status: 'open' })).toEqual([])
  })

  it('filters by accountId', async () => {
    const { book, accountId } = await bookWithAccount()
    const otherAccount = { id: '', name: 'Roth', institutionId: '' } as Account
    // Reuse the same institution the first account references.
    const institutions = await book.registries.institutions.list()
    otherAccount.institutionId = institutions[0].id
    await book.registries.accounts.save(otherAccount)

    const mine = await book.confirmPlan(draftFor(accountId))
    await book.confirmPlan(draftFor(otherAccount.id))

    const filtered = await book.query({ accountId })
    expect(filtered.map((t) => t.id)).toEqual([mine])
  })
})

describe('TradeBook.registries', () => {
  it('lists no institutions or accounts on a fresh book', async () => {
    const book = makeBook()
    expect(await book.registries.institutions.list()).toEqual([])
    expect(await book.registries.accounts.list()).toEqual([])
  })

  it('saves and lists an institution', async () => {
    const book = makeBook()
    await book.registries.institutions.save({ name: 'Schwab' } as Institution)
    expect((await book.registries.institutions.list()).map((i) => i.name)).toEqual(['Schwab'])
  })

  it('saves an account referencing an existing institution', async () => {
    const book = makeBook()
    const institution = { name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    await book.registries.accounts.save({
      name: 'Taxable',
      institutionId: institution.id,
    } as Account)
    const accounts = await book.registries.accounts.list()
    expect(accounts).toHaveLength(1)
    expect(accounts[0].institutionId).toBe(institution.id)
  })

  it('rejects an account whose institutionId does not exist', async () => {
    const book = makeBook()
    await expect(
      book.registries.accounts.save({ name: 'Taxable', institutionId: 'nope' } as Account),
    ).rejects.toThrow()
    expect(await book.registries.accounts.list()).toEqual([])
  })

  it('archives an institution while its accounts remain readable', async () => {
    const book = makeBook()
    const institution = { name: 'Schwab' } as Institution
    await book.registries.institutions.save(institution)
    await book.registries.accounts.save({
      name: 'Taxable',
      institutionId: institution.id,
    } as Account)
    await book.registries.institutions.archive(institution.id)
    const accounts = await book.registries.accounts.list()
    expect(accounts.map((a) => a.name)).toEqual(['Taxable'])
    expect(accounts[0].institutionId).toBe(institution.id)
  })
})
