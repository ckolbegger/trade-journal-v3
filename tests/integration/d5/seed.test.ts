// I5.13: a fresh Workspace is created at schema 4 directly and seeded with Journal manifest v4,
// including the Trade Detail Source (AC-JOUR-007 partial).
import { describe, expect, it } from 'vitest';
import { nyseSessionPolicy } from '../../../src/domain/session-policy/index.ts';
import { device, dumpAll, launch, restart, workspaceStores } from './support.ts';

describe('I5.13 fresh initialization at schema 4', () => {
  it('should create schema 4 directly with Journal seed manifest v4 including the Trade Detail Source, an empty Debt store, no migration, and seed nothing on a second launch', async () => {
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
    expect(stores['journalDebts']).toEqual([]);
    const sources = (stores['journalTypes'] as { productKey: string; label?: string }[]).filter((t) => t.productKey.startsWith('source.'));
    expect(sources.map((t) => t.productKey).sort()).toEqual(['source.daily-review', 'source.plan-confirmation', 'source.position-change', 'source.trade-detail']);
    expect(sources.find((t) => t.productKey === 'source.trade-detail')).toEqual(expect.objectContaining({ label: 'Trade Detail' }));

    // A second launch adds nothing (AC-JOUR-007).
    const again = await restart(app, d);
    const second = await again.Workspace.initialize({});
    expect(second.kind === 'Opened' && [second.receipt.migration, second.receipt.seeds.journal.additions, second.receipt.sessionPolicy]).toEqual([undefined, [], undefined]);
    expect(await dumpAll(d.factory)).toEqual(dump);
  });
});
