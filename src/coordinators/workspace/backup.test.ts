// Workspace.exportBackup (D8 T8.4), on W7 and its schema-5 sibling, through the in-process export port.
import { readFileSync } from 'node:fs';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { gunzipSync, gzipSync } from 'fflate';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { loadDump, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { ArtifactWriter, readArtifact, type ArtifactLine } from '../../backup/format/index.ts';
import { exportLayoutFor, type Persistence } from '../../persistence/index.ts';
import { runExport } from './backup-export.ts';
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

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

type EditableArtifact = { readonly lines: string[]; readonly manifest: { sectionDigests: Record<string, string>; fullDigest: string } & Record<string, unknown> };

// Rebuilds a well-compressed artifact from a real export: the edit changes the lines before the manifest or the manifest fields, then the full digest and gzip are recomputed.
// Section digests, counts, and the header stay the edit's responsibility, so a case reaches the check it targets rather than failing at decompression or on the full digest.
function editedArtifact(bytes: Uint8Array, edit: (artifact: EditableArtifact) => void): { readonly bytes: Uint8Array; readonly fullDigest: string } {
  const all = new TextDecoder().decode(gunzipSync(bytes)).split('\n');
  all.pop();
  const manifest = JSON.parse(all.pop()!) as EditableArtifact['manifest'];
  const artifact: EditableArtifact = { lines: all, manifest };
  edit(artifact);
  const fullDigest = bytesToHex(sha256(new TextEncoder().encode(artifact.lines.map((l) => `${l}\n`).join(''))));
  manifest.fullDigest = fullDigest;
  const text = [...artifact.lines, canonical(manifest)].map((l) => `${l}\n`).join('');
  return { bytes: gzipSync(new TextEncoder().encode(text)), fullDigest };
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

// A failure detail that has at least these fields (the stack and the rest are not pinned).
const detailLike = (fields: Record<string, unknown>): unknown => expect.objectContaining(fields);

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
      detail: detailLike({ stage: 'Read', name: 'ReadFailed' }),
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
      detail: detailLike({ stage: 'Build' }),
    });
    expect(stack.testHost.downloads.offered).toEqual([]);
    expect(await dumpAll(stack.factory)).toEqual(before);
  }

  it('should report ReadFailed when a record can not be written into the backup', async () => {
    await expectReadFailedWith((read) => (database, layout, onBatch, onStart) =>
      read(database, layout, (batch) => onBatch({ ...batch, records: batch.records.map((record, index) => (index === 0 ? { ...record, unsafe: 2 ** 60 } : record)) }), onStart),
    );
  });

  it('should report ReadFailed when the Workspace has no settings record', async () => {
    await expectReadFailedWith((read) => async (database, layout, onBatch, onStart) => {
      const result = await read(database, layout, onBatch, onStart);
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
      detail: detailLike({ stage: 'Offer', message: 'offer blew up' }),
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
      detail: detailLike({ stage: 'Read', message: 'run blew up' }),
    });
    expect(stack.testHost.downloads.offered).toEqual([]);
  });

  it("should carry the caught error's name, message and stack in NotCompleted when building the backup fails", async () => {
    const stack = await w7Stack();
    const altered = {
      ...stack.persistence,
      readExportSnapshot: async (database: string, layout: Parameters<Persistence['readExportSnapshot']>[1], onBatch: Parameters<Persistence['readExportSnapshot']>[2], onStart: Parameters<Persistence['readExportSnapshot']>[3]) => {
        const result = await stack.persistence.readExportSnapshot(
          database,
          layout,
          (batch) => onBatch({ ...batch, records: batch.records.map((record, index) => (index === 0 ? { ...record, unsafe: 2 ** 60 } : record)) }),
          onStart,
        );
        return result;
      },
    };
    const workspace = createWorkspace({ ...stack, persistence: altered, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    const result = await workspace.exportBackup({});
    expect(result.kind).toBe('NotCompleted');
    const detail = (result as { detail?: { stage: string; name: string; message: string; stack?: string } }).detail;
    expect(detail?.stage).toBe('Build');
    expect(detail?.name).toBe('CanonicalJsonUnsupported');
    expect(detail?.message.length).toBeGreaterThan(0);
    expect(detail?.stack).toContain('CanonicalJsonUnsupported');
  });

  it("should leave record values out of the failure detail when a record can't be written", async () => {
    const stack = await w7Stack();
    const altered = {
      ...stack.persistence,
      readExportSnapshot: async (database: string, layout: Parameters<Persistence['readExportSnapshot']>[1], onBatch: Parameters<Persistence['readExportSnapshot']>[2], onStart: Parameters<Persistence['readExportSnapshot']>[3]) =>
        stack.persistence.readExportSnapshot(
          database,
          layout,
          (batch) => onBatch({ ...batch, records: batch.records.map((record, index) => (index === 0 ? { ...record, unsafe: 7654321.123456 } : record)) }),
          onStart,
        ),
    };
    const workspace = createWorkspace({ ...stack, persistence: altered, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    const result = await workspace.exportBackup({});
    expect(result.kind).toBe('NotCompleted');
    const detail = (result as { detail?: unknown }).detail;
    expect(JSON.stringify(detail)).toContain('CanonicalJsonUnsupported');
    expect(JSON.stringify(detail)).not.toContain('7654321');
  });

  it('should carry the failing store in NotCompleted when the read fails', async () => {
    const stack = await w7Stack();
    const failing = { ...stack.persistence, readExportSnapshot: () => Promise.resolve({ kind: 'ReadFailed', store: 'trades' } as const) };
    const workspace = createWorkspace({ ...stack, persistence: failing, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    const result = await workspace.exportBackup({});
    expect(result).toMatchObject({ kind: 'NotCompleted', detail: { stage: 'Read', name: 'ReadFailed', context: { store: 'trades' } } });
  });

  it('should carry the rejection in NotCompleted when the offer rejects', async () => {
    const stack = await w7Stack();
    const download = { offer: () => Promise.reject(new TypeError('offer blew up')) };
    const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download } });
    const result = await workspace.exportBackup({});
    expect(result).toMatchObject({ kind: 'NotCompleted', stage: 'Offer', detail: { stage: 'Offer', name: 'TypeError', message: 'offer blew up' } });
    expect((result as { detail?: { stack?: string } }).detail?.stack).toContain('offer blew up');
  });

  it("should return NotCompleted when the rejection value can't be converted to text", async () => {
    const throwing = { toString: () => { throw new Error('record body secret'); } };
    for (const value of [Object.create(null), throwing]) {
      const stack = await w7Stack();
      const download = { offer: () => Promise.reject(value as Error) }; // typed as Error only to satisfy lint; the value is not one
      const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download } });
      const result = await workspace.exportBackup({});
      expect(result).toMatchObject({ kind: 'NotCompleted', stage: 'Offer', detail: { stage: 'Offer', name: 'NonError', message: 'The failure value could not be shown' } });
      expect(JSON.stringify(result)).not.toContain('record body secret');
    }
  });

  it('should report ReadFailed when the journal storage lookup rejects', async () => {
    const stack = await w7Stack();
    const failing = { ...stack.persistence, lookupRoot: () => Promise.reject(new Error('lookup blew up')) };
    const workspace = createWorkspace({ ...stack, persistence: failing, host: stack.testHost.host, releaseId: stack.testHost.releaseId, backup: { download: stack.testHost.downloads.port } });
    expect(await workspace.exportBackup({})).toEqual({
      kind: 'NotCompleted',
      stage: 'Read',
      reason: 'ReadFailed',
      workspaceBinding: null,
      detail: detailLike({ stage: 'Read', message: 'lookup blew up' }),
    });
    expect(stack.testHost.downloads.offered).toEqual([]);
  });
});

