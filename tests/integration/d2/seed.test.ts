// I2.12: a fresh Workspace is created at schema 2 directly, seeded with Journal manifest v2
// (AC-JOUR-007).
import { describe, expect, it } from 'vitest';
import { device, dumpAll, launch, workspaceStores } from './support.ts';

describe('I2.12 fresh initialization at schema 2', () => {
  it('should create schema 2 directly with Journal seed manifest v2 and both reflection types, and no migration in the receipt', async () => {
    const d = await device();
    const app = await launch(d);
    const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.status.schemaVersion).toBe(3);
    expect(opened.receipt.fresh).toBe(true);
    expect(opened.receipt.migration).toBeUndefined();
    expect(opened.receipt.seeds.journal).toEqual({
      // The release's current manifest (v3 since D4 T4.17) includes D2's types.
      manifestVersion: 3,
      additions: [
        'entry-type.plan-reflection',
        'entry-type.position-change-reflection',
        'entry-type.daily-trade-review',
        'source.plan-confirmation',
        'source.position-change',
        'source.daily-review',
      ],
    });

    const dump = await dumpAll(d.factory);
    expect(Object.keys(dump).filter((name) => name.startsWith('tj-ws-'))).toEqual([opened.status.binding.databaseName]);
    const stores = workspaceStores(dump);
    expect(stores['meta']).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'schema', schemaVersion: 3 })]));
    // The v2 stores exist from the start.
    expect(Object.keys(stores)).toEqual(expect.arrayContaining(['journalDeclines', 'journalObligations']));
    const types = (stores['journalTypes'] as { productKey: string }[]).map((t) => t.productKey).sort();
    expect(types).toEqual([
      'entry-type.daily-trade-review',
      'entry-type.plan-reflection',
      'entry-type.position-change-reflection',
      'source.daily-review',
      'source.plan-confirmation',
      'source.position-change',
    ]);
  });
});
