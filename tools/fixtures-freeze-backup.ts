// npm run fixtures:freeze-backup: freezes the backup fixtures (D8 T8.17, A147 as amended by Q14).
// Restore supports schemas 3 through 7, so there are five: tests/fixtures/backup-v7/ is `exportBackup`
// of the workspace-v7 fixture at Friday 2026-11-20 18:00 New York, and backup-v3-blocked/ through
// backup-v6-blocked/ are the blocked-database exports of workspace-v3 to workspace-v6 (no migration
// has run on them, so they export at their own schema). No v1 or v2 backup fixture exists.
// Each folder holds the artifact (backup.tjbackup), its Downloaded result (downloaded.json) and the
// normalized views after Restore into an empty Workspace (expected-views.json). A committed fixture
// is never regenerated, so an existing folder is refused. The export reads each stored Trade as
// stored (every leg, Execution and Instrument), and `revision` stamps are not exported (Q3).
// The exported helpers are shared with `verify:fixtures`, which restores each artifact again.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { testStack } from '../tests/support/stack.ts';
import { sequentialIds } from '../tests/support/workspace.ts';
import { workspaceOf } from '../src/coordinators/workspace/restore-test-support.ts';
import { withWalkedReflections } from './fixture-views.ts';
import { FIXTURES_DIR, launchOn, loadDump, viewsOf, type WorkspaceDump } from './fixtures/workspace-fixture.ts';

// Friday 2026-11-20 18:00 in New York, the instant the v7 fixture is exported at.
const V7_EXPORT_AT = '2026-11-20T23:00:00Z';
export const BACKUP_SCHEMAS = [3, 4, 5, 6, 7] as const;

export interface BackupFixtureName {
  readonly name: string;
  readonly schema: number;
  readonly blocked: boolean;
}

export const backupFixtureName = (schema: number): BackupFixtureName =>
  schema === 7 ? { name: 'backup-v7', schema, blocked: false } : { name: `backup-v${schema}-blocked`, schema, blocked: true };

export interface ExportedBackup {
  readonly fileName: string;
  readonly bytes: Uint8Array;
  // The Downloaded result of exportBackup, as JSON.
  readonly downloaded: Record<string, unknown>;
}

// `exportBackup` of the Workspace a dump holds, read exactly as it stands (a schema older than the
// release's is a blocked database: nothing opens or migrates it first).
export async function exportFixtureBackup(dump: WorkspaceDump): Promise<ExportedBackup> {
  const at = dump.schemaVersion === 7 ? V7_EXPORT_AT : dump.asOf;
  const stack = await testStack(await loadDump(dump), at);
  const result = await workspaceOf(stack).exportBackup({});
  if (result.kind !== 'Downloaded') throw new Error(`exportBackup of schema ${dump.schemaVersion}: ${JSON.stringify(result)}`);
  const offered = stack.testHost.downloads.offered;
  if (offered.length !== 1) throw new Error(`exportBackup offered ${offered.length} files, not 1`);
  return { fileName: offered[0]!.fileName, bytes: offered[0]!.bytes, downloaded: JSON.parse(JSON.stringify(result)) as Record<string, unknown> };
}

export interface RestoredViews {
  readonly views: unknown;
  // Repairs the prepared Restore reported; a frozen fixture has none.
  readonly repairs: number;
}

// Restores an artifact into an empty factory, restarts on it, and returns its normalized views.
export async function restoredViews(bytes: Uint8Array, schema: number, asOf: string): Promise<RestoredViews> {
  const factory = new IDBFactory();
  const first = await launchOn(factory, asOf, sequentialIds('restore'));
  const prepared = await first.Workspace.prepareRestore({ file: new File([bytes as BlobPart], 'backup.tjbackup') });
  if (prepared.kind !== 'Prepared') throw new Error(`prepareRestore is ${JSON.stringify(prepared)}`);
  const applied = await first.Workspace.applyPreparedRestore({ token: prepared.token, confirmation: { kind: 'ReplaceEntireWorkspace' } });
  if (applied.kind !== 'Restored') throw new Error(`applyPreparedRestore is ${JSON.stringify(applied)}`);
  // A new application on the same factory: the Restored Workspace is read after a restart.
  const app = await launchOn(factory, asOf, sequentialIds('restart'));
  const opened = await app.Workspace.initialize({});
  if (opened.kind !== 'Opened') throw new Error(`initialize after Restore is ${opened.kind}`);
  const status = await app.Workspace.getStatus();
  if (status.kind !== 'Ready') throw new Error(`getStatus after Restore is ${status.kind}`);
  return { views: withWalkedReflections(await viewsOf(app, schema, asOf)), repairs: prepared.preview.repairs.length };
}

if (import.meta.main) {
  for (const schema of BACKUP_SCHEMAS) {
    const { name, blocked } = backupFixtureName(schema);
    const dir = path.join(FIXTURES_DIR, name);
    if (existsSync(dir)) throw new Error(`${dir} exists: a committed fixture is never regenerated`);
    const dump = JSON.parse(await readFile(path.join(FIXTURES_DIR, `workspace-v${schema}`, 'dump.json'), 'utf8')) as WorkspaceDump;
    const exported = await exportFixtureBackup(dump);
    const asOf = dump.asOf;
    const restored = await restoredViews(exported.bytes, schema, asOf);
    if (restored.repairs !== 0) throw new Error(`${name}: Restore made ${restored.repairs} repairs, not 0`);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'backup.tjbackup'), exported.bytes);
    await writeFile(path.join(dir, 'downloaded.json'), `${JSON.stringify({ fileName: exported.fileName, asOf, ...exported.downloaded }, null, 2)}\n`);
    await writeFile(path.join(dir, 'expected-views.json'), `${JSON.stringify(restored.views, null, 2)}\n`);
    console.log(`fixtures:freeze-backup: ${dir} (${blocked ? 'blocked-database' : 'normal'} export of schema ${schema}, ${exported.bytes.length} bytes)`);
  }
}
