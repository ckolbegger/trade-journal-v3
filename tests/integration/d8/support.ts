// The D8 Node application-stack suite (plan section 6.1): the real facade from createApplication on
// fake-indexeddb, NodeTestHost and the in-process lifecycle lock, called through facade operations only, as in D1 to D8P.
// Restart means a new application over the same factory. D8 adds the substitutes of section 6.0, all test-only code:
// the in-process export port (production's own, used by default), NodeTestHost's download and file ports, the artifact
// fixture writer (`editedArtifact`, re-exported), the storage read fault wrapper, the pipeline notifications and the
// candidate editor. None of them needs a production seam.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'fflate';
import { IDBFactory, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { expect, vi } from 'vitest';
import { createApplication, type Application } from '../../../src/app/compose.ts';
import type { CompletedBackupReceipt, ExportBackupResult, PrepareRestoreResult, RestoreToken } from '../../../src/coordinators/workspace/index.ts';
import { fixedClock } from '../../../src/domain/time/index.ts';
import { loadDump, viewsOf, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { withWalkedReflections } from '../../../tools/fixture-views.ts';
import { TEST_CAPACITY } from '../../support/stack.ts';
import type { Device } from '../d2/support.ts';
import { device } from '../d2/support.ts';
import { planCommand } from '../d1/support.ts';

export { dumpAll } from '../../support/stack.ts';
export { backupFile, editedArtifact, type EditableArtifact } from '../../../src/coordinators/workspace/restore-test-support.ts';
export { device, type Device };

// Friday 2026-11-20 18:00 in New York: the instant W7 is exported at (A7's creation time).
export const EXPORT_AT = '2026-11-20T23:00:00Z';
// A Saturday after the export: W-t's clock.
export const WT_NOW = '2026-11-21T15:00:00Z';
export const CONFIRM = { kind: 'ReplaceEntireWorkspace' } as const;
export const DECLINE = { kind: 'DeclinedAfterWarning' } as const;

// --- Applications on a device, with the host's download and file ports ---

// One Application over the device's storage, wired as the composition root wires it in Node.
export function launch(d: Device): Promise<Application> {
  return createApplication({
    indexedDB: d.factory,
    host: d.testHost.host,
    clock: fixedClock(d.now),
    ids: d.ids,
    releaseId: d.testHost.releaseId,
    capacityRequirement: TEST_CAPACITY,
    locks: d.locks,
    download: d.testHost.downloads.port,
    fileSelection: d.testHost.files.port,
  });
}

// Closes every connection, then builds a new application on the same storage.
export function restart(app: Application, d: Device): Promise<Application> {
  app.persistence.close();
  return launch(d);
}

// --- The committed fixtures ---

export const FIXTURES = 'tests/fixtures';

export function dumpOf(name: string): WorkspaceDump {
  return JSON.parse(readFileSync(`${FIXTURES}/${name}/dump.json`, 'utf8')) as WorkspaceDump;
}

// A7 is `backup-v7/`, W7's artifact; A5b is `backup-v5-blocked/`.
export const artifactOf = (name: string): Uint8Array => new Uint8Array(readFileSync(`${FIXTURES}/${name}/backup.tjbackup`));

// W7 on a device whose clock reads the export instant. Its identities use the `bk` prefix, never the fixture's `fx-`.
export async function w7Device(now = EXPORT_AT): Promise<Device> {
  return device(await loadDump(dumpOf('workspace-v7')), now, 'bk');
}

// An empty browser profile.
export const emptyDevice = (now = EXPORT_AT): Promise<Device> => device(new IDBFactory(), now, 'bk');

// --- W-t: the target of a Restore ---

// One Institution, one Account and one Planned Trade, with time zone America/Chicago, built through the facade.
export async function wtDevice(): Promise<{ d: Device; app: Application; tradeId: string }> {
  const d = await device(new IDBFactory(), WT_NOW, 'wt');
  const app = await launch(d);
  const opened = await app.Workspace.initialize({ timeZone: 'America/Chicago' });
  if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
  const institution = await app.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
  if (institution.kind !== 'Saved') throw new Error(`institution: ${institution.kind}`);
  const account = await app.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth IRA' });
  if (account.kind !== 'Saved') throw new Error(`account: ${account.kind}`);
  const tradeId = await planTrade(app, 'AAPL');
  return { d, app, tradeId };
}

// Confirms a Long Stock Plan for the symbol and returns its Trade identity.
export async function planTrade(app: Application, underlying: string): Promise<string> {
  const confirmed = await app.TradeWorkflows.confirmPlan(await planCommand(app, { underlying, economicTime: '2026-11-20T15:00:00Z' }));
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${confirmed.kind}`);
  return confirmed.receipt.tradeId;
}

// --- Backup, verification and Restore, each required to succeed ---

export interface Exported {
  readonly result: Extract<ExportBackupResult, { kind: 'Downloaded' }>;
  // The file the host captured for this export.
  readonly bytes: Uint8Array;
}

export async function exportBackup(app: Application, d: Device): Promise<Exported> {
  const before = d.testHost.downloads.offered.length;
  const result = await app.Workspace.exportBackup({});
  if (result.kind !== 'Downloaded') throw new Error(`exportBackup: ${JSON.stringify(result)}`);
  if (d.testHost.downloads.offered.length !== before + 1) throw new Error('exportBackup did not hand exactly one file to the host');
  return { result, bytes: d.testHost.downloads.offered[before]!.bytes };
}

export const file = (bytes: Uint8Array, name = 'backup.tjbackup'): File => new File([bytes as BlobPart], name);

export function verify(app: Application, exported: Exported, bytes: Uint8Array = exported.bytes) {
  return app.Workspace.confirmBackup({ file: file(bytes), expectedBinding: exported.result.sourceBinding, expectedFullDigest: exported.result.fullDigest });
}

// A verified receipt of the Workspace as it stands now.
export async function receiptOf(app: Application, d: Device): Promise<CompletedBackupReceipt> {
  const exported = await exportBackup(app, d);
  const confirmed = await verify(app, exported);
  if (confirmed.kind !== 'Completed') throw new Error(`confirmBackup: ${JSON.stringify(confirmed)}`);
  return confirmed.receipt;
}

export function prepare(app: Application, bytes: Uint8Array): Promise<PrepareRestoreResult> {
  return app.Workspace.prepareRestore({ file: file(bytes) });
}

export async function prepared(app: Application, bytes: Uint8Array) {
  const result = await prepare(app, bytes);
  if (result.kind !== 'Prepared') throw new Error(`prepareRestore: ${JSON.stringify(result)}`);
  return result;
}

// The database the root's pointer names, from a full dump.
export const liveOf = (dump: Record<string, Record<string, unknown[]>>): string => (dump['tj-root']!['pointer'] as { key: string; databaseName?: string }[]).find((r) => r.key === 'current')!.databaseName!;

// The pointer's current record and candidates record: what a Restore that did not activate leaves alone.
export const pointerOf = (dump: Record<string, Record<string, unknown[]>>): unknown[] => dump['tj-root']!['pointer']!;

// What a rejected or cancelled preparation leaves: every Workspace database as it was, the pointer on the same database, no
// candidate database, and no candidate listed in the root (the root's empty `candidates` record is bookkeeping, not a change).
export function expectUnchangedWithoutCandidate(after: Record<string, Record<string, unknown[]>>, before: Record<string, Record<string, unknown[]>>): void {
  const { 'tj-root': afterRoot, ...afterStores } = after;
  const { 'tj-root': beforeRoot, ...beforeStores } = before;
  expect(afterStores).toEqual(beforeStores);
  const records = (root: Record<string, unknown[]> | undefined) => (root?.['pointer'] ?? []) as { key: string; databaseName?: string; databaseNames?: string[] }[];
  expect(records(afterRoot).find((r) => r.key === 'current')).toEqual(records(beforeRoot).find((r) => r.key === 'current'));
  expect(records(afterRoot).find((r) => r.key === 'candidates')?.databaseNames ?? []).toEqual([]);
  expect(afterRoot?.['diagnostics']).toEqual(beforeRoot?.['diagnostics']);
}

// --- Artifact helpers ---

// The artifact's decompressed text lines (the final newline removed).
export function linesOf(bytes: Uint8Array): string[] {
  const lines = new TextDecoder().decode(gunzipSync(bytes)).split('\n');
  lines.pop();
  return lines;
}

export const manifestOf = (bytes: Uint8Array): { sectionDigests: Record<string, string>; fullDigest: string; exclusions: string[]; footprint: string[] } & Record<string, unknown> =>
  JSON.parse(linesOf(bytes).at(-1)!) as never;

// The index of the first record line of one store in an artifact's lines.
export const lineOf = (lines: readonly string[], store: string): number => lines.findIndex((line) => line.startsWith('{"r":') && line.endsWith(`,"t":"${store}"}`));

// --- Views ---

// The normalized views of a Workspace as the fixtures freeze them (lists, Details with their payoff views, the Friday Review,
// Debts), and every Mark the Workspace holds, resolved for its trading date.
export async function capture(app: Application, asOf: string, marks: readonly { tradingDate: string; instrumentKey: string }[]): Promise<{ views: unknown; marks: unknown }> {
  const resolved: unknown[] = [];
  for (const date of [...new Set(marks.map((m) => m.tradingDate))].sort()) {
    const frames = await app.MarketData.query({ kind: 'ResolveFrames', context: { kind: 'Historical', tradingDate: date }, instruments: marks.filter((m) => m.tradingDate === date).map((m) => m.instrumentKey) });
    resolved.push([date, frames]);
  }
  return { views: withWalkedReflections(await viewsOf(app, 7, asOf)), marks: JSON.parse(JSON.stringify(resolved, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v))) as unknown };
}

// Every Mark's trading date and instrument key in a dump of a Workspace database.
export function marksIn(dump: Record<string, unknown[]>): { tradingDate: string; instrumentKey: string }[] {
  return (dump['observations'] as { tradingDate: string; instrumentKey: string }[]).map(({ tradingDate, instrumentKey }) => ({ tradingDate, instrumentKey }));
}

// --- Pipeline notifications (test-only; they observe and change nothing) ---

// Calls `notify` synchronously inside the export's read-only transaction, once it has been opened and its
// binding read, and before any batch is read. A promise `notify` returns is not awaited (it would end the snapshot).
export function onSnapshotOpened(app: Application, notify: () => void): void {
  const persistence = app.persistence as { readExportSnapshot: Application['persistence']['readExportSnapshot'] };
  const original = persistence.readExportSnapshot;
  persistence.readExportSnapshot = (database, layout, onBatch, onStart) =>
    original(database, layout, onBatch, (start) => {
      notify();
      return onStart?.(start);
    });
}

// Calls `notify` once a Restore's root transaction has committed the pointer switch, before apply reruns readiness.
export function onActivationCommitted(app: Application, notify: () => void): void {
  const persistence = app.persistence as Pick<Application['persistence'], 'activateCandidate' | 'activateFirstCandidate'>;
  const activate = persistence.activateCandidate;
  const activateFirst = persistence.activateFirstCandidate;
  persistence.activateCandidate = async (...args) => {
    const result = await activate(...args);
    if (result.kind !== 'Aborted') notify();
    return result;
  };
  persistence.activateFirstCandidate = async (...args) => {
    const result = await activateFirst(...args);
    if (result.kind !== 'AlreadyInitialized') notify();
    return result;
  };
}

// --- Storage read fault wrapper: while installed, the first `getAll` on the store fails (its request raises an error event) ---

export function failFirstRead(store: string): { restore(): void } {
  const getAll: (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['getAll']>) => IDBRequest<unknown[]> = Reflect.get(FakeIDBObjectStore.prototype, 'getAll');
  let failed = false;
  const spy = vi.spyOn(FakeIDBObjectStore.prototype, 'getAll').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['getAll']>) {
    const request: IDBRequest<unknown[]> = getAll.apply(this, args);
    if (this.name === store && !failed) {
      failed = true;
      // Fails the pending request before its result arrives.
      queueMicrotask(() => {
        request.onerror?.(new Event('error', { cancelable: true }));
      });
    }
    return request as never;
  });
  return { restore: () => spy.mockRestore() };
}

// --- Candidate editor: the integrity fixture writer, pointed at a Restore candidate between preparation and apply ---

export async function deleteRecord(factory: IDBFactory, database: string, store: string, key: IDBValidKey): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const open = factory.open(database);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('delete failed'));
  });
  db.close();
}

// A token for a candidate that was never prepared: apply refuses before it reads it.
export const oldToken = (fullDigest: string): RestoreToken => ({ candidateId: 'tj-ws-never-prepared', fullDigest, targetBinding: 'NoWorkspace', releaseId: 'old-release' });