describe('streamed export (A128, P29)', () => {
  it('should write each batch into the artifact before the next is read', async () => {
    const stack = await w7Stack();
    const written = vi.spyOn(ArtifactWriter.prototype, 'writeRecord');
    const writtenWhenDelivered: number[] = [];
    const writtenAfterDelivery: number[] = [];
    const deliveredRecords: number[] = [];
    let writtenAtEnd: number | undefined;
    try {
      const run = await runExport(
        (database, layout, onBatch, onStart) =>
          stack.persistence.readExportSnapshot(
            database,
            layout,
            (batch) => {
              writtenWhenDelivered.push(written.mock.calls.length);
              onBatch(batch);
              writtenAfterDelivery.push(written.mock.calls.length);
              deliveredRecords.push(batch.records.length);
            },
            onStart,
          ),
        { databaseName: W7_DATABASE, layout: exportLayoutFor(7)!, exportKind: 'Normal', createdAt: EXPORT_AT, releaseId: 'r', seedManifestVersions: { catalog: 1, journal: 1 } },
      );
      writtenAtEnd = written.mock.calls.length;
      expect(run.kind).toBe('Built');
    } finally {
      written.mockRestore();
    }
    // Every batch is delivered with all earlier batches already in the artifact: nothing is written
    // between one delivery returning and the next arriving, or after the last, so no record is buffered.
    expect(writtenWhenDelivered.length).toBeGreaterThan(2);
    expect(writtenAfterDelivery).toHaveLength(writtenWhenDelivered.length);
    // Each delivery writes exactly its own records (no projection drops or adds records here), so nothing is withheld for later.
    writtenWhenDelivered.forEach((before, index) => expect(writtenAfterDelivery[index]! - before).toBe(deliveredRecords[index]));
    writtenWhenDelivered.slice(1).forEach((count, index) => expect(count).toBe(writtenAfterDelivery[index]));
    expect(writtenAtEnd).toBe(writtenAfterDelivery.at(-1));
  });

  it('should name the Journal seed the exported forms hold, read in the export snapshot itself, when the job asks', async () => {
    const stack = await w7Stack();
    const run = await runExport((database, layout, onBatch, onStart) => stack.persistence.readExportSnapshot(database, layout, onBatch, onStart), {
      databaseName: W7_DATABASE,
      layout: exportLayoutFor(7)!,
      exportKind: 'Normal',
      createdAt: EXPORT_AT,
      releaseId: 'r',
      // A table entry no stored form matches: only the export's own definitions can say 5.
      seedManifestVersions: { catalog: 1, journal: 1 },
      journalSeedFromForms: true,
    });
    if (run.kind !== 'Built') throw new Error(`expected Built, got ${run.kind}`);
    const lines = await linesOf(new Uint8Array(await run.blob.arrayBuffer()));
    const workspaceRecord = JSON.parse(lines.find((line) => line.kind === 'record')!.text) as { r: Record<string, unknown> };
    expect(workspaceRecord.r['seedManifestVersions']).toEqual({ catalog: 1, journal: 5 });
  });

  it('should return Conflict before writing any record when the binding differs', async () => {
    const stack = await w7Stack();
    const current = (await stack.workspace.exportBackup({})) as { sourceBinding: { databaseName: string; contentRevision: number } };
    const written = vi.spyOn(ArtifactWriter.prototype, 'writeRecord');
    const progress = vi.fn();
    try {
      const run = await runExport((database, layout, onBatch, onStart) => stack.persistence.readExportSnapshot(database, layout, onBatch, onStart), {
        databaseName: W7_DATABASE,
        layout: exportLayoutFor(7)!,
        exportKind: 'Normal',
        createdAt: EXPORT_AT,
        releaseId: 'r',
        seedManifestVersions: { catalog: 1, journal: 1 },
        expectedBinding: { databaseName: W7_DATABASE, contentRevision: current.sourceBinding.contentRevision - 1 },
        onProgress: progress,
      });
      expect(run).toEqual({ kind: 'Conflict', currentBinding: current.sourceBinding });
      expect(written).not.toHaveBeenCalled();
      expect(progress).not.toHaveBeenCalled();
    } finally {
      written.mockRestore();
    }
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
    expect(await workspace.exportBackup({})).toEqual({
      kind: 'NotCompleted',
      stage: 'Read',
      reason: 'ReadFailed',
      workspaceBinding: null,
      detail: detailLike({ stage: 'Read', name: 'NoWorkspace' }),
    });
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
    expect(await guarded.exportBackup({})).toEqual({
      kind: 'NotCompleted',
      stage: 'Read',
      reason: 'IntegrityBlocked',
      workspaceBinding: null,
      detail: detailLike({ stage: 'Read', name: 'IntegrityBlocked', context: { rootKind: 'Unreadable' } }),
    });
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
    expect(await confirm(cut)).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify' }) });

    const flipped = a7.slice();
    flipped[Math.floor(flipped.length / 2)]! ^= 0xff;
    expect(await confirm(new File([flipped as BlobPart], 'flip.tjbackup'))).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify' }) });

    const saved = await stack.marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'XYZ', tradingDate: '2026-11-19', price: '52', expectedResolutionRevision: 'None' });
    expect(saved.kind).toBe('Saved');
    const second = await workspace.exportBackup({});
    if (second.kind !== 'Downloaded') throw new Error('expected Downloaded');
    expect(second.fullDigest).not.toBe(first.fullDigest);
    const other = testHost.downloads.offered[1]!;
    expect(await confirm(new File([other.bytes as BlobPart], other.fileName))).toEqual({ kind: 'NotVerified', reason: 'DifferentArtifact', detail: detailLike({ stage: 'Verify' }) });

    const unreadable = new File([a7 as BlobPart], 'a7.tjbackup');
    unreadable.stream = () =>
      new ReadableStream<Uint8Array<ArrayBuffer>>({
        pull() {
          throw new Error('read failed');
        },
      });
    expect(await confirm(unreadable)).toEqual({ kind: 'NotVerified', reason: 'Unreadable', detail: detailLike({ stage: 'Verify' }) });
  });
});

