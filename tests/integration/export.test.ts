import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'

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

async function populate(dbName: string): Promise<{
  binding: DexieBinding
  tradeBook: TradeBook
  journal: Journal
  workspace: Workspace
}> {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const priceBook = new PriceBook(binding)
  const workspace = new Workspace(tradeBook, journal, binding)
  await workspace.ensureSeeded()

  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  await tradeBook.confirmPlan(draftFor(account.id))

  await journal.write({
    anchor: { kind: 'standalone' },
    entryTypeId: 'entry-type-trader-reflection',
    at: Date.now(),
    answers: [],
    placeholder: false,
  })

  await priceBook.record('AAPL', '2026-07-10', 15000, 'manual')

  return { binding, tradeBook, journal, workspace }
}

describe('Workspace.exportAll over Dexie', () => {
  it('produces a file whose parsed counts match the populated database', async () => {
    const dbName = 'export-' + crypto.randomUUID()
    const { workspace } = await populate(dbName)

    const blob = await workspace.exportAll()
    const file = JSON.parse(await blob.text())

    expect(file.stores.trades).toHaveLength(1)
    expect(file.stores.entries).toHaveLength(1)
    expect(file.stores.marks).toHaveLength(1)
  })

  it('lastExportAt survives reopen', async () => {
    const dbName = 'export-' + crypto.randomUUID()
    const { tradeBook, journal, workspace } = await populate(dbName)
    await workspace.exportAll()
    const before = (await workspace.storageHealth()).lastExportAt

    const reopened = new Workspace(tradeBook, journal, new DexieBinding(createDatabase(dbName)))
    const after = (await reopened.storageHealth()).lastExportAt

    expect(after).toBe(before)
    expect(after).toBeDefined()
  })
})
