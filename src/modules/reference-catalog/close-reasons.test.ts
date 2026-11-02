import { describe, expect, it } from 'vitest';
import { createReferenceCatalog, D1_CATALOG_MANIFEST, D6_CATALOG_MANIFEST } from './index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';

async function catalog() {
  const { persistence } = await emptyWorkspace();
  return { catalog: createReferenceCatalog({ persistence, ids: sequentialIds() }), persistence };
}

const CLOSE_REASON_KEYS = [
  'close-reason.target-reached',
  'close-reason.stop-triggered',
  'close-reason.thesis-invalidated',
  'close-reason.time-based-exit',
];

describe('seedDefaults: manifest v2', () => {
  it('should add the Close Reasons Target Reached, Stop Triggered, Thesis Invalidated, and Time-Based Exit, in that order with policy SeededValuesRemainSelectable and no Rolled role, and nothing else, to a v1-seeded Catalog, and add nothing when run again', async () => {
    const { catalog: c, persistence } = await catalog();
    await c.seedDefaults(D1_CATALOG_MANIFEST);
    const read = () =>
      persistence.readSnapshot(['catalog', 'meta'], async (tx) => ({
        records: await tx.getAll('catalog'),
        meta: await tx.getAll('meta'),
      }));
    const v1 = (await read()).value;

    expect(await c.seedDefaults(D6_CATALOG_MANIFEST)).toEqual({
      kind: 'Seeded',
      snapshot: { catalogRevision: 2 },
      additions: CLOSE_REASON_KEYS,
      selectableAccountCount: 0,
    });
    const v2 = (await read()).value;
    // Nothing else changed: the v1 Strategy is untouched and exactly four records joined it.
    expect(v2.records.filter((r) => r['kind'] === 'Strategy')).toEqual(v1.records);
    const added = v2.records
      .filter((r) => r['kind'] === 'CloseReason')
      .sort((a, b) => (a['seedOrder'] as number) - (b['seedOrder'] as number));
    expect(v2.records).toHaveLength(5);
    expect(added.map((r) => r['label'])).toEqual(['Target Reached', 'Stop Triggered', 'Thesis Invalidated', 'Time-Based Exit']);
    for (const record of added) {
      expect(record).toEqual(
        expect.objectContaining({ active: true, origin: 'Seeded', recordRevision: 1, policy: 'SeededValuesRemainSelectable' }),
      );
      expect(record).not.toHaveProperty('role');
    }

    expect(await c.seedDefaults(D6_CATALOG_MANIFEST)).toEqual({
      kind: 'Seeded',
      snapshot: { catalogRevision: 2 },
      additions: [],
      selectableAccountCount: 0,
    });
    expect((await read()).value).toEqual(v2);
  });
});

describe('query and resolve', () => {
  it('should list the selectable Close Reasons in seed order, and resolve one as NewSelection while returning WrongKind for a Strategy identity offered as a Close Reason', async () => {
    const { catalog: c } = await catalog();
    await c.seedDefaults(D1_CATALOG_MANIFEST);
    await c.seedDefaults(D6_CATALOG_MANIFEST);

    const reasons = await c.query({ family: 'CloseReason' });
    if (reasons.kind !== 'Page') throw new Error('expected a page');
    expect(reasons.items.map((r) => r.label)).toEqual(['Target Reached', 'Stop Triggered', 'Thesis Invalidated', 'Time-Based Exit']);
    expect(reasons.nextCursor).toBeUndefined();

    const strategies = await c.query({ family: 'Strategy' });
    if (strategies.kind !== 'Page') throw new Error('expected a page');
    expect(strategies.items.map((r) => r.label)).toEqual(['Long Stock']);

    const stop = reasons.items[1]!;
    expect(await c.resolve([{ name: 'closeReason', kind: 'CloseReason', id: stop.id, mode: 'NewSelection' }])).toEqual({
      kind: 'Resolved',
      snapshot: { catalogRevision: 2 },
      resolved: {
        closeReason: { id: stop.id, kind: 'CloseReason', label: 'Stop Triggered', recordRevision: 1, selectable: true },
      },
    });
    expect(
      await c.resolve([{ name: 'closeReason', kind: 'CloseReason', id: strategies.items[0]!.id, mode: 'NewSelection' }]),
    ).toEqual({
      kind: 'Unresolved',
      snapshot: { catalogRevision: 2 },
      issues: [{ name: 'closeReason', code: 'WrongKind' }],
    });
  });
});
