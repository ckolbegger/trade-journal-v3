import { describe, it, expect } from 'vitest'
import { InMemoryBinding } from '@/storage/in-memory-binding'
import { createDatabase } from '@/storage/schema'
import type { StorageBinding } from '@/storage/storage-binding'
import { TradeBook } from '@/books/tradebook/trade-book'
import { Journal } from '@/books/journal/journal'
import {
  Workspace,
  LONG_STOCK_STRATEGY_ID,
  LONG_CALL_STRATEGY_ID,
  LONG_PUT_STRATEGY_ID,
  CASH_SECURED_PUT_STRATEGY_ID,
  PLAN_ENTRY_TYPE_ID,
  CLOSE_ENTRY_TYPE_ID,
  REVIEW_ENTRY_TYPE_ID,
  CLOSE_REASON_IDS,
  TRADER_REFLECTION_ENTRY_TYPE_ID,
  REVIEW_NOTE_ENTRY_TYPE_ID,
  EXPORT_SCHEMA_VERSION,
  EXPORTED_STORES,
  type StorageManager,
} from './workspace'

function makeWorkspace(): {
  workspace: Workspace
  tradeBook: TradeBook
  journal: Journal
  binding: InMemoryBinding
} {
  const binding = new InMemoryBinding()
  const tradeBook = new TradeBook(binding)
  const journal = new Journal(binding)
  return { workspace: new Workspace(tradeBook, journal, binding), tradeBook, journal, binding }
}

describe('Workspace.ensureSeeded — strategies', () => {
  it('seeds the Long Stock strategy into an empty registry', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    const strategies = await tradeBook.registries.strategies.list()
    // The full expected set, so an accidental extra seed can't slip in unnoticed.
    expect(strategies.map((s) => s.name)).toEqual([
      'Long Stock',
      'Long Call',
      'Long Put',
      'Cash-Secured Put',
    ])
    const longStock = strategies.find((s) => s.id === LONG_STOCK_STRATEGY_ID)
    expect(longStock?.name).toBe('Long Stock')
  })

  it('does not duplicate on a second run', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    const strategies = await tradeBook.registries.strategies.list()
    expect(strategies.filter((s) => s.id === LONG_STOCK_STRATEGY_ID)).toHaveLength(1)
  })

  it('does not overwrite a seeded item the trader edited', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    const seeded = (await tradeBook.registries.strategies.list()).find(
      (s) => s.id === LONG_STOCK_STRATEGY_ID,
    )!
    await tradeBook.registries.strategies.save({ ...seeded, name: 'My Long Stock' })

    await workspace.ensureSeeded()

    const strategies = await tradeBook.registries.strategies.list()
    expect(strategies.find((s) => s.id === LONG_STOCK_STRATEGY_ID)?.name).toBe('My Long Stock')
  })

  it('does not resurrect a seeded item the trader archived', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await tradeBook.registries.strategies.archive(LONG_STOCK_STRATEGY_ID)

    await workspace.ensureSeeded()

    expect(
      (await tradeBook.registries.strategies.list()).some((s) => s.id === LONG_STOCK_STRATEGY_ID),
    ).toBe(false)
    expect(
      (await tradeBook.registries.strategies.list(true)).filter(
        (s) => s.id === LONG_STOCK_STRATEGY_ID,
      ),
    ).toHaveLength(1)
  })
})