describe('Not Verified detail (D8 Q5)', () => {
  it('should name the failing check in the NotVerified detail when the file is incomplete or corrupt', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const a7 = testHost.downloads.offered[0]!.bytes;
    const confirmEdited = (edit: (artifact: EditableArtifact) => void) => {
      const edited = editedArtifact(a7, edit);
      return workspace.confirmBackup({ file: new File([edited.bytes as BlobPart], 'edited.tjbackup'), expectedBinding: first.sourceBinding, expectedFullDigest: edited.fullDigest });
    };

    // The header lists the sections in another order than the file ends them.
    let someRecord = '';
    const reordered = await confirmEdited(({ lines }) => {
      const header = JSON.parse(lines[0]!) as { sections: string[] };
      lines[0] = canonical({ ...header, sections: [...header.sections].reverse() });
      someRecord = lines[1]!;
    });
    // No record content in the detail.
    expect(someRecord).not.toBe('');
    expect(JSON.stringify((reordered as { detail: unknown }).detail)).not.toContain(someRecord.slice(0, 40));
    expect(reordered).toEqual({
      kind: 'NotVerified',
      reason: 'IncompleteOrCorrupt',
      detail: detailLike({ stage: 'Verify', context: expect.objectContaining({ check: 'SectionEndMismatch', line: expect.any(Number) as number }) }),
    });

    // The manifest's counts no longer match the header's.
    const counts = await confirmEdited(({ manifest }) => {
      const stored = manifest['counts'] as Record<string, number>;
      const store = Object.keys(stored)[0]!;
      stored[store] = stored[store]! + 1;
    });
    expect(counts).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify', context: expect.objectContaining({ check: 'CountsMismatch' }) }) });

    // A manifest that is not a manifest.
    const shape = await confirmEdited(({ manifest }) => void delete manifest['footprint']);
    expect(shape).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify', context: expect.objectContaining({ check: 'ManifestShape' }) }) });

    // A reader error (the file is cut): the reader's code is named, never the content.
    const cut = new File([a7.slice(0, Math.floor(a7.length / 2))], 'cut.tjbackup');
    const reader = await workspace.confirmBackup({ file: cut, expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest });
    expect(reader).toEqual({
      kind: 'NotVerified',
      reason: 'IncompleteOrCorrupt',
      detail: detailLike({ stage: 'Verify', name: 'ArtifactReadError', context: expect.objectContaining({ check: 'ReaderError', code: expect.stringMatching(/^(Truncated|Corrupt)$/) as string }) }),
    });
  });

  it('should carry the read error in the NotVerified detail when the file cannot be read', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const unreadable = new File([testHost.downloads.offered[0]!.bytes as BlobPart], 'a7.tjbackup');
    unreadable.stream = () =>
      new ReadableStream<Uint8Array<ArrayBuffer>>({
        pull() {
          throw new Error('read failed');
        },
      });
    const result = await workspace.confirmBackup({ file: unreadable, expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest });
    expect(result).toEqual({ kind: 'NotVerified', reason: 'Unreadable', detail: detailLike({ stage: 'Verify', name: 'Error', context: { check: 'StreamRead' } }) });
    // The host's error message is not copied: it could quote content.
    expect(JSON.stringify((result as { detail: unknown }).detail)).not.toContain('read failed');

    const notUtf8 = new File([gzipSync(new Uint8Array([0x7b, 0x22, 0x6b, 0xff, 0xfe, 0x22, 0x7d, 0x0a]))], 'not-utf8.tjbackup');
    const decoded = await workspace.confirmBackup({ file: notUtf8, expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest });
    expect(decoded).toEqual({ kind: 'NotVerified', reason: 'Unreadable', detail: detailLike({ stage: 'Verify', name: 'ArtifactReadError', context: expect.objectContaining({ check: 'NotUtf8' }) }) });
  });

  it('should keep the original read error name in the failure detail', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const bytes = testHost.downloads.offered[0]!.bytes as Uint8Array<ArrayBuffer>;
    const failing = new File([bytes], 'a7.tjbackup');
    failing.stream = () => {
      let pulls = 0;
      return new ReadableStream<Uint8Array<ArrayBuffer>>({
        pull(controller) {
          pulls += 1;
          if (pulls === 1) controller.enqueue(bytes.slice(0, 8));
          else throw new DOMException('disk went away: DISTINCTIVE', 'NotReadableError');
        },
      });
    };
    const result = await workspace.confirmBackup({ file: failing, expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest });
    expect(result).toEqual({ kind: 'NotVerified', reason: 'Unreadable', detail: detailLike({ stage: 'Verify', name: 'NotReadableError', context: { check: 'StreamRead' } }) });
    expect(JSON.stringify((result as { detail: unknown }).detail)).not.toContain('DISTINCTIVE');
  });

  it('should name only a known section in the failure detail', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const edited = editedArtifact(testHost.downloads.offered[0]!.bytes, ({ lines }) => {
      const header = JSON.parse(lines[0]!) as { sections: string[] };
      lines[0] = canonical({ ...header, sections: ['journal-DISTINCTIVE-tampered', ...header.sections.slice(1)] });
    });
    const result = await workspace.confirmBackup({ file: new File([edited.bytes as BlobPart], 'edited.tjbackup'), expectedBinding: first.sourceBinding, expectedFullDigest: edited.fullDigest });
    expect(result).toMatchObject({ kind: 'NotVerified', detail: { context: { check: 'SectionEndMismatch' } } });
    expect(JSON.stringify((result as { detail: unknown }).detail)).not.toContain('DISTINCTIVE');
  });

  it('should name the differing comparison in the NotVerified detail for a different backup', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const offered = testHost.downloads.offered[0]!;
    const file = () => new File([offered.bytes as BlobPart], offered.fileName);
    const differs = (check: string) => ({ kind: 'NotVerified', reason: 'DifferentArtifact', detail: detailLike({ stage: 'Verify', context: { check } }) });

    expect(await workspace.confirmBackup({ file: file(), expectedBinding: first.sourceBinding, expectedFullDigest: 'sha256:' + '0'.repeat(64) })).toEqual(differs('fullDigest'));
    expect(await workspace.confirmBackup({ file: file(), expectedBinding: { ...first.sourceBinding, databaseName: first.sourceBinding.databaseName + '-other' }, expectedFullDigest: first.fullDigest })).toEqual(differs('databaseName'));
    expect(await workspace.confirmBackup({ file: file(), expectedBinding: { ...first.sourceBinding, contentRevision: first.sourceBinding.contentRevision + 1 }, expectedFullDigest: first.fullDigest })).toEqual(differs('contentRevision'));
  });
});

