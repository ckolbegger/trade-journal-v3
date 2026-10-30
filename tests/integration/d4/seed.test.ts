// I4.12: a fresh Workspace is created at schema 3 directly, recording the session-policy identity
// and seeded with Journal manifest v3 (AC-JOUR-007).
import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { device, dumpAll, launch, restart, workspaceStores } from './support.ts';

describe('I4.12 fresh initialization at schema 3', () => {
  it('should create schema 3 directly with the session-policy identity and Journal seed manifest v3 holding all three reflection and review types, with no migration, and seed nothing on a second launch', async () => {
    const d = await device();
    const app = await launch(d);
    const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.status.schemaVersion).toBe(4);
    expect(opened.receipt.fresh).toBe(true);
    expect(opened.receipt.migration).toBeUndefined();
    expect(opened.receipt.seeds.journal).toEqual({
      manifestVersion: 4,
      additions: [
        'entry-type.plan-reflection',
        'entry-type.position-change-reflection',
        'entry-type.daily-trade-review',
        'source.plan-confirmation',
        'source.position-change',
        'source.daily-review',
        'source.trade-detail',
      ],
    });

    const dump = await dumpAll(d.factory);
    expect(Object.keys(dump).filter((name) => name.startsWith('tj-ws-'))).toEqual([opened.status.binding.databaseName]);
    const stores = workspaceStores(dump);
    expect(stores['meta']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'schema', schemaVersion: 4 }),
        expect.objectContaining({ key: 'sessionPolicy', policy: nyseSessionPolicy.identity }),
      ]),
    );
    expect(stores['observations']).toEqual([]);
    const types = (stores['journalTypes'] as { productKey: string }[]).map((t) => t.productKey).sort();
    expect(types).toEqual([
      'entry-type.daily-trade-review',
      'entry-type.plan-reflection',
      'entry-type.position-change-reflection',
      'source.daily-review',
      'source.plan-confirmation',
      'source.position-change',
      'source.trade-detail',
    ]);

    // A second launch adds nothing (AC-JOUR-007).
    const again = await restart(app, d);
    const second = await again.Workspace.initialize({});
    expect(second.kind === 'Opened' && [second.receipt.migration, second.receipt.seeds.journal.additions, second.receipt.sessionPolicy]).toEqual([undefined, [], undefined]);
    expect(await dumpAll(d.factory)).toEqual(dump);
  });
});
