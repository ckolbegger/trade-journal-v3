// I7.1: migrating the committed schema-1 to schema-5 fixtures to schema 6 through Workspace.initialize
// (D7 A118, AC-REST-004 re-proven for schema 6, AC-REF-001 partial: the option Strategy seeds).
import { describe, expect, it } from 'vitest';
import { optionViolations, withWalkedReflections } from '../../../tools/fixture-views.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { viewsOf } from '../../../tools/fixtures/workspace-fixture.ts';
import { currentDatabase, dumpAll, fixtureDatabase, fixtureDevice, fixtureDump, fixtureViews, launch, rawUpdate, restart, type FixtureVersion } from '../d6/support.ts';

const OPTION_STRATEGIES = ['strategy.long-call', 'strategy.long-put', 'strategy.cash-secured-put'];
const CLOSE_REASONS = ['close-reason.target-reached', 'close-reason.stop-triggered', 'close-reason.thesis-invalidated', 'close-reason.time-based-exit'];

describe('migration to schema 6', () => {
  for (const version of [1, 2, 3, 4, 5] as const satisfies readonly FixtureVersion[]) {
    it(`should migrate v${version} Workspaces to schema 6 and return Opened with a receipt naming the from and to versions, per-store counts, and the seed additions Long Call, Long Put, and Cash-Secured Put`, async () => {
      const d = await fixtureDevice(version);
      const app = await launch(d);
      const opened = await app.Workspace.initialize({});
      if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
      expect(opened.receipt.migration).toEqual(
        expect.objectContaining({ fromVersion: version, toVersion: 7, sourceDatabase: fixtureDatabase(version), databaseName: expect.stringMatching(/^tj-ws-/) as string }),
      );
      expect(Object.keys(opened.receipt.migration!.counts).length).toBeGreaterThan(0);
      expect(opened.receipt.seeds.catalog.manifestVersion).toBe(3);
      expect(opened.receipt.seeds.catalog.additions).toEqual(version < 5 ? [...OPTION_STRATEGIES, ...CLOSE_REASONS] : OPTION_STRATEGIES);

      const again = await restart(app, d);
      const status = await again.Workspace.getStatus();
      expect(status.kind === 'Ready' && [status.schemaVersion, status.binding.databaseName]).toEqual([7, opened.receipt.migration!.databaseName]);
      expect(await currentDatabase(d.factory)).toBe(opened.receipt.migration!.databaseName);

      const strategies = await again.ReferenceCatalog.query({ family: 'Strategy' });
      if (strategies.kind !== 'Page') throw new Error(`ReferenceCatalog.query: ${strategies.kind}`);
      expect(strategies.items.map((s) => s.label)).toEqual(['Cash-Secured Put', 'Long Call', 'Long Put', 'Long Stock']);

      // A121 (extends A98): every earlier field equals the fixture's snapshot, no option Trade exists, Instruments read as
      // Stock, both payoff views are NotApplicable(NoOptionExpirationAnchor) and the settlement family is empty.
      const views = withWalkedReflections(await viewsOf(again, version, fixtureDump(version).asOf));
      expect(compareSnapshot(views, fixtureViews(version))).toEqual([]);
      expect(optionViolations(views, version >= 2, version >= 3)).toEqual([]);

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

// I7.2: the migration stops at a fact it cannot carry, leaves the old stores as they were, and succeeds on Retry.
describe('migration failure and retry', () => {
  it('should block naming the Close Reason fact with an unknown Catalog identity, leave the old stores and no candidate, never be Ready, then migrate on Retry and be Ready after restart', async () => {
    const source = fixtureDatabase(5);
    const trade = (fixtureDump(5).databases[source]!.stores['trades']!.records as { tradeId: string; closeReasonFacts?: { factId: string; versions: { value: { closeReasonId: string } }[] }[] }[]).find(
      (t) => (t.closeReasonFacts?.length ?? 0) > 0,
    );
    if (!trade) throw new Error('workspace-v5 holds no Close Reason fact');
    const fact = trade.closeReasonFacts![0]!;
    const original = fact.versions[0]!.value.closeReasonId;
    const damage = (id: string) => (record: Record<string, unknown>) => ({
      ...record,
      closeReasonFacts: (record['closeReasonFacts'] as typeof trade.closeReasonFacts)!.map((f) => ({ ...f, versions: f.versions.map((v) => ({ ...v, value: { ...v.value, closeReasonId: id } })) })),
    });
    const d = await fixtureDevice(5, (dump) => {
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

    // The cause is removed, then Retry is initialize again (AC-REST-004, re-proven).
    await rawUpdate(d.factory, source, 'trades', trade.tradeId, damage(original));
    const retried = await app.Workspace.initialize({});
    expect(retried.kind === 'Opened' && retried.receipt.migration).toEqual(expect.objectContaining({ fromVersion: 5, toVersion: 7 }));
    const again = await restart(app, d);
    expect((await again.Workspace.getStatus()).kind).toBe('Ready');
  }, 60_000);
});
