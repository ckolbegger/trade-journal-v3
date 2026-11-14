import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ExportBatch } from '../../persistence/export-snapshot.ts';
import { exportSnapshot, exportWorkspaceSection } from './export.ts';

// W7's Catalog and `meta` records, as stored.
const dump = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as {
  databases: Record<string, { stores: Record<string, { records: Record<string, unknown>[] }> }>;
};
const stores = dump.databases['tj-ws-fx-0013']!.stores;
const stored = stores['catalog']!.records;
const meta = stores['meta']!.records;

function batchesOf(records: readonly Record<string, unknown>[], size = 4): ExportBatch[] {
  const batches: ExportBatch[] = [];
  for (let i = 0; i < records.length; i += size) batches.push({ store: 'catalog', records: records.slice(i, i + size) });
  return batches;
}

describe('Catalog and Workspace sections', () => {
  it('should emit every Institution, Account, Strategy, and Close Reason with origin, label and availability revisions, immutable shape, and seed key, and a workspace record with the time zone, settings revision, seed-manifest versions, and session-policy identity, but neither content revision counter', () => {
    const batches = batchesOf(stored).map((batch) => exportSnapshot(batch)!);
    expect(batches.every((b) => b.section === 'catalog' && b.store === 'catalog')).toBe(true);
    const emitted = batches.flatMap((b) => b.records);
    expect(emitted).toEqual(stored.map((record) => Object.fromEntries(Object.entries(record).filter(([name]) => name !== 'revision'))));
    for (const record of emitted) expect(record).not.toHaveProperty('revision');
    expect(new Set(emitted.map((r) => r['kind']))).toEqual(new Set(['Institution', 'Account', 'Strategy', 'CloseReason']));
    expect(emitted.find((r) => r['kind'] === 'Strategy')).toMatchObject({ origin: 'Seeded', label: 'Long Stock', recordRevision: 1, active: true, productKey: 'strategy.long-stock', shape: { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] } });
    expect(new Set(batches.flatMap((b) => b.footprint))).toEqual(new Set(['catalog.institution', 'catalog.account', 'catalog.strategy', 'catalog.closeReason']));

    const workspace = exportWorkspaceSection(meta, { catalog: 3, journal: 5 });
    expect(workspace.section).toBe('workspace');
    expect(workspace.records).toEqual([
      {
        key: 'workspace',
        timeZone: 'America/New_York',
        settingsRevision: 1,
        seedManifestVersions: { catalog: 3, journal: 5 },
        sessionPolicy: { id: 'nyse', revision: 1, digest: '13ff3ef725e71414e2f9bed388b5b59c81964d2ffbd77db2c9a75443b859998b', coverage: { first: '2024-01-01', last: '2028-12-31' } },
      },
    ]);
    // Neither content revision counter, and no other meta record, is carried.
    const text = JSON.stringify(workspace.records);
    for (const counter of ['catalogRevision', 'journalRevision', 'contentRevision', 'tradeRecord', '"revision":6']) expect(text).not.toContain(counter);
    expect(JSON.stringify(meta)).toContain('catalogRevision');
  });
});
