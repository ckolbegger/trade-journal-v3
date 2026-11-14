import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { exportSnapshot, exportWorkspaceSection } from './export.ts';
import { D7_CATALOG_MANIFEST } from './manifest.ts';
import { applyPreparedRestore, measureCandidateSection, prepareRestore, type RestoreLine } from './restore.ts';

// W7's stores, as stored.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stores = dump.databases['tj-ws-fx-0013']!.stores;

// A7's Catalog and Workspace records: W7's through T8.2's exporters (A7's committed fixture is T8.17's).
const exported = (): Record<string, unknown>[] => {
  const batch: ExportBatch = { store: 'catalog', records: stores['catalog']!.records };
  return structuredClone(exportSnapshot(batch)!.records) as Record<string, unknown>[];
};
const workspace = (): Record<string, unknown>[] => structuredClone(exportWorkspaceSection(stores['meta']!.records, { catalog: D7_CATALOG_MANIFEST.version, journal: 5 }).records) as Record<string, unknown>[];
const linesOf = (records: readonly unknown[]): RestoreLine[] => records.map((record, i) => ({ line: i + 3, record }));
const preparation = prepareRestore({ manifest: D7_CATALOG_MANIFEST });

describe('record parsing at schema 7 (P31)', () => {
  it('should accept every A7 record of its module and reject an extra field, a missing field, and a price that is a number rather than a decimal string as MalformedRecord naming the line and path', () => {
    const records = exported();
    expect(new Set(records.map((r) => r['kind']))).toEqual(new Set(['Institution', 'Account', 'Strategy', 'CloseReason']));
    expect(preparation.parse('catalog', linesOf(records))).toEqual({ kind: 'Parsed', records });
    expect(preparation.parse('meta', linesOf(workspace()))).toEqual({ kind: 'Parsed', records: workspace() });

    const extra = exported();
    extra[10]!['revision'] = 3;
    expect(preparation.parse('catalog', linesOf(extra))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 13, store: 'catalog', path: 'revision' }] });

    const missing = exported();
    const strategy = missing.findIndex((r) => r['kind'] === 'Strategy');
    delete missing[strategy]!['shape'];
    expect(preparation.parse('catalog', linesOf(missing))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: strategy + 3, store: 'catalog', path: 'shape' }] });

    // The Catalog holds no price; its string-field analog is a label given as a number.
    const numeric = exported();
    numeric[0]!['label'] = 5;
    expect(preparation.parse('catalog', linesOf(numeric))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 3, store: 'catalog', path: 'label' }] });

    // The Workspace record carries no content revision counter.
    const counter = workspace();
    counter[0]!['catalogRevision'] = 6;
    expect(preparation.parse('meta', linesOf(counter))).toEqual({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', line: 3, store: 'meta', path: 'catalogRevision' }] });
  });
});

describe('applyPreparedRestore recheck (A135)', () => {
  it('should accept a candidate section whose counts and digest equal those recorded in the candidate meta, and return CandidateChanged naming catalog when one record was removed from the candidate after preparation', async () => {
    const candidate = () => ({ catalog: exported() });
    const recorded = await measureCandidateSection(recordSourceOf(candidate()));
    expect(recorded.counts).toEqual({ catalog: stores['catalog']!.records.length });
    // The same records read in other batch sizes give the same digest.
    expect(await measureCandidateSection(recordSourceOf(candidate(), 5))).toEqual(recorded);
    expect(await applyPreparedRestore(recordSourceOf(candidate()), recorded)).toEqual({ kind: 'Accepted' });

    const removed = candidate();
    removed.catalog = removed.catalog.slice(1);
    expect(await applyPreparedRestore(recordSourceOf(removed), recorded)).toEqual({ kind: 'CandidateChanged', store: 'catalog' });
    // A changed field with the same count is caught by the digest.
    const edited = candidate();
    edited.catalog[0]!['active'] = false;
    expect(await applyPreparedRestore(recordSourceOf(edited), recorded)).toEqual({ kind: 'CandidateChanged', store: 'catalog' });
  });
});
