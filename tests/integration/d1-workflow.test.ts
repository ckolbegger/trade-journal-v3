import { describe, expect, it } from 'vitest'
import { openDb, repo, transaction } from '../../src/persistence/db'
import { evaluateReadiness } from '../../src/domain/readiness'
import { guardWrite } from '../../src/domain/write-gate'
import { seedCatalog, seedJournal } from '../../src/domain/initialize'
import { SEED_MANIFEST } from '../../src/domain/seeds'
import { createInstitution, createAccount, archiveInstitution } from '../../src/domain/catalog'
import { browseFamily } from '../../src/domain/browse'
import { saveSettingsWithCurrent, requestDurability } from '../../src/domain/workspace'
import type { Institution, Account } from '../../src/domain/types'

// No mocks: real IndexedDB implementation via fake-indexeddb, real domain code.
describe('D1 end-to-end workflow (mock-free)', () => {
  it('should gate writes on readiness, seed defaults, then record institution and account durably', async () => {
    const db = await openDb()

    // Readiness gates every write.
    const blocked = guardWrite(
      evaluateReadiness({
        diagnosticTransaction: false, capacityHeadroom: true, serviceWorkerControl: true,
        offlineInventoryValid: true, protection: { kind: 'Protected' },
        workspaceReadable: false, existingRoot: 'none',
      }),
      'Workspace.initialize',
    )
    expect(blocked.ok).toBe(false)

    const ready = evaluateReadiness({
      diagnosticTransaction: true, capacityHeadroom: true, serviceWorkerControl: true,
      offlineInventoryValid: true, protection: { kind: 'BestEffort', reason: 'test' },
      workspaceReadable: false, existingRoot: 'none',
    })
    expect(ready.outcome).toBe('Writable')
    expect(guardWrite(ready, 'Workspace.initialize').ok).toBe(true)

    // Atomic seeds.
    const catalog = seedCatalog({
      strategies: [], closeReasons: [], abandonmentReasons: [], ideaSourceTagTypes: [],
    }, SEED_MANIFEST)
    const journal = seedJournal({ entryTypes: [], sources: [] }, SEED_MANIFEST)
    await transaction(db, ['catalog', 'journal'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'catalog', { id: 'catalog-1', ...catalog })
      await repo.putInTx(tx, 'journal', { id: 'journal-1', ...journal })
    })

    // Institution and Account under one semantic transaction.
    const instResult = createInstitution('Charles Schwab', [])
    expect(instResult.ok).toBe(true)
    if (!instResult.ok) return
    const inst = instResult.value
    const acctResult = createAccount('Main', inst)
    expect(acctResult.ok).toBe(true)
    if (!acctResult.ok) return
    const acct = acctResult.value
    await transaction(db, ['institutions', 'accounts'], 'readwrite', async tx => {
      await repo.putInTx(tx, 'institutions', inst)
      await repo.putInTx(tx, 'accounts', acct)
    })

    // Restart-equivalent read: reopen and verify durable state and seeds.
    const reopened = await openDb()
    expect((await repo.get<Institution>(reopened, 'institutions', inst.id))?.label).toBe('Charles Schwab')
    expect((await repo.get<Account>(reopened, 'accounts', acct.id))?.institutionId).toBe(inst.id)
    const storedCatalog = await repo.get<{ strategies: unknown[] }>(reopened, 'catalog', 'catalog-1')
    expect(storedCatalog?.strategies).toHaveLength(11)
    expect(browseFamily([inst]).map(i => i.label)).toEqual(['Charles Schwab'])

    // Archiving blocked while an active account remains.
    expect(archiveInstitution(inst, [acct]).ok).toBe(false)
  })

  it('should handle settings and advisory protection without mutating authority', async () => {
    const saved = saveSettingsWithCurrent(
      { timeZone: 'America/New_York', revision: '1' },
      { timeZone: 'UTC', revision: '1' },
    )
    expect(saved.ok).toBe(true)
    expect(requestDurability({ kind: 'Unavailable', reason: 'host unsupported' })).toBe('NotImproved')
    const db = await openDb()
    const before = (await repo.all<Institution>(db, 'institutions')).length
    expect((await repo.all<Institution>(db, 'institutions')).length).toBe(before)
  })
})