describe('Not Verified, DifferentArtifact one comparison at a time (A130)', () => {
  it('should return DifferentArtifact when only the full digest differs, and when only the source binding differs', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const offered = testHost.downloads.offered[0]!;
    const file = () => new File([offered.bytes as BlobPart], offered.fileName);
    const different = { kind: 'NotVerified', reason: 'DifferentArtifact', detail: detailLike({ stage: 'Verify' }) };

    // Control: the genuine expectations are Completed.
    expect((await workspace.confirmBackup({ file: file(), expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest })).kind).toBe('Completed');

    // Only the expected full digest differs; the binding matches.
    expect(await workspace.confirmBackup({ file: file(), expectedBinding: first.sourceBinding, expectedFullDigest: 'sha256:' + '0'.repeat(64) })).toEqual(different);

    // Only the expected database name differs.
    expect(await workspace.confirmBackup({ file: file(), expectedBinding: { ...first.sourceBinding, databaseName: first.sourceBinding.databaseName + '-other' }, expectedFullDigest: first.fullDigest })).toEqual(different);

    // Only the expected content revision differs.
    expect(await workspace.confirmBackup({ file: file(), expectedBinding: { ...first.sourceBinding, contentRevision: first.sourceBinding.contentRevision + 1 }, expectedFullDigest: first.fullDigest })).toEqual(different);
  });
});

