import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace, PLAN_ENTRY_TYPE_ID } from '@/workspace/workspace'
import { buildEntryThreads } from '@/ui/components/entryThread'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'

// An addendum chain — entry, addendum, addendum-to-addendum — persisted over
// Dexie: entriesFor({trade}) is still one indexed query for the whole chain
// after reopen (the decided-in-slice tradeId-copy ruling), and the chain
// flattens under its root entry for rendering (S2.3 — journal.md).

async function seededTrade(dbName: string): Promise<{
  journal: Journal
  tradeId: string
}> {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  await new Workspace(tradeBook, journal).ensureSeeded()

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
    exitLevels: [],
    plannedAt: '2026-07-01',
  }
  const tradeId = await tradeBook.confirmPlan(draft)
  return { journal, tradeId }
}

describe('addendum chain over Dexie', () => {
  it('round-trips entry → addendum → addendum-to-addendum; entriesFor(trade) returns all three, flattened under the root', async () => {
    const dbName = 'addendum-' + crypto.randomUUID()
    const { journal, tradeId } = await seededTrade(dbName)

    const rootId = await journal.write({
      anchor: { kind: 'plan', tradeId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-01T12:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Breakout confirmed on volume' }],
    })
    const addendumId = await journal.write({
      anchor: { kind: 'entry', entryId: rootId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-05T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Held up as planned' }],
    })
    const addendumToAddendumId = await journal.write({
      anchor: { kind: 'entry', entryId: addendumId },
      entryTypeId: PLAN_ENTRY_TYPE_ID,
      at: new Date('2026-07-10T09:00:00').getTime(),
      placeholder: false,
      answers: [{ promptId: 'why', value: 'Still holding' }],
    })

    const reopened = new Journal(new DexieBinding(createDatabase(dbName)))
    const entries = await reopened.entriesFor({ trade: tradeId })

    expect(entries.map((e) => e.id).sort()).toEqual(
      [rootId, addendumId, addendumToAddendumId].sort(),
    )
    // The whole chain carries the root's tradeId — one indexed query, any depth.
    expect(entries.every((e) => (e.anchor as { tradeId?: string }).tradeId === tradeId)).toBe(true)

    // Rendering flattens the chain under its root: one thread, both addenda
    // nested under the plan entry, not their own top-level entries.
    const timeline = await reopened.timeline()
    const threads = buildEntryThreads(timeline)
    expect(threads).toHaveLength(1)
    expect(threads[0].root.id).toBe(rootId)
    expect(threads[0].addenda.map((a) => a.id)).toEqual([addendumId, addendumToAddendumId])
  })
})
