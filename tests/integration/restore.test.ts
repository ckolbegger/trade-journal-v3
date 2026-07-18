import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { PriceBook } from '@/books/pricebook/price-book'
import { Workspace } from '@/workspace/workspace'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'

// S6.2 — restore from backup over Dexie: a populated database, exported and
// then wiped, comes back byte-for-byte via importAll — every Book serves the
// same content it did before the wipe. A truncated file is rejected and the
// wiped database (the test's own setup, not importAll's doing) stays empty.

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
  workspace: Workspace
  institutionName: string
  accountName: string
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
  await workspace.settings.set('riskFreeRate', 0.05)

  return { workspace, institutionName: institution.name, accountName: account.name }
}

async function wipe(dbName: string): Promise<void> {
  const db = createDatabase(dbName)
  await db.delete()
}

describe('Workspace.importAll over Dexie', () => {
  it('restores a wiped database so every Book serves identical content', async () => {
    const dbName = 'restore-' + crypto.randomUUID()
    const { workspace: original, institutionName, accountName } = await populate(dbName)
    const blob = await original.exportAll()

    await wipe(dbName)

    const wipedBinding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(wipedBinding)
    const journal = new Journal(wipedBinding)
    const priceBook = new PriceBook(wipedBinding)
    const restored = new Workspace(tradeBook, journal, wipedBinding)

    expect(await tradeBook.registries.institutions.list()).toEqual([])

    const report = await restored.importAll(blob)

    const institutions = await tradeBook.registries.institutions.list()
    const accounts = await tradeBook.registries.accounts.list()
    const trades = await tradeBook.query({})
    const entries = await journal.timeline()
    const marks = await priceBook.markSet(['AAPL'], '2026-07-10')

    expect(institutions.map((i) => i.name)).toEqual([institutionName])
    expect(accounts.map((a) => a.name)).toEqual([accountName])
    expect(trades).toHaveLength(1)
    expect(entries).toHaveLength(1)
    expect(marks.get('AAPL')?.price).toBe(15000)
    expect(await restored.settings.get('riskFreeRate')).toBe(0.05)

    expect(report.counts.institutions).toBe(1)
    expect(report.counts.trades).toBe(1)
  })

  it('leaves a wiped database empty and reports the reason on a truncated file', async () => {
    const dbName = 'restore-truncated-' + crypto.randomUUID()
    await wipe(dbName)

    const wipedBinding = new DexieBinding(createDatabase(dbName))
    const tradeBook = new TradeBook(wipedBinding)
    const journal = new Journal(wipedBinding)
    const workspace = new Workspace(tradeBook, journal, wipedBinding)

    const truncated = new Blob(['{"schemaVersion": 6, "exportedAt": 123, "stores": {'])

    await expect(workspace.importAll(truncated)).rejects.toThrow(/not valid JSON/i)

    expect(await tradeBook.registries.institutions.list()).toEqual([])
    expect(await tradeBook.registries.accounts.list()).toEqual([])
  })
})
