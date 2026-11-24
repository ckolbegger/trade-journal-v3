import { describe, expect, it } from 'vitest'
import { seedCatalog, seedJournal } from '../../src/domain/initialize'
import { SEED_MANIFEST } from '../../src/domain/seeds'

const blank = () => ({
  strategies: [] as { id: string; label: string; origin: string }[],
  closeReasons: [] as { id: string; label: string; origin: string }[],
  abandonmentReasons: [] as { id: string; label: string; origin: string }[],
  entryTypes: [] as { id: string; label: string; origin: string }[],
  sources: [] as { id: string; label: string; origin: string }[],
  ideaSourceTagTypes: [] as { id: string; label: string }[],
})

describe('Workspace.initialize seed defaults', () => {
  it('should seed the exact eleven Strategies, reasons, types and Sources atomically', () => {
    const catalog = seedCatalog(blank(), SEED_MANIFEST)
    const journal = seedJournal(blank(), SEED_MANIFEST)
    expect(catalog.strategies.map(s => s.label)).toEqual([...SEED_MANIFEST.strategies])
    expect(catalog.closeReasons.map(s => s.label)).toEqual([...SEED_MANIFEST.closeReasons])
    expect(catalog.abandonmentReasons.map(s => s.label)).toEqual([...SEED_MANIFEST.abandonmentReasons])
    expect(journal.entryTypes.map(s => s.label)).toEqual([...SEED_MANIFEST.entryTypes])
    expect(journal.sources.map(s => s.label)).toEqual([...SEED_MANIFEST.sources])
    expect(catalog.ideaSourceTagTypes).toHaveLength(1)
  })

  it('should be idempotent and not overwrite a trader rename', () => {
    const first = seedCatalog(blank(), SEED_MANIFEST)
    first.strategies[0]!.label = 'My Long Stock'
    const second = seedCatalog(first, SEED_MANIFEST)
    expect(second.strategies[0]!.label).toBe('My Long Stock')
    expect(second.strategies).toHaveLength(11)
  })

  it('should keep stable product identities across repeated seeding', () => {
    const first = seedCatalog(blank(), SEED_MANIFEST)
    const second = seedCatalog(first, SEED_MANIFEST)
    expect(second.strategies.map(s => s.id)).toEqual(first.strategies.map(s => s.id))
  })

  it('should reject an incompatible seed version without writing', () => {
    expect(() => seedCatalog(blank(), { ...SEED_MANIFEST, version: 99 })).toThrow('SeedConflict')
  })
})
