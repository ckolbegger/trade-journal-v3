// I7.14: a fresh Workspace is created at schema 6 directly, seeded with Catalog manifest v3 holding the four
// Strategies in seed order with their exact shapes, and no migration (AC-REF-001 partial). D6's I6.15 proves the
// schema, the manifest version, the receipt's additions and the Close Reasons for the same launch, so this case
// adds only what it leaves open: the stored Strategies, their order and their shapes.
import { describe, expect, it } from 'vitest';
import { device, dumpAll, launch, workspaceStores } from './support.ts';

describe('I7.14 Fresh initialization at schema 6', () => {
  it('should create schema 6 directly with Catalog manifest v3 holding Long Stock, Long Call, Long Put and Cash-Secured Put in seed order with their exact shapes, and no migration', async () => {
    const d = await device();
    const app = await launch(d);
    const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.status.schemaVersion).toBe(7);
    expect(opened.receipt.fresh).toBe(true);
    expect(opened.receipt.migration).toBeUndefined();
    expect(opened.receipt.seeds.catalog.manifestVersion).toBe(3);
    expect(opened.receipt.seeds.catalog.additions.filter((key) => key.startsWith('strategy.'))).toEqual([
      'strategy.long-stock',
      'strategy.long-call',
      'strategy.long-put',
      'strategy.cash-secured-put',
    ]);

    const dump = await dumpAll(d.factory);
    const stored = (workspaceStores(dump)['catalog'] as { kind: string; productKey: string; label: string; origin: string; active: boolean; recordRevision: number; shape: unknown }[]).filter((r) => r.kind === 'Strategy');
    expect(stored.map((s) => [s.productKey, s.label, s.origin, s.active, s.recordRevision, s.shape])).toEqual([
      ['strategy.long-stock', 'Long Stock', 'Seeded', true, 1, { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] }],
      ['strategy.long-call', 'Long Call', 'Seeded', true, 1, { roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] }],
      ['strategy.long-put', 'Long Put', 'Seeded', true, 1, { roles: [{ side: 'Long', instrument: 'Put', ratio: 1 }] }],
      ['strategy.cash-secured-put', 'Cash-Secured Put', 'Seeded', true, 1, { roles: [{ side: 'Short', instrument: 'Put', ratio: 1 }] }],
    ]);
  });
});
