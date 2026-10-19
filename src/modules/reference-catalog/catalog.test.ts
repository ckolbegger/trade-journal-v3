import { describe, expect, it } from 'vitest';
import { createReferenceCatalog, D1_CATALOG_MANIFEST } from './index.ts';
import { emptyWorkspace, sequentialIds } from './test-setup.ts';

async function catalog() {
  const { persistence } = await emptyWorkspace();
  return { catalog: createReferenceCatalog({ persistence, ids: sequentialIds() }), persistence };
}

describe('seedDefaults', () => {
  it('should create exactly one Strategy, Long Stock, under product key strategy.long-stock with one long Stock role, origin Seeded, and return the snapshot, the additions, and a selectable-Account count of 0', async () => {
    const { catalog: c, persistence } = await catalog();
    const result = await c.seedDefaults(D1_CATALOG_MANIFEST);
    expect(result).toEqual({
      kind: 'Seeded',
      snapshot: { catalogRevision: 1 },
      additions: ['strategy.long-stock'],
      selectableAccountCount: 0,
    });
    const stored = await persistence.readSnapshot(['catalog'], (tx) => tx.getAll('catalog'));
    expect(stored.value).toEqual([
      expect.objectContaining({
        kind: 'Strategy',
        productKey: 'strategy.long-stock',
        label: 'Long Stock',
        origin: 'Seeded',
        active: true,
        shape: { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] },
      }),
    ]);
  });

  it('should add nothing and keep the snapshot revision when run again with the same manifest', async () => {
    const { catalog: c, persistence } = await catalog();
    await c.seedDefaults(D1_CATALOG_MANIFEST);
    const before = await persistence.readSnapshot(['catalog', 'meta'], async (tx) => ({
      catalog: await tx.getAll('catalog'),
      meta: await tx.getAll('meta'),
    }));
    expect(await c.seedDefaults(D1_CATALOG_MANIFEST)).toEqual({
      kind: 'Seeded',
      snapshot: { catalogRevision: 1 },
      additions: [],
      selectableAccountCount: 0,
    });
    const after = await persistence.readSnapshot(['catalog', 'meta'], async (tx) => ({
      catalog: await tx.getAll('catalog'),
      meta: await tx.getAll('meta'),
    }));
    expect(after).toEqual(before);
  });

  it('should return SeedConflict and write nothing when the manifest declares strategy.long-stock with a different shape', async () => {
    const { catalog: c, persistence } = await catalog();
    await c.seedDefaults(D1_CATALOG_MANIFEST);
    const before = await persistence.readSnapshot(['catalog', 'meta'], async (tx) => ({
      catalog: await tx.getAll('catalog'),
      meta: await tx.getAll('meta'),
    }));
    const incompatible = {
      version: 2,
      strategies: [
        {
          productKey: 'strategy.long-stock',
          label: 'Long Stock',
          shape: { roles: [{ side: 'Short', instrument: 'Stock', ratio: 1 }] },
        },
      ],
    } as const;
    expect(await c.seedDefaults(incompatible)).toEqual({ kind: 'SeedConflict', productKey: 'strategy.long-stock' });
    const after = await persistence.readSnapshot(['catalog', 'meta'], async (tx) => ({
      catalog: await tx.getAll('catalog'),
      meta: await tx.getAll('meta'),
    }));
    expect(after.value).toEqual(before.value);
  });
});