describe('Workspace.ensureSeeded — Plan Entry Type', () => {
  it('seeds the Plan Entry Type into an empty registry', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    const plan = (await journal.entryTypes.list()).find((t) => t.id === PLAN_ENTRY_TYPE_ID)
    expect(plan?.name).toBe('Plan')
    expect(plan?.designatedFor).toBe('plan')
    expect(plan?.prompts.map((p) => p.kind)).toEqual(['text', 'text', 'scale', 'select'])
  })

  it('does not duplicate the Plan type on a second run', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    const plans = (await journal.entryTypes.list()).filter((t) => t.id === PLAN_ENTRY_TYPE_ID)
    expect(plans).toHaveLength(1)
  })

  it('does not overwrite a Plan Entry Type the trader edited', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    const seeded = (await journal.entryTypes.list()).find((t) => t.id === PLAN_ENTRY_TYPE_ID)!
    await journal.entryTypes.save({ ...seeded, name: 'My Plan' })

    await workspace.ensureSeeded()

    const plan = (await journal.entryTypes.list()).find((t) => t.id === PLAN_ENTRY_TYPE_ID)
    expect(plan?.name).toBe('My Plan')
  })

  it('does not resurrect a Plan Entry Type the trader archived', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await journal.entryTypes.archive(PLAN_ENTRY_TYPE_ID)

    await workspace.ensureSeeded()

    expect((await journal.entryTypes.list()).some((t) => t.id === PLAN_ENTRY_TYPE_ID)).toBe(false)
    expect(
      (await journal.entryTypes.list(true)).filter((t) => t.id === PLAN_ENTRY_TYPE_ID),
    ).toHaveLength(1)
  })
})

describe('Workspace.ensureSeeded — Trade Review Entry Type', () => {
  it('seeds the Trade Review Entry Type with the Action list as its select options', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()

    const review = (await journal.entryTypes.list()).find((t) => t.id === REVIEW_ENTRY_TYPE_ID)
    expect(review?.name).toBe('Trade Review')
    expect(review?.designatedFor).toBe('review')
    expect(review?.prompts.map((p) => p.kind)).toEqual(['select', 'scale', 'text'])
    // The Action select's options ARE the Action list — trader-configurable for
    // free, because editing the Entry Type edits the Actions (review.md).
    expect(review?.prompts[0].options).toEqual(['Hold', 'Exit Soon', 'Adjust', 'Watch Closely'])
  })

  it('does not duplicate the Trade Review type on a second run', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    const types = (await journal.entryTypes.list()).filter((t) => t.id === REVIEW_ENTRY_TYPE_ID)
    expect(types).toHaveLength(1)
  })

  it('does not overwrite a Trade Review type the trader edited', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()
    const seeded = (await journal.entryTypes.list()).find((t) => t.id === REVIEW_ENTRY_TYPE_ID)!
    await journal.entryTypes.save({
      ...seeded,
      prompts: [{ ...seeded.prompts[0], options: ['Hold', 'Close it'] }],
    })

    await workspace.ensureSeeded()

    const review = (await journal.entryTypes.list()).find((t) => t.id === REVIEW_ENTRY_TYPE_ID)
    expect(review?.prompts[0].options).toEqual(['Hold', 'Close it'])
  })
})

describe('Workspace.ensureSeeded — Close Reasons and Close Entry Type', () => {
  it('seeds the five Close Reasons and the Close Entry Type iff absent', async () => {
    const { workspace, tradeBook, journal } = makeWorkspace()
    await workspace.ensureSeeded()

    const reasons = await tradeBook.registries.closeReasons.list()
    expect(reasons.map((r) => r.name)).toEqual([
      'Hit Target',
      'Hit Stop',
      'Thesis Invalidated',
      'Timed Out',
      'Never Filled',
    ])
    expect(reasons.map((r) => r.id)).toEqual(CLOSE_REASON_IDS)

    const close = (await journal.entryTypes.list()).find((t) => t.id === CLOSE_ENTRY_TYPE_ID)
    expect(close?.name).toBe('Close')
    expect(close?.designatedFor).toBe('close')
    expect(close?.prompts.map((p) => p.kind)).toEqual(['text', 'select', 'text'])
  })

  it('does not duplicate the Close Reasons on a second run', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await workspace.ensureSeeded()
    expect(await tradeBook.registries.closeReasons.list()).toHaveLength(5)
  })

  it('does not overwrite a Close Reason the trader edited', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    const [seeded] = await tradeBook.registries.closeReasons.list()
    await tradeBook.registries.closeReasons.save({ ...seeded, name: 'Target Reached' })

    await workspace.ensureSeeded()

    const reasons = await tradeBook.registries.closeReasons.list()
    expect(reasons.find((r) => r.id === seeded.id)?.name).toBe('Target Reached')
    expect(reasons).toHaveLength(5)
  })

  it('does not resurrect a Close Reason the trader archived', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()
    await tradeBook.registries.closeReasons.archive(CLOSE_REASON_IDS[0])

    await workspace.ensureSeeded()

    expect(await tradeBook.registries.closeReasons.list()).toHaveLength(4)
    expect(await tradeBook.registries.closeReasons.list(true)).toHaveLength(5)
  })
})

