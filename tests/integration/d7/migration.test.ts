// I7.1: migrating the committed schema-1 to schema-5 fixtures to schema 6 through Workspace.initialize
// (D7 A118, AC-REST-004 re-proven for schema 6, AC-REF-001 partial: the option Strategy seeds).
import { describe, expect, it } from 'vitest';
import { currentDatabase, fixtureDatabase, fixtureDevice, launch, restart, type FixtureVersion } from '../d6/support.ts';

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
        expect.objectContaining({ fromVersion: version, toVersion: 6, sourceDatabase: fixtureDatabase(version), databaseName: expect.stringMatching(/^tj-ws-/) as string }),
      );
      expect(Object.keys(opened.receipt.migration!.counts).length).toBeGreaterThan(0);
      expect(opened.receipt.seeds.catalog.manifestVersion).toBe(3);
      expect(opened.receipt.seeds.catalog.additions).toEqual(version < 5 ? [...OPTION_STRATEGIES, ...CLOSE_REASONS] : OPTION_STRATEGIES);

      const again = await restart(app, d);
      const status = await again.Workspace.getStatus();
      expect(status.kind === 'Ready' && [status.schemaVersion, status.binding.databaseName]).toEqual([6, opened.receipt.migration!.databaseName]);
      expect(await currentDatabase(d.factory)).toBe(opened.receipt.migration!.databaseName);

      const strategies = await again.ReferenceCatalog.query({ family: 'Strategy' });
      if (strategies.kind !== 'Page') throw new Error(`ReferenceCatalog.query: ${strategies.kind}`);
      expect(strategies.items.map((s) => s.label)).toEqual(['Cash-Secured Put', 'Long Call', 'Long Put', 'Long Stock']);
    }, 60_000);
  }
});
