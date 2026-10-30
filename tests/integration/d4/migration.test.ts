// I4.1 and I4.2: migrating the committed schema-1 and schema-2 fixtures to schema 3 through
// Workspace.initialize (D4 A51, AC-REST-004 re-proven for schema 3).
import type { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { currentDatabase, dumpAll, fixtureDatabase, fixtureDump, fixtureDevice, fixtureViews, launch, rawUpdate, restart, workspaceStores } from './support.ts';

type Pointer = { key: string; databaseName?: string; databaseNames?: string[] };

const pointerRecords = async (factory: IDBFactory) => (await dumpAll(factory))['tj-root']!['pointer'] as Pointer[];

// What the Journal seed adds when migrating from each schema: the Daily Trade Review is new in 3.
const JOURNAL_ADDITIONS = {
  1: ['entry-type.position-change-reflection', 'entry-type.daily-trade-review', 'source.position-change', 'source.daily-review', 'source.trade-detail'],
  2: ['entry-type.daily-trade-review', 'source.daily-review', 'source.trade-detail'],
} as const;

// The D4 current figures of an Open list row: each must be Unavailable(MarkMissing) with no Mark (A51).
const CURRENT_FIGURES = [
  'remainingOpenPnl',
  'currentMarkedPnl',
  'currentMarkedPnlInPlanR',
  'ongoingRiskToStop',
  'ongoingRiskToStopInPlanR',
  'worstCaseOngoingRisk',
  'worstCaseOngoingRiskInPlanR',
  'incrementalRewardToTarget',
  'incrementalRewardToTargetInPlanR',
] as const;

describe('I4.1 migrate earlier fixtures', () => {
  for (const version of [1, 2] as const) {
    it(`v${version}: should open with a migration receipt naming the seed additions and the session-policy identity, then after restart be Ready at the current schema with the fixture views, no observations, a new database in the pointer, and no candidate`, async () => {
      const d = await fixtureDevice(version);
      const app = await launch(d);
      const opened = await app.Workspace.initialize({});
      if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
      expect(opened.receipt.migration).toEqual(
        expect.objectContaining({ fromVersion: version, toVersion: 4, sourceDatabase: fixtureDatabase(version), databaseName: expect.stringMatching(/^tj-ws-/) as string }),
      );
      expect(opened.receipt.seeds.journal).toEqual({ manifestVersion: 4, additions: JOURNAL_ADDITIONS[version] });
      expect(opened.receipt.sessionPolicy).toEqual({ recorded: nyseSessionPolicy.identity, findings: [] });
      const newDatabase = opened.receipt.migration!.databaseName;

      const again = await restart(app, d);
      const status = await again.Workspace.getStatus();
      expect(status.kind === 'Ready' && [status.schemaVersion, status.binding.databaseName]).toEqual([4, newDatabase]);

      // A51: every field the snapshot holds is equal; each later field has its defined value.
      const views = await viewsOf(again, version);
      expect(compareSnapshot(views, fixtureViews(version))).toEqual([]);
      const open = (views as { open?: { tradeId: string; current: Record<string, { kind: string; reason?: string }> }[] }).open ?? [];
      for (const row of open) {
        for (const name of CURRENT_FIGURES) expect([row.tradeId, name, row.current[name]!.kind, row.current[name]!.reason]).toEqual([row.tradeId, name, 'Unavailable', 'MarkMissing']);
      }

      const dump = await dumpAll(d.factory);
      expect(workspaceStores(dump)['observations']).toEqual([]);
      expect(Object.keys(dump).sort()).toEqual(['tj-root', newDatabase]);
      expect(await currentDatabase(d.factory)).toBe(newDatabase);
      expect(await pointerRecords(d.factory)).toEqual(
        expect.arrayContaining([
          { key: 'current', databaseName: newDatabase },
          { key: 'candidates', databaseNames: [] },
        ]),
      );
    });
  }
});

describe('I4.2 migration failure and retry', () => {
  it('should block naming the unknown Account, leave the old stores and no candidate, never be Ready, then migrate on Retry and be Ready after restart', async () => {
    const source = fixtureDatabase(2);
    const originalAccount = fixtureDump(2).databases[source]!.stores['trades']!.records[0] as { tradeId: string; accountId: string };
    const d = await fixtureDevice(2, (dump) => {
      dump.databases[source]!.stores['trades']!.records[0]!['accountId'] = 'fx-unknown';
    });
    const loaded = await dumpAll(d.factory);
    const app = await launch(d);

    const blocked = await app.Workspace.initialize({});
    expect(blocked).toEqual(
      expect.objectContaining({
        kind: 'MigrationBlocked',
        issues: [{ code: 'UnknownAccount', tradeId: originalAccount.tradeId, accountId: 'fx-unknown' }],
      }),
    );
    // dumpAll records no IndexedDB version, so equal stores are "equal apart from the version".
    const after = await dumpAll(d.factory);
    expect(after[source]).toEqual(loaded[source]);
    expect(Object.keys(after).sort()).toEqual(['tj-root', source]);
    expect(after['tj-root']!['pointer']).toEqual(expect.arrayContaining([{ key: 'candidates', databaseNames: [] }]));
    expect((await app.Workspace.getStatus()).kind).toBe('MigrationBlocked');

    // The cause is removed, then Retry is initialize again.
    await rawUpdate(d.factory, source, 'trades', originalAccount.tradeId, (trade) => ({ ...trade, accountId: originalAccount.accountId }));
    const retried = await app.Workspace.initialize({});
    expect(retried.kind === 'Opened' && retried.receipt.migration).toEqual(expect.objectContaining({ fromVersion: 2, toVersion: 4 }));
    const again = await restart(app, d);
    expect((await again.Workspace.getStatus()).kind).toBe('Ready');
  });
});
