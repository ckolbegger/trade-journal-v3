// I6.15: a fresh Workspace is created at schema 5 directly and seeded with Catalog manifest v2 (the four Close
// Reasons) and Journal manifest v5 (the Close Review and the Trade Close Source), with no migration
// (AC-JOUR-007 and AC-REF-001 partial). A second launch adds nothing.
import { describe, expect, it } from 'vitest';
import { device, dumpAll, launch, restart, workspaceStores } from './support.ts';

const CLOSE_REASONS = ['close-reason.target-reached', 'close-reason.stop-triggered', 'close-reason.thesis-invalidated', 'close-reason.time-based-exit'];

describe('I6.15 fresh initialization at schema 5', () => {
  it('should create schema 5 directly with Catalog manifest v2 holding the four Close Reasons and Journal manifest v5 holding the Close Review and the Trade Close Source, no migration, and seed nothing on a second launch', async () => {
    const d = await device();
    const app = await launch(d);
    const opened = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    if (opened.kind !== 'Opened') throw new Error(`initialize: ${opened.kind}`);
    expect(opened.status.schemaVersion).toBe(5);
    expect(opened.receipt.fresh).toBe(true);
    expect(opened.receipt.migration).toBeUndefined();
    expect(opened.receipt.seeds.catalog.manifestVersion).toBe(2);
    expect(opened.receipt.seeds.catalog.additions).toEqual(['strategy.long-stock', ...CLOSE_REASONS]);
    expect(opened.receipt.seeds.journal.manifestVersion).toBe(5);
    expect(opened.receipt.seeds.journal.additions).toEqual(expect.arrayContaining(['entry-type.close-review', 'source.trade-close']));

    const dump = await dumpAll(d.factory);
    expect(Object.keys(dump).filter((name) => name.startsWith('tj-ws-'))).toEqual([opened.status.binding.databaseName]);
    const stores = workspaceStores(dump);
    expect(stores['meta']).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'schema', schemaVersion: 5 })]));
    const journalTypes = (stores['journalTypes'] as { productKey: string }[]).map((t) => t.productKey);
    expect(journalTypes).toEqual(expect.arrayContaining(['entry-type.close-review', 'source.trade-close']));
    expect(stores['trades']).toEqual([]);
    // Each stored Close Reason is Seeded with the policy that keeps seeded values selectable.
    const storedReasons = (stores['catalog'] as { kind: string; productKey: string; origin: string; policy: string }[]).filter((r) => r.kind === 'CloseReason');
    expect(storedReasons.map((r) => r.productKey).sort()).toEqual([...CLOSE_REASONS].sort());
    for (const r of storedReasons) expect([r.productKey, r.origin, r.policy]).toEqual([r.productKey, 'Seeded', 'SeededValuesRemainSelectable']);

    // Exactly four Close Reasons, with policy, and none for Other, Expired, Assigned or Exercised.
    const reasons = await app.ReferenceCatalog.query({ family: 'CloseReason' });
    if (reasons.kind !== 'Page') throw new Error(`ReferenceCatalog.query: ${reasons.kind}`);
    expect(reasons.items.map((item) => item.label).sort()).toEqual(['Stop Triggered', 'Target Reached', 'Thesis Invalidated', 'Time-Based Exit']);
    expect(reasons.items.some((item) => /other|expired|assigned|exercised/i.test(item.label))).toBe(false);

    // A second launch adds nothing.
    const again = await restart(app, d);
    const second = await again.Workspace.initialize({});
    expect(second.kind === 'Opened' && [second.receipt.migration, second.receipt.seeds.catalog.additions, second.receipt.seeds.journal.additions]).toEqual([undefined, [], []]);
    expect(await dumpAll(d.factory)).toEqual(dump);
  });
});
