import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import type { WorkspaceStore } from '../../persistence/index.ts';
import { exportSnapshot } from './export.ts';

// W7's stores, as stored: the `revision` write stamp included, and the private obligation index.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stores = dump.databases['tj-ws-fx-0013']!.stores;
const stored = (store: WorkspaceStore) => stores[store]!.records;

function batchesOf(store: WorkspaceStore, size = 5): ExportBatch[] {
  const records = stored(store);
  const batches: ExportBatch[] = [];
  for (let i = 0; i < records.length; i += size) batches.push({ store, records: records.slice(i, i + size) });
  return batches;
}

const without = (record: Record<string, unknown>, field: string) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== field));
const SECTION_STORES = ['journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'] as const;

describe('Journal section', () => {
  it('should emit Entry Types, Sources, every definition revision, every Entry with its version list, declines, and Debts with their version history, and nothing from journalObligations', () => {
    for (const store of SECTION_STORES) {
      const emitted = batchesOf(store).map((batch) => exportSnapshot(batch));
      expect(emitted.every((e) => e?.section === 'journal' && e.store === store)).toBe(true);
      const records = emitted.flatMap((e) => e!.records);
      // As stored, in key order, minus the write stamp; anchorTradeId stays (Q3).
      expect(records).toEqual(stored(store).map((record) => without(record, 'revision')));
      for (const record of records) expect(record).not.toHaveProperty('revision');
    }
    // Entry Types and Sources share the journalTypes store: W7 holds both kinds.
    expect(new Set(stored('journalTypes').map((r) => r['kind']))).toEqual(new Set(['EntryType', 'Source']));
    expect(exportSnapshot({ store: 'journalEntries', records: [{ id: 'e', anchorTradeId: 'T', versions: [{ versionNumber: 1 }, { versionNumber: 2 }], revision: 3 }] })!.records).toEqual([
      { id: 'e', anchorTradeId: 'T', versions: [{ versionNumber: 1 }, { versionNumber: 2 }] },
    ]);
    // Each outcome store reports its data kind once it holds a record.
    expect(exportSnapshot(batchesOf('journalEntries')[0]!)!.footprint).toEqual(['journal.entry']);
    expect(exportSnapshot(batchesOf('journalDeclines')[0]!)!.footprint).toEqual(['journal.decline']);
    expect(exportSnapshot(batchesOf('journalDebts')[0]!)!.footprint).toEqual(['journal.debt']);
    expect(exportSnapshot({ store: 'journalDebts', records: [] })!.footprint).toEqual([]);
    // The private obligation index is never part of the section.
    for (const batch of batchesOf('journalObligations')) expect(exportSnapshot(batch)).toBeUndefined();
    expect(stored('journalObligations').length).toBeGreaterThan(0);
  });
});