describe('seeding (extension)', () => {
  it('seeds Long Call and Long Put iff absent', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()

    const strategies = await tradeBook.registries.strategies.list()
    const longCall = strategies.find((s) => s.id === LONG_CALL_STRATEGY_ID)
    const longPut = strategies.find((s) => s.id === LONG_PUT_STRATEGY_ID)

    expect(longCall?.name).toBe('Long Call')
    expect(longCall?.legs).toEqual([{ side: 'buy', instrumentKind: 'option', optionType: 'call' }])
    expect(longCall?.exitLevels).toEqual([
      { side: 'stop', kind: 'structureValue' },
      { side: 'target', kind: 'structureValue' },
    ])

    expect(longPut?.name).toBe('Long Put')
    expect(longPut?.legs).toEqual([{ side: 'buy', instrumentKind: 'option', optionType: 'put' }])
    expect(longPut?.exitLevels).toEqual([
      { side: 'stop', kind: 'structureValue' },
      { side: 'target', kind: 'structureValue' },
    ])

    // Not duplicated, and a trader edit survives a second seeding run.
    await tradeBook.registries.strategies.save({ ...longCall!, name: 'My Long Call' })
    await workspace.ensureSeeded()
    const again = await tradeBook.registries.strategies.list()
    expect(again.filter((s) => s.id === LONG_CALL_STRATEGY_ID)).toHaveLength(1)
    expect(again.find((s) => s.id === LONG_CALL_STRATEGY_ID)?.name).toBe('My Long Call')
  })

  it('seeds Cash-Secured Put iff absent', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await workspace.ensureSeeded()

    const strategies = await tradeBook.registries.strategies.list()
    const csp = strategies.find((s) => s.id === CASH_SECURED_PUT_STRATEGY_ID)

    expect(csp?.name).toBe('Cash-Secured Put')
    expect(csp?.legs).toEqual([{ side: 'sell', instrumentKind: 'option', optionType: 'put' }])
    expect(csp?.exitLevels).toEqual([
      { side: 'stop', kind: 'underlyingPrice' },
      { side: 'target', kind: 'pctOfMaxProfit' },
    ])

    await workspace.ensureSeeded()
    const again = await tradeBook.registries.strategies.list()
    expect(again.filter((s) => s.id === CASH_SECURED_PUT_STRATEGY_ID)).toHaveLength(1)
  })
})

describe('Workspace.ensureSeeded — Trader Reflection and Review Note Entry Types', () => {
  it('seeds Trader Reflection and Review Note iff absent', async () => {
    const { workspace, journal } = makeWorkspace()
    await workspace.ensureSeeded()

    const types = await journal.entryTypes.list()
    const reflection = types.find((t) => t.id === TRADER_REFLECTION_ENTRY_TYPE_ID)
    const reviewNote = types.find((t) => t.id === REVIEW_NOTE_ENTRY_TYPE_ID)

    expect(reflection?.name).toBe('Trader Reflection')
    expect(reflection?.designatedFor).toBeUndefined()
    expect(reflection?.prompts.map((p) => p.kind)).toEqual(['text', 'select', 'scale'])

    expect(reviewNote?.name).toBe('Review Note')
    expect(reviewNote?.designatedFor).toBeUndefined()
    expect(reviewNote?.prompts.map((p) => p.kind)).toEqual(['text', 'select'])

    // Running seeding again does not duplicate either type.
    await workspace.ensureSeeded()
    const again = await journal.entryTypes.list()
    expect(again.filter((t) => t.id === TRADER_REFLECTION_ENTRY_TYPE_ID)).toHaveLength(1)
    expect(again.filter((t) => t.id === REVIEW_NOTE_ENTRY_TYPE_ID)).toHaveLength(1)
  })
})

