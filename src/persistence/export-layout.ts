import type { WorkspaceStore } from './schema.ts';

// What a backup of one schema version holds: its authoritative stores, in section order, and the
// private fields to omit from their records (D8 A125, A149). `meta` is always read, and its records
// are the Workspace section.
export interface ExportLayout {
  readonly schemaVersion: number;
  readonly stores: readonly WorkspaceStore[];
  readonly privateFields: Readonly<Partial<Record<WorkspaceStore, readonly string[]>>>;
}

// The private Trade fields the rebuild derives (D8 A125). Omitting a field a version never stored
// changes nothing, so every version lists all four.
const PRIVATE_TRADE_FIELDS = ['exposureStart', 'terminalTime', 'activityDesc', 'terminalDesc'] as const;

// Stores each schema version added, in A125's section order: Catalog, Market Data, Trades, Journal.
// `journalObligations` is a private index at every version, so no layout lists it.
const STORES_BY_VERSION: Readonly<Record<number, readonly WorkspaceStore[]>> = {
  1: ['catalog', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries'],
  2: ['catalog', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines'],
  3: ['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines'],
  4: ['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'],
  5: ['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'],
  6: ['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'],
  7: ['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'],
};

// The layout of a schema version this release can read, or undefined when it has none.
export function exportLayoutFor(schemaVersion: number): ExportLayout | undefined {
  const stores = STORES_BY_VERSION[schemaVersion];
  return stores && { schemaVersion, stores, privateFields: { trades: PRIVATE_TRADE_FIELDS } };
}