describe('save: create Institution', () => {
  it('should create an Institution with a stable identity and revision 1 and return the complete record and new Catalog snapshot', async () => {
    const { catalog: c, persistence } = await catalog();
    await c.seedDefaults(D1_CATALOG_MANIFEST);
    const result = await c.save({ kind: 'CreateInstitution', label: '  Fidelity  Investments ' });
    expect(result).toEqual({
      kind: 'Saved',
      record: {
        id: 'id-0002',
        kind: 'Institution',
        label: 'Fidelity Investments',
        normalizedLabel: 'fidelity investments',
        active: true,
        origin: 'Trader',
        recordRevision: 1,
      },
      snapshot: { catalogRevision: 2 },
      selectableAccountCount: 0,
    });
    const stored = await persistence.readSnapshot(['catalog'], (tx) => tx.get('catalog', 'id-0002'));
    expect(stored.value).toEqual(expect.objectContaining({ label: 'Fidelity Investments', recordRevision: 1 }));
  });

  it('should reject a blank label with a typed LabelRequired issue', async () => {
    const { catalog: c, persistence } = await catalog();
    const before = await persistence.readSnapshot(['catalog'], (tx) => tx.getAll('catalog'));
    expect(await c.save({ kind: 'CreateInstitution', label: '   ' })).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'label', code: 'LabelRequired' }],
    });
    const after = await persistence.readSnapshot(['catalog'], (tx) => tx.getAll('catalog'));
    expect(after).toEqual(before);
  });

  it('should reject a label that normalizes (case, surrounding and repeated spaces) to an existing Institution label with LabelNotDistinguishable', async () => {
    const { catalog: c } = await catalog();
    await c.save({ kind: 'CreateInstitution', label: 'Interactive Brokers' });
    expect(await c.save({ kind: 'CreateInstitution', label: '  interactive   BROKERS ' })).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'label', code: 'LabelNotDistinguishable' }],
    });

    // Two saves racing with the same label never both succeed.
    const results = await Promise.all([
      c.save({ kind: 'CreateInstitution', label: 'Schwab' }),
      c.save({ kind: 'CreateInstitution', label: 'schwab' }),
    ]);
    expect(results.filter((r) => r.kind === 'Saved')).toHaveLength(1);
  });
});

describe('save: create Account', () => {
  async function withInstitution() {
    const setup = await catalog();
    const institution = await setup.catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
    if (institution.kind !== 'Saved') throw new Error('institution not saved');
    return { ...setup, institutionId: institution.record.id };
  }

  it('should create an Account under a selectable Institution with that immutable parent and return the record, snapshot, and selectable-Account count 1', async () => {
    const { catalog: c, institutionId } = await withInstitution();
    expect(await c.save({ kind: 'CreateAccount', institutionId, label: 'Roth IRA' })).toEqual({
      kind: 'Saved',
      record: {
        id: 'id-0002',
        kind: 'Account',
        institutionId,
        label: 'Roth IRA',
        normalizedLabel: 'roth ira',
        active: true,
        origin: 'Trader',
        recordRevision: 1,
      },
      snapshot: { catalogRevision: 2 },
      selectableAccountCount: 1,
    });
  });

  it('should reject an unknown Institution identity with UnknownReference', async () => {
    const { catalog: c } = await withInstitution();
    expect(await c.save({ kind: 'CreateAccount', institutionId: 'no-such-institution', label: 'Roth IRA' })).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'institutionId', code: 'UnknownReference' }],
    });
  });

  it('should reject a duplicate Account label under the same Institution and accept the same label under a different Institution', async () => {
    const { catalog: c, institutionId } = await withInstitution();
    await c.save({ kind: 'CreateAccount', institutionId, label: 'Individual' });
    expect(await c.save({ kind: 'CreateAccount', institutionId, label: 'individual ' })).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'label', code: 'LabelNotDistinguishable' }],
    });
    const other = await c.save({ kind: 'CreateInstitution', label: 'Schwab' });
    if (other.kind !== 'Saved') throw new Error('institution not saved');
    expect(await c.save({ kind: 'CreateAccount', institutionId: other.record.id, label: 'Individual' })).toEqual(
      expect.objectContaining({ kind: 'Saved', selectableAccountCount: 2 }),
    );
    // An Account may share its Institution's label.
    expect(await c.save({ kind: 'CreateAccount', institutionId, label: 'Fidelity' })).toEqual(
      expect.objectContaining({ kind: 'Saved' }),
    );
  });
});