describe('Workspace.settings', () => {
  it('returns a default riskFreeRate (0.04) before any set', async () => {
    const { workspace } = makeWorkspace()
    expect(await workspace.settings.get('riskFreeRate')).toBe(0.04)
  })

  it('round-trips a set value', async () => {
    const { workspace } = makeWorkspace()
    await workspace.settings.set('riskFreeRate', 0.05)
    expect(await workspace.settings.get('riskFreeRate')).toBe(0.05)
  })

  it('returns an empty pricingSources list before any set', async () => {
    const { workspace } = makeWorkspace()
    expect(await workspace.settings.get('pricingSources')).toEqual([])
  })

  it('round-trips a pricingSources set value', async () => {
    const { workspace } = makeWorkspace()
    await workspace.settings.set('pricingSources', [
      { id: 'marketdata.app', enabled: true, apiKey: 'abc123' },
    ])
    expect(await workspace.settings.get('pricingSources')).toEqual([
      { id: 'marketdata.app', enabled: true, apiKey: 'abc123' },
    ])
  })

  it('round-trips backupNudgeDays', async () => {
    const { workspace } = makeWorkspace()
    expect(await workspace.settings.get('backupNudgeDays')).toBe(7)
    await workspace.settings.set('backupNudgeDays', 3)
    expect(await workspace.settings.get('backupNudgeDays')).toBe(3)
  })
})

async function parseExport(blob: Blob): Promise<{
  schemaVersion: number
  exportedAt: number
  stores: Record<string, unknown[]>
}> {
  return JSON.parse(await blob.text())
}

describe('Workspace.exportAll', () => {
  it('produces one JSON blob containing every store’s records', async () => {
    const { workspace, tradeBook, journal } = makeWorkspace()
    await tradeBook.registries.institutions.save({ id: '', name: 'Schwab' })
    await journal.entryTypes.save({ id: 'et-1', name: 'Custom', prompts: [] })

    const file = await parseExport(await workspace.exportAll())

    expect(file.stores.institutions.map((r) => (r as { name: string }).name)).toEqual(['Schwab'])
    expect(file.stores.entryTypes.map((r) => (r as { id: string }).id)).toContain('et-1')
  })

  it('stamps schemaVersion and exportedAt', async () => {
    const { workspace } = makeWorkspace()
    const before = Date.now()

    const file = await parseExport(await workspace.exportAll())

    expect(file.schemaVersion).toBe(6)
    expect(file.exportedAt).toBeGreaterThanOrEqual(before)
    expect(file.exportedAt).toBeLessThanOrEqual(Date.now())
  })

  it('reads raw stores (a record invalid under current domain rules still exports)', async () => {
    const { workspace, binding } = makeWorkspace()
    // Bypasses TradeBook validation entirely — a shape TradeBook would never
    // produce or accept, proving exportAll reads the binding directly.
    await binding.put('trades', { id: 'bad-trade', thisFieldDoesNotExist: true })

    const file = await parseExport(await workspace.exportAll())

    expect(file.stores.trades).toEqual([{ id: 'bad-trade', thisFieldDoesNotExist: true }])
  })

  it('round-trips byte-faithful record content (deep-equal after parse)', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    const institution = { id: '', name: 'Fidelity' }
    await tradeBook.registries.institutions.save(institution)
    const [saved] = await tradeBook.registries.institutions.list()

    const file = await parseExport(await workspace.exportAll())

    expect(file.stores.institutions).toEqual([saved])
  })

  it('records lastExportAt as a fact', async () => {
    const { workspace } = makeWorkspace()
    expect((await workspace.storageHealth()).lastExportAt).toBeUndefined()

    const before = Date.now()
    await workspace.exportAll()

    const health = await workspace.storageHealth()
    expect(health.lastExportAt).toBeGreaterThanOrEqual(before)
    expect(health.lastExportAt).toBeLessThanOrEqual(Date.now())
  })

  it('excludes pricing-source API keys', async () => {
    const { workspace } = makeWorkspace()
    const secretKey = 'super-secret-key'
    await workspace.settings.set('pricingSources', [
      { id: 'marketdata.app', enabled: true, apiKey: secretKey },
    ])

    const blob = await workspace.exportAll()
    const text = await blob.text()
    const file = JSON.parse(text) as Awaited<ReturnType<typeof parseExport>>

    const stored = file.stores.settings.find(
      (r) => (r as { id: string }).id === 'pricingSources',
    ) as { value: { id: string; enabled: boolean; apiKey?: string }[] } | undefined
    expect(stored?.value).toEqual([{ id: 'marketdata.app', enabled: true }])
    // The strongest form of "secrets never leave" (workspace.md): the literal
    // credential string appears nowhere in the file, not just absent from the
    // one field a narrower assertion happens to check.
    expect(text).not.toContain(secretKey)
  })

  it('EXPORTED_STORES and EXPORT_SCHEMA_VERSION match the live Dexie schema (drift pin)', () => {
    const db = createDatabase('workspace-export-drift-pin')
    expect(db.tables.map((t) => t.name).sort()).toEqual([...EXPORTED_STORES].sort())
    expect(db.verno).toBe(EXPORT_SCHEMA_VERSION)
  })
})

