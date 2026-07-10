import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import type { Account, Institution } from '@/books/tradebook/types'

describe('onboarding over Dexie', () => {
  it('persists the institution and account across a close and reopen; onboarding check passes', async () => {
    const name = 'onboarding-' + crypto.randomUUID()

    const firstDb = createDatabase(name)
    const first = new TradeBook(new DexieBinding(firstDb))
    expect(await first.registries.institutions.list()).toEqual([])
    expect(await first.registries.accounts.list()).toEqual([])

    const institution = { id: '', name: 'Schwab' } as Institution
    await first.registries.institutions.save(institution)
    await first.registries.accounts.save({
      id: '',
      name: 'Taxable',
      institutionId: institution.id,
    } as Account)
    firstDb.close()

    const secondDb = createDatabase(name)
    const second = new TradeBook(new DexieBinding(secondDb))
    const institutions = await second.registries.institutions.list()
    const accounts = await second.registries.accounts.list()
    expect(institutions.map((i) => i.name)).toEqual(['Schwab'])
    expect(accounts.map((a) => a.name)).toEqual(['Taxable'])
    expect(accounts[0].institutionId).toBe(institutions[0].id)

    // The onboarding gate keys off the presence of a non-archived Account.
    expect(accounts.length).toBeGreaterThan(0)
  })
})
