import type { SeedManifest } from './seeds'

type Seeded = { id: string; label: string; origin: string }
type CatalogState = {
  strategies: Seeded[]
  closeReasons: Seeded[]
  abandonmentReasons: Seeded[]
  ideaSourceTagTypes: { id: string; label: string }[]
}
type JournalState = {
  entryTypes: Seeded[]
  sources: Seeded[]
}

function stableKey(label: string): string {
  return label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function addMissing(existing: Seeded[], labels: readonly string[], version: number): Seeded[] {
  if (version !== 1) throw new Error('SeedConflict')
  const out = [...existing]
  // Match by stable product key (derived from the immutable seed identity),
  // never by mutable label. A trader rename keeps the same id, so the seed is
  // recognised and not re-added.
  const present = new Set(out.map(x => x.id))
  for (const label of labels) {
    const id = `seed-${stableKey(label)}`
    if (!present.has(id)) {
      out.push({ id, label, origin: 'product' })
      present.add(id)
    }
  }
  return out
}

export function seedCatalog(catalog: CatalogState, manifest: SeedManifest): CatalogState {
  return {
    strategies: addMissing(catalog.strategies, manifest.strategies, manifest.version),
    closeReasons: addMissing(catalog.closeReasons, manifest.closeReasons, manifest.version),
    abandonmentReasons: addMissing(catalog.abandonmentReasons, manifest.abandonmentReasons, manifest.version),
    ideaSourceTagTypes: catalog.ideaSourceTagTypes.length
      ? catalog.ideaSourceTagTypes
      : [{ id: 'seed-idea-source', label: manifest.ideaSourceTagType }],
  }
}

export function seedJournal(journal: JournalState, manifest: SeedManifest): JournalState {
  return {
    entryTypes: addMissing(journal.entryTypes, manifest.entryTypes, manifest.version),
    sources: addMissing(journal.sources, manifest.sources, manifest.version),
  }
}