// Every store present but empty — a valid, minimal export file that a test
// overrides one store of.
function emptyStores(): Record<string, unknown[]> {
  return Object.fromEntries(EXPORTED_STORES.map((store) => [store, []]))
}

function backupBlob(
  stores: Record<string, unknown[]>,
  schemaVersion = EXPORT_SCHEMA_VERSION,
): Blob {
  return new Blob([
    JSON.stringify({
      schemaVersion,
      exportedAt: Date.now(),
      stores: { ...emptyStores(), ...stores },
    }),
  ])
}

describe('Workspace.importAll', () => {
  it('replaces every store with the file’s records (pre-existing data gone)', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await tradeBook.registries.institutions.save({ id: 'inst-old', name: 'Old Broker' })

    await workspace.importAll(
      backupBlob({ institutions: [{ id: 'inst-new', name: 'New Broker' }] }),
    )

    const institutions = await tradeBook.registries.institutions.list()
    expect(institutions.map((i) => i.name)).toEqual(['New Broker'])
  })

  it('reports per-store restored counts', async () => {
    const { workspace } = makeWorkspace()

    const report = await workspace.importAll(
      backupBlob({
        institutions: [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ],
      }),
    )

    expect(report.schemaVersion).toBe(EXPORT_SCHEMA_VERSION)
    expect(report.counts.institutions).toBe(2)
    expect(report.counts.accounts).toBe(0)
  })

  it('rejects a file with an unknown or newer schemaVersion, changing nothing', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await tradeBook.registries.institutions.save({ id: 'inst-old', name: 'Old Broker' })

    await expect(workspace.importAll(backupBlob({}, EXPORT_SCHEMA_VERSION + 1))).rejects.toThrow()

    expect((await tradeBook.registries.institutions.list()).map((i) => i.name)).toEqual([
      'Old Broker',
    ])
  })

  it('rejects a non-export JSON file, changing nothing', async () => {
    const { workspace, tradeBook } = makeWorkspace()
    await tradeBook.registries.institutions.save({ id: 'inst-old', name: 'Old Broker' })

    await expect(
      workspace.importAll(new Blob([JSON.stringify({ hello: 'world' })])),
    ).rejects.toThrow()

    expect((await tradeBook.registries.institutions.list()).map((i) => i.name)).toEqual([
      'Old Broker',
    ])
  })

  it('restores atomically (a failure mid-import leaves the prior data intact)', async () => {
    const inner = new InMemoryBinding()
    const tradeBook = new TradeBook(inner)
    const journal = new Journal(inner)
    await tradeBook.registries.institutions.save({ id: 'inst-old', name: 'Old Broker' })

    // Wraps `inner` so writes land in the same store the assertions read from,
    // but the last store's `put` throws — simulating a failure after earlier
    // stores in EXPORTED_STORES have already been wiped and reloaded.
    const faultyBinding: StorageBinding = {
      get: (store, key) => inner.get(store, key),
      put: async (store, record) => {
        if (store === 'settings') throw new Error('simulated failure')
        return inner.put(store, record)
      },
      delete: (store, key) => inner.delete(store, key),
      list: (store) => inner.list(store),
      where: (store, index, value) => inner.where(store, index, value),
      transaction: (stores, fn) => inner.transaction(stores, fn),
    }
    const workspace = new Workspace(tradeBook, journal, faultyBinding)

    await expect(
      workspace.importAll(
        backupBlob({
          institutions: [{ id: 'inst-new', name: 'New Broker' }],
          settings: [{ id: 'riskFreeRate', value: 0.05 }],
        }),
      ),
    ).rejects.toThrow('simulated failure')

    const institutions = await tradeBook.registries.institutions.list()
    expect(institutions.map((i) => i.name)).toEqual(['Old Broker'])
  })

  it('leaves restored pricing sources as needs-key', async () => {
    const { workspace } = makeWorkspace()

    await workspace.importAll(
      backupBlob({
        settings: [{ id: 'pricingSources', value: [{ id: 'marketdata.app', enabled: true }] }],
      }),
    )

    const sources = await workspace.settings.get('pricingSources')
    expect(sources).toEqual([{ id: 'marketdata.app', enabled: true }])
    expect(sources[0].apiKey).toBeUndefined()
  })
})

