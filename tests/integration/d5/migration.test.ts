// I5.1 and I5.2: migrating the committed schema-1, 2 and 3 fixtures to schema 4 through
// Workspace.initialize (D5 A73, AC-REST-004 re-proven for schema 4, AC-JOUR-007 partial).
import type { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { debtViewsOf, viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { currentDatabase, dumpAll, fixtureDatabase, fixtureDevice, fixtureDump, fixtureViews, launch, rawUpdate, restart, workspaceStores } from './support.ts';

type Pointer = { key: string; databaseName?: string; databaseNames?: string[] };

const pointerRecords = async (factory: IDBFactory) => (await dumpAll(factory))['tj-root']!['pointer'] as Pointer[];

// What the version 4 Journal seed adds when migrating from each schema: the Trade Detail Source is
// new in 4, so it is the only addition for a schema 3 source.
const JOURNAL_ADDITIONS = {
  1: ['entry-type.position-change-reflection', 'entry-type.daily-trade-review', 'source.position-change', 'source.daily-review', 'source.trade-detail'],
  2: ['entry-type.daily-trade-review', 'source.daily-review', 'source.trade-detail'],
  3: ['source.trade-detail'],
} as const;

describe('I5.1 migrate earlier fixtures', () => {
  for (const version of [1, 2, 3] as const) {
    it(`v${version}: should open with a receipt naming the Trade Detail Source addition, then after restart be Ready at schema 4 with views following A73, no Debt, a new database in the pointer, and no candidate`, async () => {
      const d = await fixtureDevice(version);
      const app = await launch(d);
      const opened = await app.Workspace.initialize({});
      if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
      expect(opened.receipt.migration).toEqual(
        expect.objectContaining({ fromVersion: version, toVersion: 4, sourceDatabase: fixtureDatabase(version), databaseName: expect.stringMatching(/^tj-ws-/) as string }),
      );
      expect(opened.receipt.seeds.journal).toEqual({ manifestVersion: 4, additions: JOURNAL_ADDITIONS[version] });
      expect(opened.receipt.seeds.journal.additions).toContain('source.trade-detail');
      const newDatabase = opened.receipt.migration!.databaseName;

      const again = await restart(app, d);
      const status = await again.Workspace.getStatus();
      expect(status.kind === 'Ready' && [status.schemaVersion, status.binding.databaseName]).toEqual([4, newDatabase]);

      // A73: every earlier field equals the fixture's snapshot, and every Debt list and count is empty.
      const asOf = fixtureDump(version).asOf;
      expect(compareSnapshot(await viewsOf(again, version, asOf), fixtureViews(version))).toEqual([]);
      const debtViews = (await debtViewsOf(again, asOf)) as { debts: unknown[]; reviewTrades: { reflections: unknown[] }[]; review?: { families: { family: string; trades?: { reflections: unknown }[] }[] } };
      expect(debtViews.debts).toEqual([]);
      expect(debtViews.reviewTrades.map((t) => t.reflections)).toEqual(debtViews.reviewTrades.map(() => []));
      const walked = (debtViews.review?.families ?? []).flatMap((f) => (f.family === 'Trades' ? (f.trades ?? []) : []));
      for (const trade of walked) expect(trade.reflections).toEqual({ due: 0, later: 0 });

      const dump = await dumpAll(d.factory);
      expect(workspaceStores(dump)['journalDebts']).toEqual([]);
      expect(Object.keys(dump).sort()).toEqual(['tj-root', newDatabase]);
      expect(await currentDatabase(d.factory)).toBe(newDatabase);
      expect(await pointerRecords(d.factory)).toEqual(
        expect.arrayContaining([
          { key: 'current', databaseName: newDatabase },
          { key: 'candidates', databaseNames: [] },
        ]),
      );
    }, 60_000);
  }
});

describe('I5.2 migration failure and retry', () => {
  it('should block naming the Entry with an unknown definition revision, leave the old stores and no candidate, never be Ready, then migrate on Retry and be Ready after restart', async () => {
    const source = fixtureDatabase(3);
    const original = (fixtureDump(3).databases[source]!.stores['journalEntries']!.records as { id: string; entryTypeKey: string; versions: { definitionId: string }[] }[]).find(
      (entry) => entry.entryTypeKey === 'entry-type.daily-trade-review',
    )!;
    const d = await fixtureDevice(3, (dump) => {
      const entry = dump.databases[source]!.stores['journalEntries']!.records.find((r) => r['id'] === original.id)!;
      (entry['versions'] as { definitionId: string }[])[0]!.definitionId = 'fx-unknown';
    });
    const loaded = await dumpAll(d.factory);
    const app = await launch(d);

    const blocked = await app.Workspace.initialize({});
    expect(blocked).toEqual(expect.objectContaining({ kind: 'MigrationBlocked', issues: [{ code: 'MissingDefinitionRevision', definitionId: 'fx-unknown', id: original.id }] }));
    // dumpAll records no IndexedDB version, so equal stores are "equal apart from the version".
    const after = await dumpAll(d.factory);
    expect(after[source]).toEqual(loaded[source]);
    expect(Object.keys(after).sort()).toEqual(['tj-root', source]);
    expect(after['tj-root']!['pointer']).toEqual(expect.arrayContaining([{ key: 'candidates', databaseNames: [] }]));
    expect((await app.Workspace.getStatus()).kind).toBe('MigrationBlocked');

    // The cause is removed, then Retry is initialize again.
    await rawUpdate(d.factory, source, 'journalEntries', original.id, (entry) => ({ ...entry, versions: original.versions }));
    const retried = await app.Workspace.initialize({});
    expect(retried.kind === 'Opened' && retried.receipt.migration).toEqual(expect.objectContaining({ fromVersion: 3, toVersion: 4 }));
    const again = await restart(app, d);
    expect((await again.Workspace.getStatus()).kind).toBe('Ready');
  }, 60_000);
});