describe('Not Verified, section ends (A123, A130)', () => {
  it('should return IncompleteOrCorrupt when a section ends twice and another never ends', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const a7 = testHost.downloads.offered[0]!.bytes;
    const confirmEdited = (edit: (artifact: EditableArtifact) => void) => {
      const edited = editedArtifact(a7, edit);
      return workspace.confirmBackup({ file: new File([edited.bytes as BlobPart], 'edited.tjbackup'), expectedBinding: first.sourceBinding, expectedFullDigest: edited.fullDigest });
    };
    const endIndexes = (lines: string[]) => lines.flatMap((l, i) => (l.includes('"kind":"sectionEnd"') ? [i] : []));

    // Control: re-sealing an unedited artifact is Completed, so the rebuild itself is sound.
    expect((await confirmEdited(() => undefined)).kind).toBe('Completed');

    // The last section's ending names the first section instead: A ends twice, B never ends. Counts and digests are made self-consistent.
    expect(
      await confirmEdited(({ lines, manifest }) => {
        const ends = endIndexes(lines);
        const firstEnd = JSON.parse(lines[ends[0]!]!) as { section: string; counts: unknown };
        const lastIndex = ends[ends.length - 1]!;
        const lastEnd = JSON.parse(lines[lastIndex]!) as { section: string; counts: unknown; digest: string };
        lines[lastIndex] = canonical({ ...lastEnd, section: firstEnd.section, counts: firstEnd.counts });
        delete manifest.sectionDigests[lastEnd.section];
        manifest.sectionDigests[firstEnd.section] = lastEnd.digest;
      }),
    ).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify' }) });

    // The header lists the sections in another order than the file ends them.
    expect(
      await confirmEdited(({ lines }) => {
        const header = JSON.parse(lines[0]!) as { sections: string[] };
        lines[0] = canonical({ ...header, sections: [...header.sections].reverse() });
      }),
    ).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify' }) });
  });
});

