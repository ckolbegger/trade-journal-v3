// I7S.1, I7S.2 and I7S.9: the schema 7 migration chain through Workspace.initialize (AC-REST-004 re-proven for
// schema 7): the committed schema 1 to 6 fixtures, a migration that stops and is retried, and a fresh Workspace.
import { describe, expect, it } from 'vitest';
import { withWalkedReflections } from '../../../tools/fixture-views.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { currentDatabase, device, dumpAll, fixtureDatabase, fixtureDevice, fixtureDump, fixtureViews, launch, rawUpdate, restart, type FixtureVersion } from './support.ts';

// The kind of every Stop, Target and per-condition result a view tree holds.
function conditionKinds(node: unknown, kinds: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) conditionKinds(item, kinds);
  } else if (node !== null && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if ((key === 'stops' || key === 'targets' || key === 'conditions') && Array.isArray(child)) {
        for (const condition of child as { kind?: string }[]) if (condition.kind !== undefined) kinds.push(condition.kind);
      }
      conditionKinds(child, kinds);
    }
  }
  return kinds;
}

describe('I7S.1 Migrate earlier fixtures', () => {
  for (const version of [1, 2, 3, 4, 5, 6] as const satisfies readonly FixtureVersion[]) {
    it(`should migrate the v${version} fixture to schema 7 and be Ready after restart with views equal to its snapshot, every condition UnderlyingPrice, the pointer naming the new database and no candidate listed`, async () => {
      const d = await fixtureDevice(version);
      const app = await launch(d);
      const opened = await app.Workspace.initialize({});
      if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
      expect(opened.receipt.migration).toEqual(
        expect.objectContaining({ fromVersion: version, toVersion: 7, sourceDatabase: fixtureDatabase(version), databaseName: expect.stringMatching(/^tj-ws-/) as string }),
      );

      const again = await restart(app, d);
      const status = await again.Workspace.getStatus();
      expect(status.kind === 'Ready' && [status.schemaVersion, status.binding.databaseName]).toEqual([7, opened.receipt.migration!.databaseName]);
      expect(await currentDatabase(d.factory)).toBe(opened.receipt.migration!.databaseName);

      const views = withWalkedReflections(await viewsOf(again, version, fixtureDump(version).asOf));
      expect(compareSnapshot(views, fixtureViews(version))).toEqual([]);
      const kinds = conditionKinds(views);
      expect(kinds.length).toBeGreaterThan(0);
      expect(kinds.every((kind) => kind === 'UnderlyingPrice')).toBe(true);

      // The pointer names the new database with no candidate, and only the root and that database remain.
      const dump = await dumpAll(d.factory);
      expect(Object.keys(dump).sort()).toEqual(['tj-root', opened.receipt.migration!.databaseName]);
      expect(dump['tj-root']!['pointer']).toEqual(
        expect.arrayContaining([
          { key: 'current', databaseName: opened.receipt.migration!.databaseName },
          { key: 'candidates', databaseNames: [] },
        ]),
      );
    }, 60_000);
  }
});

describe('I7S.2 Migration failure and retry', () => {
  it('should block the v6 fixture naming the Close Reason fact with an unknown Catalog identity, leave the old stores and no candidate, never be Ready, then migrate on Retry and be Ready at schema 7 after restart', async () => {
    const source = fixtureDatabase(6);
    const trade = (fixtureDump(6).databases[source]!.stores['trades']!.records as { tradeId: string; closeReasonFacts?: { factId: string; versions: { value: { closeReasonId: string } }[] }[] }[]).find(
      (t) => (t.closeReasonFacts?.length ?? 0) > 0,
    );
    if (!trade) throw new Error('workspace-v6 holds no Close Reason fact');
    const fact = trade.closeReasonFacts![0]!;
    const original = fact.versions[0]!.value.closeReasonId;
    const damage = (id: string) => (record: Record<string, unknown>) => ({
      ...record,
      closeReasonFacts: (record['closeReasonFacts'] as typeof trade.closeReasonFacts)!.map((f) => ({ ...f, versions: f.versions.map((v) => ({ ...v, value: { ...v.value, closeReasonId: id } })) })),
    });
    const d = await fixtureDevice(6, (dump) => {
      const stored = dump.databases[source]!.stores['trades']!.records.find((r) => r['tradeId'] === trade.tradeId)!;
      Object.assign(stored, damage('fx-unknown')(stored));
    });
    const loaded = await dumpAll(d.factory);
    const app = await launch(d);

    const blocked = await app.Workspace.initialize({});
    expect(blocked).toEqual(
      expect.objectContaining({ kind: 'MigrationBlocked', issues: [{ code: 'UnknownCloseReason', tradeId: trade.tradeId, factId: fact.factId, closeReasonId: 'fx-unknown' }] }),
    );
    // dumpAll records no IndexedDB version, so equal stores are "equal apart from the version".
    const after = await dumpAll(d.factory);
    expect(after[source]).toEqual(loaded[source]);
    expect(Object.keys(after).sort()).toEqual(['tj-root', source]);
    expect(after['tj-root']!['pointer']).toEqual(expect.arrayContaining([{ key: 'candidates', databaseNames: [] }]));
    expect((await app.Workspace.getStatus()).kind).toBe('MigrationBlocked');

    // The cause is removed, then Retry is initialize again.
    await rawUpdate(d.factory, source, 'trades', trade.tradeId, damage(original));
    const retried = await app.Workspace.initialize({});
    expect(retried.kind === 'Opened' && retried.receipt.migration).toEqual(expect.objectContaining({ fromVersion: 6, toVersion: 7 }));
    const again = await restart(app, d);
    const status = await again.Workspace.getStatus();
    expect(status.kind === 'Ready' && status.schemaVersion).toBe(7);
  }, 60_000);
});

describe('I7S.9 Fresh initialization at schema 7', () => {
  it('should create schema 7 directly with no migration and report schema 7 in the Installed Capability Manifest', async () => {
    const d = await device();
    const app = await launch(d);
    const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.status.schemaVersion).toBe(7);
    expect(opened.receipt.fresh).toBe(true);
    expect(opened.receipt.migration).toBeUndefined();

    const status = await (await restart(app, d)).Workspace.getStatus();
    if (status.kind !== 'Ready') throw new Error(`getStatus: ${status.kind}`);
    expect(status.schemaVersion).toBe(7);
    expect(status.installedCapabilities.schemaVersion).toBe(7);
    expect(status.installedCapabilities.operations['TradeWorkflows.confirmPlan']).toContain('StructureValueCondition');
  }, 60_000);
});
