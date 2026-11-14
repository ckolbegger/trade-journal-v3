// Workspace.exportBackup (D8 T8.4), on W7 and its schema-5 sibling, through the in-process export port.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'fflate';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { readArtifact, type ArtifactLine } from '../../backup/format/index.ts';
import type { Persistence } from '../../persistence/index.ts';
import { createBackupOperations } from './backup.ts';
import { createWorkspace } from './index.ts';

const W7 = JSON.parse(readFileSync('tests/fixtures/workspace-v7/dump.json', 'utf8')) as WorkspaceDump;
const W7_DATABASE = 'tj-ws-fx-0013';
// Friday 2026-11-20 18:00 in New York.
const EXPORT_AT = '2026-11-20T23:00:00Z';
const AUTHORITATIVE = ['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'] as const;

async function w7Stack() {
  const stack = await testStack(await loadDump(W7), EXPORT_AT);
  const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
  return { ...stack, workspace };
}

async function linesOf(bytes: Uint8Array): Promise<ArtifactLine[]> {
  const lines: ArtifactLine[] = [];
  for await (const line of readArtifact(new Blob([bytes as BlobPart]))) lines.push(line);
  return lines;
}

describe('Downloaded (AC-BACK-001)', () => {
  it('should return Downloaded for W7 with the source binding, full and manifest digests, file name trade-journal-2026-11-20-1800-<8 hex>.tjbackup, per-store counts, and byte size, hand exactly that file to the host once, and leave the content revision unchanged', async () => {
    const { workspace, factory, testHost } = await w7Stack();
    const before = await dumpAll(factory);
    const result = await workspace.exportBackup({});
    if (result.kind !== 'Downloaded') throw new Error(`expected Downloaded, got ${JSON.stringify(result)}`);
    const stored = before[W7_DATABASE]!;
    const contentRevision = (stored['meta'] as Record<string, unknown>[]).find((record) => record['key'] === 'content')!['contentRevision'];
    expect(result.sourceBinding).toEqual({ databaseName: W7_DATABASE, contentRevision });
    expect(result.counts).toEqual(Object.fromEntries(AUTHORITATIVE.map((store) => [store, stored[store]!.length])));
    const offered = testHost.downloads.offered;
    expect(offered).toHaveLength(1);
    const file = offered[0]!;
    expect(file.type).toBe('application/octet-stream');
    expect(file.bytes.length).toBe(result.byteSize);
    const lines = await linesOf(file.bytes);
    const manifest = lines[lines.length - 1]!;
    if (manifest.kind !== 'manifest') throw new Error('last line is not the manifest');
    expect(result.fullDigest).toBe(manifest.computedFullDigest);
    expect(result.manifestDigest).toBe(manifest.computedManifestDigest);
    expect(result.fullDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.fileName).toBe(`trade-journal-2026-11-20-1800-${result.fullDigest.slice(0, 8)}.tjbackup`);
    expect(file.fileName).toBe(result.fileName);
    // The file is the gzip of its lines, and the export wrote nothing.
    expect(gunzipSync(file.bytes).length).toBeGreaterThan(0);
    expect(await dumpAll(factory)).toEqual(before);
  });

  it('should write a manifest with formatVersion 1, schemaVersion 7, export kind Normal, the footprint, counts, section digests, full digest, and the exclusions of A125', async () => {
    const { workspace, factory, testHost } = await w7Stack();
    const stored = (await dumpAll(factory))[W7_DATABASE]!;
    const result = await workspace.exportBackup({});
    if (result.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const lines = await linesOf(testHost.downloads.offered[0]!.bytes);
    const manifest = lines[lines.length - 1]!;
    if (manifest.kind !== 'manifest') throw new Error('last line is not the manifest');
    expect(manifest.value).toEqual({
      kind: 'manifest',
      formatVersion: 1,
      schemaVersion: 7,
      exportKind: 'Normal',
      // W7 holds every data kind A126 lists at schema 7.
      footprint: [
        'catalog.account',
        'catalog.closeReason',
        'catalog.institution',
        'catalog.strategy',
        'condition.structureValue',
        'instrument.option',
        'instrument.stock',
        'journal.debt',
        'journal.decline',
        'journal.entry',
        'marketData.acknowledgment',
        'marketData.mark',
        'plan.exerciseIntent',
        'positionChange.execution',
        'positionChange.expiration',
        'trade.closeReason',
        'trade.deviation.entrySize',
      ],
      counts: Object.fromEntries(AUTHORITATIVE.map((store) => [store, stored[store]!.length])),
      sectionDigests: manifest.computedSectionDigests,
      fullDigest: manifest.computedFullDigest,
      exclusions: expect.arrayContaining([
        'root',
        'journalObligations',
        'indexes',
        'trades.exposureStart',
        'trades.terminalTime',
        'trades.activityDesc',
        'trades.terminalDesc',
        'contentRevision',
        'record.revision',
        'credentials',
        'unsavedForms',
        'rawProviderPayloads',
        'diagnostics',
        'reports',
        'replayProjections',
        'cursors',
      ]) as unknown,
    });
    expect(Object.keys(manifest.computedSectionDigests)).toEqual(['workspace', 'catalog', 'marketData', 'trades', 'journal']);
    expect(manifest.value['fullDigest']).toBe(result.fullDigest);
  });
});

describe('failures', () => {
  it('should return Conflict with the current binding and offer no file when the expected binding differs', async () => {
    const { workspace, factory, testHost } = await w7Stack();
    const before = await dumpAll(factory);
    const current = (await workspace.exportBackup({})) as { sourceBinding: { databaseName: string; contentRevision: number } };
    const stale = { databaseName: W7_DATABASE, contentRevision: current.sourceBinding.contentRevision - 1 };
    expect(await workspace.exportBackup({ expectedBinding: stale })).toEqual({ kind: 'Conflict', currentBinding: current.sourceBinding });
    expect(await workspace.exportBackup({ expectedBinding: { ...current.sourceBinding, databaseName: 'tj-ws-other' } })).toEqual({ kind: 'Conflict', currentBinding: current.sourceBinding });
    // Only the first, matching export offered a file.
    expect(testHost.downloads.offered).toHaveLength(1);
    expect(await dumpAll(factory)).toEqual(before);
  });

  it('should return NotCompleted Read with the unchanged binding and offer no file when the snapshot read fails', async () => {
    const stack = await w7Stack();
    const before = await dumpAll(stack.factory);
    const failing = { ...stack.persistence, readExportSnapshot: () => Promise.resolve({ kind: 'ReadFailed', store: 'trades' } as const) };
    const workspace = createWorkspace({ ...stack, persistence: failing, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    const contentRevision = (before[W7_DATABASE]!['meta'] as Record<string, unknown>[]).find((record) => record['key'] === 'content')!['contentRevision'];
    expect(await workspace.exportBackup({})).toEqual({
      kind: 'NotCompleted',
      stage: 'Read',
      reason: 'ReadFailed',
      workspaceBinding: { databaseName: W7_DATABASE, contentRevision },
    });
    expect(stack.testHost.downloads.offered).toEqual([]);
    expect(await dumpAll(stack.factory)).toEqual(before);
  });

  // The snapshot reads, but the artifact cannot be built from what was read.
  async function expectReadFailedWith(alter: (read: Persistence['readExportSnapshot']) => Persistence['readExportSnapshot']) {
    const stack = await w7Stack();
    const before = await dumpAll(stack.factory);
    const altered = { ...stack.persistence, readExportSnapshot: alter(stack.persistence.readExportSnapshot.bind(stack.persistence)) };
    const workspace = createWorkspace({ ...stack, persistence: altered, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    const contentRevision = (before[W7_DATABASE]!['meta'] as Record<string, unknown>[]).find((record) => record['key'] === 'content')!['contentRevision'];
    expect(await workspace.exportBackup({})).toEqual({
      kind: 'NotCompleted',
      stage: 'Read',
      reason: 'ReadFailed',
      workspaceBinding: { databaseName: W7_DATABASE, contentRevision },
    });
    expect(stack.testHost.downloads.offered).toEqual([]);
    expect(await dumpAll(stack.factory)).toEqual(before);
  }

  it('should report ReadFailed when a record can not be written into the backup', async () => {
    await expectReadFailedWith((read) => (database, layout, onBatch) =>
      read(database, layout, (batch) => onBatch({ ...batch, records: batch.records.map((record, index) => (index === 0 ? { ...record, unsafe: 2 ** 60 } : record)) })),
    );
  });

  it('should report ReadFailed when the Workspace has no settings record', async () => {
    await expectReadFailedWith((read) => async (database, layout, onBatch) => {
      const result = await read(database, layout, onBatch);
      return result.kind === 'Read' ? { ...result, meta: result.meta.filter((record) => record['key'] !== 'settings') } : result;
    });
  });

  it('should report NotCompleted when the download offer rejects', async () => {
    const stack = await w7Stack();
    const before = await dumpAll(stack.factory);
    const download = { offer: () => Promise.reject(new Error('offer blew up')) };
    const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download } });
    const contentRevision = (before[W7_DATABASE]!['meta'] as Record<string, unknown>[]).find((record) => record['key'] === 'content')!['contentRevision'];
    expect(await workspace.exportBackup({})).toEqual({
      kind: 'NotCompleted',
      stage: 'Offer',
      reason: 'OfferFailed',
      workspaceBinding: { databaseName: W7_DATABASE, contentRevision },
    });
    expect(await dumpAll(stack.factory)).toEqual(before);
  });

  it('should report ReadFailed when the export run rejects', async () => {
    const stack = await w7Stack();
    const before = await dumpAll(stack.factory);
    const exporter = { run: () => Promise.reject(new Error('run blew up')) };
    const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port, export: exporter } });
    const contentRevision = (before[W7_DATABASE]!['meta'] as Record<string, unknown>[]).find((record) => record['key'] === 'content')!['contentRevision'];
    expect(await workspace.exportBackup({})).toEqual({
      kind: 'NotCompleted',
      stage: 'Read',
      reason: 'ReadFailed',
      workspaceBinding: { databaseName: W7_DATABASE, contentRevision },
    });
    expect(stack.testHost.downloads.offered).toEqual([]);
  });

  it('should report ReadFailed when the journal storage lookup rejects', async () => {
    const stack = await w7Stack();
    const failing = { ...stack.persistence, lookupRoot: () => Promise.reject(new Error('lookup blew up')) };
    const workspace = createWorkspace({ ...stack, persistence: failing, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    expect(await workspace.exportBackup({})).toEqual({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: null });
    expect(stack.testHost.downloads.offered).toEqual([]);
  });
});

describe('export touches neither the root nor any store (A128, A129)', () => {
  it('should leave a listed Restore candidate in place when a backup is made', async () => {
    const { workspace, factory, persistence } = await w7Stack();
    const { databaseName: candidate } = await persistence.createCandidate();
    const before = await dumpAll(factory);
    expect(JSON.stringify(Object.values(before['tj-root'] ?? {}))).toContain(candidate);
    expect((await workspace.exportBackup({})).kind).toBe('Downloaded');
    const after = await dumpAll(factory);
    expect(Object.keys(after)).toContain(candidate);
    expect(after).toEqual(before);
  });

  it('should leave an unlisted Workspace database in place when a backup is made', async () => {
    const { workspace, factory } = await w7Stack();
    await new Promise<void>((resolve, reject) => {
      const open = factory.open('tj-ws-stray', 1);
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    const before = await dumpAll(factory);
    expect((await workspace.exportBackup({})).kind).toBe('Downloaded');
    expect(await dumpAll(factory)).toEqual(before);
    expect(Object.keys(await dumpAll(factory))).toContain('tj-ws-stray');
  });
});

describe('export before any journal exists (A129)', () => {
  it('should create no database when a backup is attempted before any journal exists', async () => {
    const stack = await testStack(new IDBFactory(), EXPORT_AT);
    const { factory } = stack;
    // The stack's startup inspection created the root; remove it so the factory is empty again.
    await new Promise<void>((resolve, reject) => {
      const request = factory.deleteDatabase('tj-root');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('delete failed'));
    });
    expect(await factory.databases()).toEqual([]);
    const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    expect(await workspace.exportBackup({})).toEqual({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', workspaceBinding: null });
    expect(await factory.databases()).toEqual([]);
  });
});

describe('blocked databases (P32)', () => {
  it('should export a Migration Blocked schema-5 database as export kind BlockedDatabase with schemaVersion 5 and the schema-5 layout, and return NotCompleted IntegrityBlocked for an unreadable root without opening it', async () => {
    const V5 = JSON.parse(readFileSync('tests/fixtures/workspace-v5/dump.json', 'utf8')) as WorkspaceDump;
    const V5_DATABASE = 'tj-ws-fx-0010';
    const dump = structuredClone(V5);
    // A Trade naming an unknown Account fails the migration's validation.
    (dump.databases[V5_DATABASE]!.stores['trades']!.records[0] as Record<string, unknown>)['accountId'] = 'fx-unknown';
    const stack = await testStack(await loadDump(dump), '2026-10-20T22:00:00Z');
    const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    expect((await workspace.initialize({})).kind).toBe('MigrationBlocked');
    const before = await dumpAll(stack.factory);
    const result = await workspace.exportBackup({});
    if (result.kind !== 'Downloaded') throw new Error(`expected Downloaded, got ${JSON.stringify(result)}`);
    const stored = before[V5_DATABASE]!;
    expect(result.sourceBinding).toEqual({ databaseName: V5_DATABASE, contentRevision: 48 });
    expect(result.counts).toEqual(Object.fromEntries(AUTHORITATIVE.map((store) => [store, stored[store]!.length])));
    const lines = await linesOf(stack.testHost.downloads.offered[0]!.bytes);
    const header = lines[0]!;
    if (header.kind !== 'header') throw new Error('first line is not the header');
    expect(header.value).toEqual(expect.objectContaining({ formatVersion: 1, schemaVersion: 5, exportKind: 'BlockedDatabase', sourceBinding: { databaseName: V5_DATABASE, contentRevision: 48 } }));
    const manifest = lines[lines.length - 1]!;
    if (manifest.kind !== 'manifest') throw new Error('last line is not the manifest');
    expect(manifest.value).toEqual(expect.objectContaining({ schemaVersion: 5, exportKind: 'BlockedDatabase' }));
    // Schema 5 was seeded with Catalog manifest 2 and Journal manifest 5.
    const workspaceRecord = JSON.parse(lines.find((line) => line.kind === 'record')!.text) as { r: Record<string, unknown> };
    expect(workspaceRecord.r['seedManifestVersions']).toEqual({ catalog: 2, journal: 5 });
    expect(await dumpAll(stack.factory)).toEqual(before);

    // An unreadable root is neither read nor opened for writing.
    const factory = new IDBFactory();
    await new Promise<void>((resolve) => {
      const open = factory.open('tj-root', 99);
      open.onupgradeneeded = () => open.result.createObjectStore('future', { keyPath: 'id' });
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
    });
    const unreadable = await testStack(factory);
    const guarded = createWorkspace({ ...unreadable, host: unreadable.testHost.host, releaseId: unreadable.testHost.releaseId, backup: { download: unreadable.testHost.downloads.port } });
    expect(await guarded.exportBackup({})).toEqual({ kind: 'NotCompleted', stage: 'Read', reason: 'IntegrityBlocked', workspaceBinding: null });
    expect(unreadable.testHost.downloads.offered).toEqual([]);
    expect((await factory.databases()).map((d) => [d.name, d.version])).toEqual([['tj-root', 99]]);
  });
});

describe('Completed (A130)', () => {
  async function downloaded() {
    const stack = await w7Stack();
    const result = await stack.workspace.exportBackup({});
    if (result.kind !== 'Downloaded') throw new Error(`expected Downloaded, got ${JSON.stringify(result)}`);
    const offered = stack.testHost.downloads.offered[0]!;
    return { ...stack, result, bytes: offered.bytes, file: new File([offered.bytes as BlobPart], offered.fileName) };
  }

  it('should return Completed for A7 with the expected binding and digest, with a receipt holding the source binding, full and manifest digests, file name, byte size, compressed true, line count, and completion instant, writing nothing', async () => {
    const { workspace, factory, result, bytes, file } = await downloaded();
    const before = await dumpAll(factory);
    const confirmed = await workspace.confirmBackup({ file, expectedBinding: result.sourceBinding, expectedFullDigest: result.fullDigest });
    if (confirmed.kind !== 'Completed') throw new Error(`expected Completed, got ${JSON.stringify(confirmed)}`);
    const lines = await linesOf(bytes);
    expect(confirmed.receipt).toEqual({
      receiptId: expect.any(String) as unknown,
      sourceBinding: result.sourceBinding,
      fullDigest: result.fullDigest,
      manifestDigest: result.manifestDigest,
      evidence: { fileName: file.name, byteSize: bytes.length, compressed: true, lineCount: lines.length },
      completedAt: EXPORT_AT,
    });
    expect(confirmed.receipt.receiptId).not.toBe('');
    expect(await dumpAll(factory)).toEqual(before);
  });
});

describe('Not Verified', () => {
  it('should return IncompleteOrCorrupt for R-cut and for R-flip, DifferentArtifact for a second export of W7 made after one Mark save, and Unreadable when the file read fails, each with no receipt', async () => {
    const stack = await w7Stack();
    const { workspace, testHost } = stack;
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const a7 = testHost.downloads.offered[0]!.bytes;
    const confirm = (file: File) => workspace.confirmBackup({ file, expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest });

    const cut = new File([a7.slice(0, Math.floor(a7.length / 2))], 'cut.tjbackup');
    expect(await confirm(cut)).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt' });

    const flipped = a7.slice();
    flipped[Math.floor(flipped.length / 2)]! ^= 0xff;
    expect(await confirm(new File([flipped as BlobPart], 'flip.tjbackup'))).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt' });

    const saved = await stack.marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'XYZ', tradingDate: '2026-11-19', price: '52', expectedResolutionRevision: 'None' });
    expect(saved.kind).toBe('Saved');
    const second = await workspace.exportBackup({});
    if (second.kind !== 'Downloaded') throw new Error('expected Downloaded');
    expect(second.fullDigest).not.toBe(first.fullDigest);
    const other = testHost.downloads.offered[1]!;
    expect(await confirm(new File([other.bytes as BlobPart], other.fileName))).toEqual({ kind: 'NotVerified', reason: 'DifferentArtifact' });

    const unreadable = new File([a7 as BlobPart], 'a7.tjbackup');
    unreadable.stream = () =>
      new ReadableStream<Uint8Array<ArrayBuffer>>({
        pull() {
          throw new Error('read failed');
        },
      });
    expect(await confirm(unreadable)).toEqual({ kind: 'NotVerified', reason: 'Unreadable' });
  });
});

describe('receipt registry (A131)', () => {
  it('should recognize a receipt issued by this instance, and not one issued before a restart on the same storage', async () => {
    const stack = await w7Stack();
    const deps = { ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } };
    const before = createBackupOperations(deps);
    const result = await before.exportBackup({});
    if (result.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const offered = stack.testHost.downloads.offered[0]!;
    const confirmed = await before.confirmBackup({ file: new File([offered.bytes as BlobPart], offered.fileName), expectedBinding: result.sourceBinding, expectedFullDigest: result.fullDigest });
    if (confirmed.kind !== 'Completed') throw new Error('expected Completed');
    expect(before.recognizesReceipt(confirmed.receipt.receiptId)).toBe(true);
    expect(before.recognizesReceipt('not-issued')).toBe(false);
    // A restart is a new application instance on the same storage.
    expect(createBackupOperations(deps).recognizesReceipt(confirmed.receipt.receiptId)).toBe(false);
  });
});
