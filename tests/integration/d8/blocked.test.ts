// I8.10 Blocked databases are exportable (AC-REST-004): an older database the release cannot yet open is backed up at its
// own schema, verified when verification is safe, and restores forward.
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { withWalkedReflections } from '../../../tools/fixture-views.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { fixtureDatabase, fixtureDevice, fixtureDump, fixtureViews } from '../d7s/support.ts';
import { CONFIRM, device, dumpAll, exportBackup, launch, linesOf, prepared, restart, verify } from './support.ts';

describe('I8.10 Blocked databases are exportable', () => {
  it('should export a Migration Blocked schema 5 database as a BlockedDatabase artifact and verify it with a receipt, leaving its stores unchanged and it never Ready', async () => {
    // One Close Reason fact names a Catalog identity that does not exist.
    const source = fixtureDatabase(5);
    const trade = (fixtureDump(5).databases[source]!.stores['trades']!.records as { tradeId: string; closeReasonFacts?: { factId: string }[] }[]).find((t) => (t.closeReasonFacts?.length ?? 0) > 0);
    if (!trade) throw new Error('workspace-v5 holds no Close Reason fact');
    const d = await fixtureDevice(5, (dump) => {
      const stored = dump.databases[source]!.stores['trades']!.records.find((r) => r['tradeId'] === trade.tradeId)!;
      stored['closeReasonFacts'] = (stored['closeReasonFacts'] as { versions: { value: Record<string, unknown> }[] }[]).map((fact) => ({
        ...fact,
        versions: fact.versions.map((version) => ({ ...version, value: { ...version.value, closeReasonId: 'fx-unknown' } })),
      }));
    });
    const loaded = await dumpAll(d.factory);
    const app = await launch(d);
    expect(await app.Workspace.initialize({})).toMatchObject({ kind: 'MigrationBlocked' });

    const exported = await exportBackup(app, d);
    expect(JSON.parse(linesOf(exported.bytes)[0]!)).toMatchObject({ schemaVersion: 5, exportKind: 'BlockedDatabase' });
    const verified = await verify(app, exported);

    expect(verified).toMatchObject({ kind: 'Completed', receipt: { sourceBinding: exported.result.sourceBinding } });
    expect((await dumpAll(d.factory))[source]).toEqual(loaded[source]);
    expect((await app.Workspace.getStatus()).kind).toBe('MigrationBlocked');
    expect((await restart(app, d).then((again) => again.Workspace.getStatus())).kind).not.toBe('Ready');
  }, 120_000);

  it('should export a valid schema 5 database awaiting migration as Downloaded with no verification offered in its safe actions, then restore that copy into an empty factory through the 5 to 6 and 6 to 7 transforms with views equal to the v5 snapshot as migrated', async () => {
    const d = await fixtureDevice(5);
    // The host fails a readiness check at first launch, so the migration waits.
    d.testHost.fail(['capacity']);
    const app = await launch(d);
    const status = await app.Workspace.getStatus();
    expect(status).toMatchObject({ kind: 'IntegrityBlocked', reason: 'AwaitingMigration' });
    expect('backupActions' in status && status.backupActions).toEqual(['DownloadCopy']);
    const exported = await exportBackup(app, d);
    expect(JSON.parse(linesOf(exported.bytes)[0]!)).toMatchObject({ schemaVersion: 5, exportKind: 'BlockedDatabase' });

    // Restore the copy into an empty factory.
    const asOf = fixtureDump(5).asOf;
    const target = await device(new IDBFactory(), asOf, 'bk');
    const first = await launch(target);
    const { token, preview } = await prepared(first, exported.bytes);
    expect(preview.migrations.steps).toEqual([{ from: 5, to: 6 }, { from: 6, to: 7 }]);
    expect((await first.Workspace.applyPreparedRestore({ token, confirmation: CONFIRM })).kind).toBe('Restored');
    const restored = await restart(first, target);
    const restoredStatus = await restored.Workspace.getStatus();
    expect(restoredStatus.kind === 'Ready' && restoredStatus.schemaVersion).toBe(7);
    const views = withWalkedReflections(await viewsOf(restored, 5, asOf));
    expect(compareSnapshot(views, fixtureViews(5))).toEqual([]);
  }, 120_000);
});
