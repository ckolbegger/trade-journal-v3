import type { Entry } from '@/books/journal/types'

// Addenda can themselves receive addenda; the growth story reads as a flat
// layer of addenda under the root entry they grew from, no matter how deep
// the chain runs (docs/plan/slice-02-journal-timeline.md — "rendering
// flattens the chain under the root entry"). UI-only presentation logic: it
// groups entries a page already fetched, nothing more.

export interface EntryThread {
  root: Entry
  addenda: Entry[] // every descendant, any depth, flattened, 'at' order
}

export function buildEntryThreads(entries: Entry[]): EntryThread[] {
  const byId = new Map(entries.map((e) => [e.id, e]))

  function rootOf(entry: Entry): Entry {
    let current = entry
    while (current.anchor.kind === 'entry') {
      const parent = byId.get(current.anchor.entryId)
      if (!parent) break
      current = parent
    }
    return current
  }

  const addendaByRoot = new Map<string, Entry[]>()
  for (const entry of entries) {
    if (entry.anchor.kind !== 'entry') continue
    const root = rootOf(entry)
    const list = addendaByRoot.get(root.id) ?? []
    list.push(entry)
    addendaByRoot.set(root.id, list)
  }

  return entries
    .filter((e) => e.anchor.kind !== 'entry')
    .map((root) => ({
      root,
      addenda: (addendaByRoot.get(root.id) ?? []).sort((a, b) => a.at - b.at),
    }))
}
