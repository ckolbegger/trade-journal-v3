import { describe, it, expect } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace, REVIEW_ENTRY_TYPE_ID } from '@/workspace/workspace'
import type { Account, Institution, PlanDraft } from '@/books/tradebook/types'
import type { Entry } from '@/books/journal/types'

// S1.9.T5 — the export/import round-trip carries both shapes this story
// changes: a declined Entry, and a select answer stored as an option id. A
// pre-S1.9 backup stores select answers as display strings and has no
// `declined` field at all — the importer must tolerate that shape rather than
// reinterpret it (no migration is attempted; docs/plan/slice-01-...md).

function draftFor(accountId: string, ticker: string): PlanDraft {
  return {
    accountId,
    thesis: `${ticker} breaks out`,
    strategyId: 'strategy-long-stock',
    ideaSourceId: '',
    plannedLegs: [{ side: 'buy', instrument: { kind: 'stock', ticker }, qty: 100 }],
    exitLevels: [],
    plannedAt: '2026-07-10',
  }
}

async function populate(dbName: string): Promise<{
  tradeBook: TradeBook
  journal: Journal
  workspace: Workspace
  tradeId: string
}> {
  const binding = new DexieBinding(createDatabase(dbName))
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  const workspace = new Workspace(tradeBook, journal, binding)
  await workspace.ensureSeeded()

  const institution = { id: '', name: 'Schwab' } as Institution
  await tradeBook.registries.institutions.save(institution)
  const account = { id: '', name: 'Taxable', institutionId: institution.id } as Account
  await tradeBook.registries.accounts.save(account)
  const tradeId = await tradeBook.confirmPlan(draftFor(account.id, 'AAPL'))

  await journal.write({
    anchor: { kind: 'review', date: '2026-07-15', tradeId },
    entryTypeId: REVIEW_ENTRY_TYPE_ID,
    at: Date.now(),
    answers: [],
    placeholder: false,
    declined: true,
  })

  await journal.write({
    anchor: { kind: 'review', date: '2026-07-16', tradeId },
    entryTypeId: REVIEW_ENTRY_TYPE_ID,
    at: Date.now(),
    answers: [{ promptId: 'action', value: 'Hold' }],
    placeholder: false,
  })

  return { tradeBook, journal, workspace, tradeId }
}

async function wipe(dbName: string): Promise<void> {
  const db = createDatabase(dbName)
  await db.delete()
}

describe('export / import — declined entries and option ids', () => {
  it('round-trips a declined entry through export and re-import', async () => {
    const dbName = 'export-declined-' + crypto.randomUUID()
    const { workspace, tradeId } = await populate(dbName)
    const blob = await workspace.exportAll()

    await wipe(dbName)
    const binding = new DexieBinding(createDatabase(dbName))
    const restored = new Workspace(new TradeBook(binding), new Journal(binding), binding)
    await restored.importAll(blob)

    const reopened = new Journal(binding)
    const entries = await reopened.entriesFor({ trade: tradeId })
    const declined = entries.find(
      (e) => e.anchor.kind === 'review' && e.anchor.date === '2026-07-15',
    )!
    expect(declined.declined).toBe(true)
  })

  it('round-trips a select answer as its option id', async () => {
    const dbName = 'export-declined-' + crypto.randomUUID()
    const { workspace, tradeId } = await populate(dbName)
    const blob = await workspace.exportAll()

    await wipe(dbName)
    const binding = new DexieBinding(createDatabase(dbName))
    const restored = new Workspace(new TradeBook(binding), new Journal(binding), binding)
    await restored.importAll(blob)

    const reopened = new Journal(binding)
    const entries = await reopened.entriesFor({ trade: tradeId })
    const withAction = entries.find(
      (e) => e.anchor.kind === 'review' && e.anchor.date === '2026-07-16',
    )!
    expect(withAction.answered.find((a) => a.prompt.id === 'action')?.answer).toEqual({
      promptId: 'action',
      value: 'Hold',
    })
  })

  it('imports a backup written before this story without error', async () => {
    const dbName = 'export-pre-s19-' + crypto.randomUUID()
    await wipe(dbName)
    const binding = new DexieBinding(createDatabase(dbName))
    const workspace = new Workspace(new TradeBook(binding), new Journal(binding), binding)

    // A pre-S1.9 shape: options are bare strings, the select answer is the
    // display string, and there is no `declined` field anywhere.
    const legacyEntryType = {
      id: 'entry-type-trade-review',
      name: 'Trade Review',
      designatedFor: 'review',
      prompts: [{ id: 'action', text: 'Action', kind: 'select', options: ['Hold', 'Exit Soon'] }],
    }
    const legacyEntry = {
      id: 'legacy-entry-1',
      at: 1_700_000_000_000,
      anchor: { kind: 'review', date: '2026-07-01', tradeId: 'trade-1' },
      entryTypeId: 'entry-type-trade-review',
      answered: [
        {
          prompt: legacyEntryType.prompts[0],
          answer: { promptId: 'action', value: 'Hold' },
        },
      ],
      placeholder: false,
      // no `declined` field at all
    }
    const file = {
      schemaVersion: 6,
      exportedAt: 1_700_000_000_000,
      stores: {
        institutions: [],
        accounts: [],
        trades: [],
        strategies: [],
        ideaSources: [],
        entries: [legacyEntry],
        entryTypes: [legacyEntryType],
        closeReasons: [],
        marks: [],
        settings: [],
      },
    }
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' })

    await expect(workspace.importAll(blob)).resolves.toBeDefined()
  })

  it('reads an entry with no declined field as not declined', async () => {
    const dbName = 'export-pre-s19-read-' + crypto.randomUUID()
    await wipe(dbName)
    const binding = new DexieBinding(createDatabase(dbName))
    const journal = new Journal(binding)

    // Bypass write() to simulate a legacy record with no `declined` key.
    await binding.put('entries', {
      id: 'legacy-entry-2',
      at: 1_700_000_000_000,
      anchor: { kind: 'standalone' },
      entryTypeId: 'entry-type-trader-reflection',
      answered: [],
      placeholder: false,
    } as Entry)

    const [entry] = await journal.timeline()
    expect(entry.declined).toBeUndefined()
  })
})
