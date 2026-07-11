import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace, PLAN_ENTRY_TYPE_ID } from '@/workspace/workspace'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'

async function seededBooks(name: string): Promise<{ tradeBook: TradeBook; journal: Journal }> {
  const binding = new DexieBinding(createDatabase(name))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  await new Workspace(tradeBook, journal).ensureSeeded()
  return { tradeBook, journal }
}

async function confirmPlan(tradeBook: TradeBook): Promise<string> {
  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  const draft: PlanDraft = {
    accountId: account.id,
    thesis: 'AAPL breaks out',
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker: 'AAPL' }, qty: 100 }],
    exitLevels: [
      { scope: { level: 'trade' }, side: 'stop', kind: 'underlyingPrice', price: 14000 },
      { scope: { level: 'trade' }, side: 'target', kind: 'underlyingPrice', price: 17000 },
    ],
    plannedAt: '2026-07-10',
  }
  return tradeBook.confirmPlan(draft)
}

describe('plan journal over Dexie', () => {
  it('round-trips a written entry with its snapshot intact after reopen', async () => {
    const dbName = 'plan-journal-' + crypto.randomUUID()
    const { tradeBook, journal } = await seededBooks(dbName)
    const tradeId = await confirmPlan(tradeBook)
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: 1_700_000_000_000,
      placeholder: false,
      answers: [
        { promptId: 'why', value: 'Breakout confirmed on volume' },
        { promptId: 'conviction', value: 4 },
        { promptId: 'emotion', value: 'calm' },
      ],
    })

    const reopened = new Journal(new DexieBinding(createDatabase(dbName)))
    const entries = await reopened.entriesFor({ trade: tradeId })

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    expect(entry.placeholder).toBe(false)
    expect(entry.at).toBe(1_700_000_000_000)
    expect(entry.answered.map((a) => a.prompt.id)).toEqual([
      'why',
      'invalidates',
      'conviction',
      'emotion',
    ])
    expect(entry.answered.find((a) => a.prompt.id === 'conviction')?.answer?.value).toBe(4)
    expect(entry.answered.find((a) => a.prompt.id === 'emotion')?.answer?.value).toBe('calm')
    expect(await reopened.countFor(tradeId)).toBe(1)
  })

  it('round-trips a skipped placeholder as placeholder=true after reopen', async () => {
    const dbName = 'plan-journal-' + crypto.randomUUID()
    const { tradeBook, journal } = await seededBooks(dbName)
    const tradeId = await confirmPlan(tradeBook)
    await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: 1_700_000_000_000,
      placeholder: true,
      answers: [],
    })

    const reopened = new Journal(new DexieBinding(createDatabase(dbName)))
    const entries = await reopened.entriesFor({ trade: tradeId })

    expect(entries).toHaveLength(1)
    expect(entries[0].placeholder).toBe(true)
    expect(entries[0].answered.every((a) => a.answer === undefined)).toBe(true)
  })
})
