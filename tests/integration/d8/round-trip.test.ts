// I8.1 Round trip (AC-BACK-001, AC-REBUILD-001) and I8.12 Every backup fixture (AC-REBUILD-001, A139).
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'fflate';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { withWalkedReflections } from '../../../tools/fixture-views.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { BACKUP_SCHEMAS, backupFixtureName } from '../../../tools/fixtures-freeze-backup.ts';
import { readIndex } from '../d1/support.ts';
import {
  artifactOf, capture, CONFIRM, device, dumpAll, dumpOf, emptyDevice, EXPORT_AT, exportBackup, FIXTURES, launch, liveOf, manifestOf, marksIn, prepared, restart, verify, w7Device,
} from './support.ts';

const STORES = ['catalog', 'observations', 'trades', 'journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts'] as const;
const PRIVATE_TRADE_FIELDS = ['exposureStart', 'terminalTime', 'activityDesc', 'terminalDesc'];
const INDEXES = [
  ['journalEntries', 'byObligation'],
  ['journalEntries', 'byAnchorTrade'],
  ['journalDeclines', 'byAnchorTrade'],
  ['journalDebts', 'byOutstandingDue'],
  ['journalDebts', 'byAnchorTrade'],
  ['trades', 'byLifecycle'],
  ['trades', 'byLifecycleActivity'],
  ['trades', 'byLifecycleTerminal'],
  ['observations', 'byInstrumentDate'],
] as const;

// The record without its revision stamp, which Restore sets to 1 (Q3).
const withoutRevision = (record: unknown): unknown => Object.fromEntries(Object.entries(record as Record<string, unknown>).filter(([key]) => key !== 'revision'));

describe('I8.1 Round trip', () => {
  it('should verify the backup of W7 as the captured file and as its decompressed form, restore it into an empty factory, and show equal views, identities, histories and rebuilt private state, with identical section digests from two later exports', async () => {
    const source = await w7Device();
    const app = await launch(source);
    // W7 is seeded at manifest 5; its next start gives it manifest 6's forms, as a Restore does.
    await app.Workspace.initialize({});
    const sourceDump = await dumpAll(source.factory);
    const sourceDatabase = liveOf(sourceDump);
    const marks = marksIn(sourceDump[sourceDatabase]!);
    const before = await capture(app, EXPORT_AT, marks);
    const status = await app.Workspace.getStatus();
    if (status.kind !== 'Ready') throw new Error(`getStatus: ${status.kind}`);

    const exported = await exportBackup(app, source);
    const asCaptured = await verify(app, exported);
    const decompressed = await verify(app, exported, gunzipSync(exported.bytes));

    // Both verifications are Completed, with receipts bound to W7's binding.
    expect(exported.result.sourceBinding).toEqual(status.binding);
    for (const completed of [asCaptured, decompressed]) {
      expect(completed).toMatchObject({ kind: 'Completed', receipt: { sourceBinding: status.binding, fullDigest: exported.result.fullDigest } });
    }
    expect(decompressed).toMatchObject({ kind: 'Completed', receipt: { evidence: { compressed: false } } });

    // A second, empty factory: prepare, apply, restart.
    const target = await emptyDevice();
    const restoring = await launch(target);
    const { token } = await prepared(restoring, exported.bytes);
    const applied = await restoring.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM });
    expect(applied.kind).toBe('Restored');
    const restored = await restart(restoring, target);
    const restoredStatus = await restored.Workspace.getStatus();
    expect(restoredStatus.kind).toBe('Ready');

    // The normalized views, including every Mark, equal.
    const after = await capture(restored, EXPORT_AT, marks);
    expect(after).toEqual(before);

    // Every stable identity, version list and Recorded Sequence: the authoritative stores equal apart from the record revision stamps.
    const targetDump = await dumpAll(target.factory);
    const targetDatabase = liveOf(targetDump);
    for (const store of STORES) {
      expect(targetDump[targetDatabase]![store]!.map(withoutRevision), store).toEqual(sourceDump[sourceDatabase]![store]!.map(withoutRevision));
    }
    // The private fields, the private store and the private indexes are rebuilt with identical contents.
    const trades = targetDump[targetDatabase]!['trades'] as Record<string, unknown>[];
    expect(trades.some((trade) => PRIVATE_TRADE_FIELDS.some((field) => trade[field] !== undefined))).toBe(true);
    expect(targetDump[targetDatabase]!['journalObligations']!.map(withoutRevision)).toEqual(sourceDump[sourceDatabase]!['journalObligations']!.map(withoutRevision));
    expect(sourceDump[sourceDatabase]!['journalObligations']!.length).toBeGreaterThan(0);
    for (const [store, index] of INDEXES) {
      expect((await readIndex(target.factory, targetDatabase, store, index)).map(withoutRevision), `${store}.${index}`).toEqual(
        (await readIndex(source.factory, sourceDatabase, store, index)).map(withoutRevision),
      );
    }

    // Two more exports of W7 with no change between them have identical section digests (and the first export's).
    const second = await exportBackup(app, source);
    const third = await exportBackup(app, source);
    expect(manifestOf(second.bytes).sectionDigests).toEqual(manifestOf(third.bytes).sectionDigests);
    expect(manifestOf(second.bytes).sectionDigests).toEqual(manifestOf(exported.bytes).sectionDigests);
  }, 120_000);
});

describe('I8.12 Every backup fixture', () => {
  for (const schema of BACKUP_SCHEMAS) {
    const { name } = backupFixtureName(schema);
    it(`should restore ${name} into an empty factory and be Ready at schema 7 after restart, with views equal to the fixture's expected views`, async () => {
      const asOf = (JSON.parse(readFileSync(`${FIXTURES}/${name}/downloaded.json`, 'utf8')) as { asOf: string }).asOf;
      const target = await device(new IDBFactory(), asOf, 'bk');
      const first = await launch(target);
      const { token, preview } = await prepared(first, artifactOf(name));
      expect(preview.source.schemaVersion).toBe(schema);
      expect(preview.repairs).toEqual([]);
      const applied = await first.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM });
      expect(applied.kind).toBe('Restored');

      const app = await restart(first, target);
      const status = await app.Workspace.getStatus();
      expect(status.kind === 'Ready' && status.schemaVersion).toBe(7);
      const expected = JSON.parse(readFileSync(`${FIXTURES}/${name}/expected-views.json`, 'utf8')) as unknown;
      const views = withWalkedReflections(await viewsOf(app, schema, asOf));
      expect(compareSnapshot(views, expected)).toEqual([]);
      // The source stores are known to hold records of this schema, so the views are not vacuously equal.
      expect(Object.keys(dumpOf(`workspace-v${schema}`).databases).length).toBeGreaterThan(1);
    }, 120_000);
  }
});
