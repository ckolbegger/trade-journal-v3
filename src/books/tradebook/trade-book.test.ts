import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { TradeBook } from './trade-book'
import type { Account, Institution } from './types'

function makeBook(): TradeBook {
  return new TradeBook(new InMemoryBinding())
}

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
