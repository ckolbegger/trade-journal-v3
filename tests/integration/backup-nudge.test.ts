import { describe, it, expect, vi, afterEach } from 'vitest'
import { createDatabase } from '@/storage/schema'
import { DexieBinding } from '@/storage/dexie-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import { Workspace } from '@/workspace/workspace'
import { computeBackupNudge } from '@/ui/pages/backupNudge'

// S6.3.T2 — the backup nudge's page-model computation over Dexie +
// fake-indexeddb. `lastExportAt` is a fact Workspace records; whether it's
// stale enough to nudge TODAY is computed fresh from storageHealth() +
// Settings.backupNudgeDays each time (no "nudge" fact is ever stored,
// workspace.md's facts-vs-behavior split).

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function openWorkspace(dbName: string): Workspace {
  const binding = new DexieBinding(createDatabase(dbName))
  return new Workspace(new TradeBook(binding), new Journal(binding), binding)
}

describe('backup nudge over Dexie', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('reopens the DB with a stale lastExportAt → nudges; a fresh export clears it', async () => {
    const dbName = 'backup-nudge-' + crypto.randomUUID()
    const seeded = openWorkspace(dbName)
    await seeded.settings.set('backupNudgeDays', 7)

    // Export 8 days ago (freeze "now", export, restore the real clock) — older
    // than the 7-day nudge window.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() - 8 * ONE_DAY_MS)
    await seeded.exportAll()
    vi.useRealTimers()

    // Reopen the database fresh, as the Review page does on load.
    const reopened = openWorkspace(dbName)
    const staleHealth = await reopened.storageHealth()
    const backupNudgeDays = await reopened.settings.get('backupNudgeDays')
    expect(computeBackupNudge(staleHealth, backupNudgeDays)).toEqual({ neverExported: false })

    // A fresh export today clears it.
    await reopened.exportAll()
    const freshHealth = await reopened.storageHealth()
    expect(computeBackupNudge(freshHealth, backupNudgeDays)).toBeNull()
  })
})