describe('Not Verified, header sections (A123, A130)', () => {
  it('should return IncompleteOrCorrupt for a header that names a section twice', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const a7 = testHost.downloads.offered[0]!.bytes;
    const confirmEdited = (edit: (artifact: EditableArtifact) => void) => {
      const edited = editedArtifact(a7, edit);
      return workspace.confirmBackup({ file: new File([edited.bytes as BlobPart], 'edited.tjbackup'), expectedBinding: first.sourceBinding, expectedFullDigest: edited.fullDigest });
    };
    // Control: re-sealing an unedited artifact is Completed.
    expect((await confirmEdited(() => undefined)).kind).toBe('Completed');

    // The header repeats its last section and the file ends it a second time. The second ending covers no record lines, so its
    // digest is that of empty input; the manifest is re-sealed over it. Only the repeated name is wrong.
    expect(
      await confirmEdited(({ lines, manifest }) => {
        const header = JSON.parse(lines[0]!) as { sections: string[] };
        const last = header.sections[header.sections.length - 1]!;
        lines[0] = canonical({ ...header, sections: [...header.sections, last] });
        const endIndex = lines.findLastIndex((l) => l.includes('"kind":"sectionEnd"'));
        const emptyDigest = bytesToHex(sha256(new Uint8Array()));
        lines.push(canonical({ ...(JSON.parse(lines[endIndex]!) as object), digest: emptyDigest }));
        manifest.sectionDigests[last] = emptyDigest;
      }),
    ).toEqual({ kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify' }) });
  });
});

describe('Not Verified, manifest fields (A123, A130)', () => {
  it('should return IncompleteOrCorrupt for a manifest missing a required field', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const a7 = testHost.downloads.offered[0]!.bytes;
    const confirmEdited = (edit: (artifact: EditableArtifact) => void) => {
      const edited = editedArtifact(a7, edit);
      return workspace.confirmBackup({ file: new File([edited.bytes as BlobPart], 'edited.tjbackup'), expectedBinding: first.sourceBinding, expectedFullDigest: edited.fullDigest });
    };
    const bad = { kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify' }) };

    for (const field of ['formatVersion', 'schemaVersion', 'footprint', 'exclusions']) {
      expect(await confirmEdited(({ manifest }) => void delete manifest[field]), `missing ${field}`).toEqual(bad);
    }
    // A field of the wrong type is as malformed as a missing one.
    expect(await confirmEdited(({ manifest }) => void (manifest['formatVersion'] = '1')), 'formatVersion as text').toEqual(bad);
    expect(await confirmEdited(({ manifest }) => void (manifest['footprint'] = 'catalog')), 'footprint as text').toEqual(bad);
    expect(await confirmEdited(({ manifest }) => void (manifest['exclusions'] = [1])), 'exclusions as numbers').toEqual(bad);
  });
});

describe('Not Verified, counts and digests of a well-compressed file (A123, A130)', () => {
  it('should return IncompleteOrCorrupt for a well-compressed file whose section digest, counts or manifest digest do not match', async () => {
    const { workspace, testHost } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const a7 = testHost.downloads.offered[0]!.bytes;
    const bad = { kind: 'NotVerified', reason: 'IncompleteOrCorrupt', detail: detailLike({ stage: 'Verify' }) };
    const isEnd = (l: string) => l.includes('"kind":"sectionEnd"');
    const tailOf = (l: string) => /,"s":"([^"]*)","t":"([^"]*)"\}$/.exec(l);
    const recordIndex = (lines: string[]) => lines.findIndex((l, i) => i > 0 && !isEnd(l) && tailOf(l) !== null && tailOf(l)![1] !== 'workspace');
    const endIndexOf = (lines: string[], section: string) => lines.findIndex((l) => isEnd(l) && (JSON.parse(l) as { section: string }).section === section);

    // The digests the reader computes for an edited file, so a case can make every other digest agree with its edit.
    const computedDigests = async (bytes: Uint8Array) => {
      const manifest = (await linesOf(bytes)).at(-1);
      if (manifest?.kind !== 'manifest') throw new Error('last line is not the manifest');
      return manifest.computedSectionDigests;
    };
    // fixEnds false leaves each section end's stored digest as the edit left it.
    const sealed = async (edit: (artifact: EditableArtifact) => void, fixEnds: boolean) => {
      const digests = await computedDigests(editedArtifact(a7, edit).bytes);
      return editedArtifact(a7, (artifact) => {
        edit(artifact);
        Object.assign(artifact.manifest.sectionDigests, digests);
        if (!fixEnds) return;
        for (const [section, digest] of Object.entries(digests)) {
          const i = endIndexOf(artifact.lines, section);
          artifact.lines[i] = canonical({ ...(JSON.parse(artifact.lines[i]!) as object), digest });
        }
      });
    };
    const confirm = (edited: { readonly bytes: Uint8Array; readonly fullDigest: string }) => {
      // Well-compressed: the file decompresses, so the verdict comes from the count and digest checks.
      expect(gunzipSync(edited.bytes).length).toBeGreaterThan(0);
      return workspace.confirmBackup({ file: new File([edited.bytes as BlobPart], 'edited.tjbackup'), expectedBinding: first.sourceBinding, expectedFullDigest: edited.fullDigest });
    };
    const changeRecord = ({ lines }: EditableArtifact) => {
      const i = recordIndex(lines);
      // A space after the prefix changes the line's bytes, and so its section digest, while it stays a record line.
      lines[i] = '{"r": ' + lines[i]!.slice('{"r":'.length);
    };

    // Control: a resealed unedited file is Completed, so each case below fails for its own edit.
    expect((await confirm(await sealed(() => undefined, true))).kind).toBe('Completed');

    // A record line changed: the section digest no longer matches the section end (the manifest digest is made to agree).
    expect(await confirm(await sealed(changeRecord, false)), 'record line changed').toEqual(bad);

    // A section end's per-store count changed.
    expect(
      await confirm(
        editedArtifact(a7, ({ lines }) => {
          const section = tailOf(lines[recordIndex(lines)]!)![1]!;
          const i = endIndexOf(lines, section);
          const end = JSON.parse(lines[i]!) as { counts: Record<string, number> };
          const store = Object.keys(end.counts)[0]!;
          lines[i] = canonical({ ...end, counts: { ...end.counts, [store]: end.counts[store]! + 1 } });
        }),
      ),
      'section end count changed',
    ).toEqual(bad);

    // A manifest section digest changed.
    expect(
      await confirm(
        editedArtifact(a7, ({ manifest }) => {
          const section = Object.keys(manifest.sectionDigests)[0]!;
          manifest.sectionDigests[section] = '0'.repeat(64);
        }),
      ),
      'manifest section digest changed',
    ).toEqual(bad);

    // The manifest names a section digest for a section the file does not have.
    expect(await confirm(editedArtifact(a7, ({ manifest }) => void (manifest.sectionDigests['extra'] = '0'.repeat(64)))), 'manifest extra section digest').toEqual(bad);

    // The manifest counts differ from the header counts.
    expect(
      await confirm(
        editedArtifact(a7, ({ manifest }) => {
          const counts = manifest['counts'] as Record<string, number>;
          const store = Object.keys(counts)[0]!;
          counts[store] = counts[store]! + 1;
        }),
      ),
      'manifest counts differ from header counts',
    ).toEqual(bad);

    // A record line removed (its section end and digests made to agree): the per-store line count differs from the header.
    expect(
      await confirm(
        await sealed(({ lines }) => {
          const i = recordIndex(lines);
          const [, section, store] = tailOf(lines[i]!)!;
          lines.splice(i, 1);
          const e = endIndexOf(lines, section!);
          const end = JSON.parse(lines[e]!) as { counts: Record<string, number> };
          lines[e] = canonical({ ...end, counts: { ...end.counts, [store!]: end.counts[store!]! - 1 } });
        }, true),
      ),
      'record line removed',
    ).toEqual(bad);
  });
});

