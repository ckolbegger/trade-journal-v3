import { describe, expect, it } from 'vitest';
import { createReferenceCatalog, D6_CATALOG_MANIFEST, D7_CATALOG_MANIFEST } from './index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';

async function catalog() {
  const { persistence } = await emptyWorkspace();
  return { catalog: createReferenceCatalog({ persistence, ids: sequentialIds() }), persistence };
}

const OPTION_KEYS = ['strategy.long-call', 'strategy.long-put', 'strategy.cash-secured-put'];

describe('seedDefaults: manifest v3', () => {
  it('should add Long Call, Long Put, and Cash-Secured Put with one role each and relative quantity 1, after Long Stock in that order, and nothing else, to a v2-seeded Catalog, and add nothing when run again', async () => {
    const { catalog: c, persistence } = await catalog();
    await c.seedDefaults(D6_CATALOG_MANIFEST);
    const read = () =>
      persistence.readSnapshot(['catalog', 'meta'], async (tx) => ({
        records: await tx.getAll('catalog'),
        meta: await tx.getAll('meta'),
      }));
    const v2 = (await read()).value;

    expect(await c.seedDefaults(D7_CATALOG_MANIFEST)).toEqual({
      kind: 'Seeded',
      snapshot: { catalogRevision: 2 },
      additions: OPTION_KEYS,
      selectableAccountCount: 0,
    });
    const v3 = (await read()).value;
    expect(D7_CATALOG_MANIFEST.version).toBe(3);
    // Nothing else changed: every v2 record is untouched and exactly three Strategies joined them.
    expect(v3.records.filter((r) => v2.records.some((old) => old['id'] === r['id']))).toEqual(v2.records);
    expect(v3.records).toHaveLength(v2.records.length + 3);
    const added = v3.records.filter((r) => OPTION_KEYS.includes(r['productKey'] as string));
    const byKey = (key: string) => added.find((r) => r['productKey'] === key);
    expect(byKey('strategy.long-call')).toEqual(
      expect.objectContaining({ kind: 'Strategy', label: 'Long Call', origin: 'Seeded', active: true, recordRevision: 1, shape: { roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] } }),
    );
    expect(byKey('strategy.long-put')).toEqual(
      expect.objectContaining({ kind: 'Strategy', label: 'Long Put', origin: 'Seeded', shape: { roles: [{ side: 'Long', instrument: 'Put', ratio: 1 }] } }),
    );
    expect(byKey('strategy.cash-secured-put')).toEqual(
      expect.objectContaining({ kind: 'Strategy', label: 'Cash-Secured Put', origin: 'Seeded', shape: { roles: [{ side: 'Short', instrument: 'Put', ratio: 1 }] } }),
    );

    expect(await c.seedDefaults(D7_CATALOG_MANIFEST)).toEqual({
      kind: 'Seeded',
      snapshot: { catalogRevision: 2 },
      additions: [],
      selectableAccountCount: 0,
    });
    expect((await read()).value).toEqual(v3);
  });

  it('should list the four selectable Strategies in seed order with their immutable shapes', async () => {
    const { catalog: c } = await catalog();
    await c.seedDefaults(D7_CATALOG_MANIFEST);
    const page = await c.query({ family: 'Strategy' });
    if (page.kind !== 'Page') throw new Error('no page');
    expect(page.items.map((r) => (r.kind === 'Strategy' ? [r.label, r.productKey, r.shape] : null))).toEqual([
      ['Long Stock', 'strategy.long-stock', { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] }],
      ['Long Call', 'strategy.long-call', { roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] }],
      ['Long Put', 'strategy.long-put', { roles: [{ side: 'Long', instrument: 'Put', ratio: 1 }] }],
      ['Cash-Secured Put', 'strategy.cash-secured-put', { roles: [{ side: 'Short', instrument: 'Put', ratio: 1 }] }],
    ]);
  });
});