function makeStorageManager(overrides: Partial<StorageManager> = {}): StorageManager {
  return {
    persisted: async () => false,
    persist: async () => false,
    estimate: async () => ({ usage: 0, quota: 0 }),
    ...overrides,
  }
}

describe('Workspace.storageHealth', () => {
  it('reports persisted true/false from the storage manager', async () => {
    const binding = new InMemoryBinding()
    const workspace = new Workspace(
      new TradeBook(binding),
      new Journal(binding),
      binding,
      makeStorageManager({ persisted: async () => true }),
    )
    expect((await workspace.storageHealth()).persisted).toBe(true)
  })

  it('reports usage and quota bytes', async () => {
    const binding = new InMemoryBinding()
    const workspace = new Workspace(
      new TradeBook(binding),
      new Journal(binding),
      binding,
      makeStorageManager({ estimate: async () => ({ usage: 12345, quota: 999999 }) }),
    )
    const health = await workspace.storageHealth()
    expect(health.usageBytes).toBe(12345)
    expect(health.quotaBytes).toBe(999999)
  })

  it('reports lastExportAt, or absent when never exported', async () => {
    const { workspace } = makeWorkspace()
    expect((await workspace.storageHealth()).lastExportAt).toBeUndefined()
    await workspace.exportAll()
    expect((await workspace.storageHealth()).lastExportAt).toBeDefined()
  })
})

describe('Workspace.requestPersistence', () => {
  it("returns the browser's grant/deny verdict", async () => {
    const binding = new InMemoryBinding()
    const granted = new Workspace(
      new TradeBook(binding),
      new Journal(binding),
      binding,
      makeStorageManager({ persist: async () => true }),
    )
    expect(await granted.requestPersistence()).toBe(true)

    const denied = new Workspace(
      new TradeBook(binding),
      new Journal(binding),
      binding,
      makeStorageManager({ persist: async () => false }),
    )
    expect(await denied.requestPersistence()).toBe(false)
  })

  it('is reflected by storageHealth afterward', async () => {
    let persisted = false
    const binding = new InMemoryBinding()
    const workspace = new Workspace(
      new TradeBook(binding),
      new Journal(binding),
      binding,
      makeStorageManager({
        persist: async () => {
          persisted = true
          return true
        },
        persisted: async () => persisted,
      }),
    )
    expect((await workspace.storageHealth()).persisted).toBe(false)
    await workspace.requestPersistence()
    expect((await workspace.storageHealth()).persisted).toBe(true)
  })
})