describe('Not Verified, not UTF-8 (A130)', () => {
  it('should return Unreadable for a file whose text is not UTF-8, with no receipt', async () => {
    const { workspace } = await w7Stack();
    const first = await workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const text = new Uint8Array([0x7b, 0x22, 0x6b, 0xff, 0xfe, 0x22, 0x7d, 0x0a]);
    const file = new File([gzipSync(text)], 'not-utf8.tjbackup');
    expect(await workspace.confirmBackup({ file, expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest })).toEqual({ kind: 'NotVerified', reason: 'Unreadable', detail: detailLike({ stage: 'Verify' }) });
  });

  it('should return Unreadable when bytes after the manifest are not UTF-8', async () => {
    const stack = await w7Stack();
    const first = await stack.workspace.exportBackup({});
    if (first.kind !== 'Downloaded') throw new Error('expected Downloaded');
    const offered = stack.testHost.downloads.offered[0]!;
    const plain = gunzipSync(offered.bytes);
    const bytes = new Uint8Array(plain.length + 1);
    bytes.set(plain);
    bytes[plain.length] = 0xc2;
    const file = new File([gzipSync(bytes)], 'trailing-byte.tjbackup');
    expect(await stack.workspace.confirmBackup({ file, expectedBinding: first.sourceBinding, expectedFullDigest: first.fullDigest })).toEqual({ kind: 'NotVerified', reason: 'Unreadable', detail: detailLike({ stage: 'Verify' }) });
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
