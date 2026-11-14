import type { ExportBatch } from '../../persistence/export-snapshot.ts';

// The stores the `journal` section holds (D8 A125). `journalObligations` is a private index.
export type JournalSectionStore = 'journalTypes' | 'journalDefinitions' | 'journalEntries' | 'journalDeclines' | 'journalDebts';

// One batch of the `journal` section, ready for the artifact.
export interface JournalSectionBatch {
  readonly section: 'journal';
  readonly store: JournalSectionStore;
  readonly records: readonly Record<string, unknown>[];
  // The capability identifiers (A126) the records carry; Workspace unions them across batches.
  readonly footprint: readonly string[];
}

// The data kind each outcome store's records carry (A126).
const FOOTPRINT: Readonly<Partial<Record<JournalSectionStore, string>>> = {
  journalEntries: 'journal.entry',
  journalDeclines: 'journal.decline',
  journalDebts: 'journal.debt',
};

const SECTION_STORES: ReadonlySet<string> = new Set<JournalSectionStore>(['journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts']);

// Projects one batch of a Journal store, in the order given, as stored: Entry Types and Sources,
// every definition revision, Entries and Debts with their whole version lists, and declines.
// `anchorTradeId` stays; the per-record `revision` write stamp does not (Q3). Any other store,
// the private `journalObligations` among them, is not the section's and yields nothing.
export function exportSnapshot(batch: ExportBatch): JournalSectionBatch | undefined {
  if (!SECTION_STORES.has(batch.store)) return undefined;
  const store = batch.store as JournalSectionStore;
  const records = batch.records.map((record) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== 'revision')));
  const kind = FOOTPRINT[store];
  return { section: 'journal', store, records, footprint: kind !== undefined && records.length > 0 ? [kind] : [] };
}
