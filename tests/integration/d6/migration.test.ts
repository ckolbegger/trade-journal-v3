// I6.1 and I6.2: migrating the committed schema-1 to schema-4 fixtures to schema 5 through
// Workspace.initialize (D6 A98, AC-REST-004 re-proven for schema 5, AC-JOUR-007 and AC-REF-001 partial).
import type { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { closeViolations, debtViolations, withWalkedReflections } from '../../../tools/fixture-views.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { closedViewsOf, debtViewsOf, viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { currentDatabase, dumpAll, fixtureDatabase, fixtureDevice, fixtureDump, fixtureViews, launch, readIndex, rawUpdate, restart, workspaceStores, type FixtureVersion } from './support.ts';

type Pointer = { key: string; databaseName?: string; databaseNames?: string[] };

const pointerRecords = async (factory: IDBFactory) => (await dumpAll(factory))['tj-root']!['pointer'] as Pointer[];

// What the version 5 seeds add when migrating from each schema. The four Close Reasons are new to
// every source; the Journal additions are the manifest's entries the source's own seed lacks, so the
// Close Review type and the Trade Close Source are among them for every source.
const OPTION_STRATEGIES = ['strategy.long-call', 'strategy.long-put', 'strategy.cash-secured-put'];
const CLOSE_REASONS = ['close-reason.target-reached', 'close-reason.stop-triggered', 'close-reason.thesis-invalidated', 'close-reason.time-based-exit'];
const JOURNAL_ADDITIONS = {
  1: ['entry-type.position-change-reflection', 'entry-type.daily-trade-review', 'entry-type.close-review', 'source.position-change', 'source.daily-review', 'source.trade-detail', 'source.trade-close'],
  2: ['entry-type.daily-trade-review', 'entry-type.close-review', 'source.daily-review', 'source.trade-detail', 'source.trade-close'],
  3: ['entry-type.close-review', 'source.trade-detail', 'source.trade-close'],
  4: ['entry-type.close-review', 'source.trade-close'],
} as const;

describe('I6.1 migrate earlier fixtures', () => {
  for (const version of [1, 2, 3, 4] as const satisfies readonly FixtureVersion[]) {
    it(`v${version}: should open with a receipt naming the Close Reason and Close Review seed additions, then after restart be Ready at schema 6 with views following A98, an Empty Closed list, an empty byLifecycleTerminal, a new database in the pointer, and no candidate`, async () => {
      const d = await fixtureDevice(version);
      const app = await launch(d);
      const opened = await app.Workspace.initialize({});
      if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
      expect(opened.receipt.migration).toEqual(
        expect.objectContaining({ fromVersion: version, toVersion: 7, sourceDatabase: fixtureDatabase(version), databaseName: expect.stringMatching(/^tj-ws-/) as string }),
      );
      expect(opened.receipt.seeds.catalog).toEqual({ manifestVersion: 3, additions: [...OPTION_STRATEGIES, ...CLOSE_REASONS] });
      expect(opened.receipt.seeds.journal).toEqual({ manifestVersion: 5, additions: JOURNAL_ADDITIONS[version] });
      expect(opened.receipt.seeds.journal.additions).toEqual(expect.arrayContaining(['entry-type.close-review', 'source.trade-close']));
      const newDatabase = opened.receipt.migration!.databaseName;

      const again = await restart(app, d);
      const status = await again.Workspace.getStatus();
      expect(status.kind === 'Ready' && [status.schemaVersion, status.binding.databaseName]).toEqual([7, newDatabase]);

      // A98 (extends A73): every earlier field equals the fixture's snapshot, and the migrated Workspace
      // has no exit, Close Reason, Close Review, or Closed Trade.
      const asOf = fixtureDump(version).asOf;
      const views = withWalkedReflections(await viewsOf(again, version, asOf));
      expect(compareSnapshot(views, fixtureViews(version))).toEqual([]);
      expect(closeViolations({ ...(views as object), ...((await closedViewsOf(again)) as object) }, version >= 2)).toEqual([]);
      if (version < 4) expect(debtViolations(withWalkedReflections({ ...(views as object), ...((await debtViewsOf(again, asOf)) as object) }), version >= 2)).toEqual([]);
      const closed = await again.TradeViewsAndReporting.browseTrades({ lifecycle: 'Closed' });
      expect(closed.kind === 'Ready' && closed.view.items).toEqual([]);

      const dump = await dumpAll(d.factory);
      expect(Object.keys(dump).sort()).toEqual(['tj-root', newDatabase]);
      expect(await readIndex(d.factory, newDatabase, 'trades', 'byLifecycleTerminal')).toEqual([]);
      expect(await currentDatabase(d.factory)).toBe(newDatabase);
      expect(await pointerRecords(d.factory)).toEqual(
        expect.arrayContaining([
          { key: 'current', databaseName: newDatabase },
          { key: 'candidates', databaseNames: [] },
        ]),
      );
      expect(workspaceStores(dump)['trades']).toHaveLength(fixtureDump(version).databases[fixtureDatabase(version)]!.stores['trades']!.records.length);
    }, 60_000);
  }
});

describe('I6.2 migration failure and retry', () => {
  it('should block naming the Debt with an unknown definition revision, leave the old stores and no candidate, never be Ready, then migrate on Retry and be Ready after restart', async () => {
    const source = fixtureDatabase(4);
    const original = (fixtureDump(4).databases[source]!.stores['journalDebts']!.records as { debtId: string; definitionId: string }[])[0]!;
    const d = await fixtureDevice(4, (dump) => {
      const debt = dump.databases[source]!.stores['journalDebts']!.records.find((r) => r['debtId'] === original.debtId)!;
      debt['definitionId'] = 'fx-unknown';
    });
    const loaded = await dumpAll(d.factory);
    const app = await launch(d);

    const blocked = await app.Workspace.initialize({});
    expect(blocked).toEqual(expect.objectContaining({ kind: 'MigrationBlocked', issues: [{ code: 'MissingDefinitionRevision', definitionId: 'fx-unknown', id: original.debtId }] }));
    // dumpAll records no IndexedDB version, so equal stores are "equal apart from the version".
    const after = await dumpAll(d.factory);
    expect(after[source]).toEqual(loaded[source]);
    expect(Object.keys(after).sort()).toEqual(['tj-root', source]);
    expect(after['tj-root']!['pointer']).toEqual(expect.arrayContaining([{ key: 'candidates', databaseNames: [] }]));
    expect((await app.Workspace.getStatus()).kind).toBe('MigrationBlocked');

    // The cause is removed, then Retry is initialize again.
    await rawUpdate(d.factory, source, 'journalDebts', original.debtId, (debt) => ({ ...debt, definitionId: original.definitionId }));
    const retried = await app.Workspace.initialize({});
    expect(retried.kind === 'Opened' && retried.receipt.migration).toEqual(expect.objectContaining({ fromVersion: 4, toVersion: 7 }));
    const again = await restart(app, d);
    expect((await again.Workspace.getStatus()).kind).toBe('Ready');
  }, 60_000);
});
