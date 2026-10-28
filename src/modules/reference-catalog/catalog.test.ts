import { describe, expect, it } from 'vitest';
import { createReferenceCatalog, D1_CATALOG_MANIFEST } from './index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';

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

  it('should seed the defaults exactly once and advance catalogRevision once when two seeds run at once', async () => {
    const { catalog: c, persistence } = await catalog();
    const results = await Promise.all([c.seedDefaults(D1_CATALOG_MANIFEST), c.seedDefaults(D1_CATALOG_MANIFEST)]);
    const additions = results.map((r) => (r.kind === 'Seeded' ? r.additions : null));
    expect(additions).toContainEqual(['strategy.long-stock']);
    expect(additions).toContainEqual([]);
    const stored = await persistence.readSnapshot(['catalog', 'meta'], async (tx) => ({
      records: await tx.getAll('catalog'),
      meta: await tx.get('meta', 'catalog'),
    }));
    expect(stored.value.records.filter((r) => r['productKey'] === 'strategy.long-stock')).toHaveLength(1);
    expect(stored.value.meta?.['catalogRevision']).toBe(1);
  });

  it('should return its typed conflict and write nothing after 3 attempts when catalogRevision keeps moving', async () => {
    const { persistence } = await emptyWorkspace();
    let attempts = 0;
    const wrapped: typeof persistence = {
      ...persistence,
      commit: async (set) => {
        attempts += 1;
        await persistence.commit({ checks: [], writes: [{ op: 'put', store: 'meta', value: { key: 'catalog', catalogRevision: attempts } }] });
        return persistence.commit(set);
      },
    };
    const c = createReferenceCatalog({ persistence: wrapped, ids: sequentialIds() });
    expect(await c.seedDefaults(D1_CATALOG_MANIFEST)).toEqual({ kind: 'Conflict' });
    expect(attempts).toBe(3);
    const stored = await persistence.readSnapshot(['catalog'], (tx) => tx.getAll('catalog'));
    expect(stored.value).toEqual([]);
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

describe('query', () => {
  it('should list selectable Institutions, Accounts, and Strategies ordered by normalized label then identity, in pages bound to the Catalog snapshot', async () => {
    const { catalog: c } = await catalog();
    await c.seedDefaults(D1_CATALOG_MANIFEST);
    const labels = ['schwab', 'Fidelity', 'E*TRADE'];
    const ids: string[] = [];
    for (const label of labels) {
      const saved = await c.save({ kind: 'CreateInstitution', label });
      if (saved.kind === 'Saved') ids.push(saved.record.id);
    }
    await c.save({ kind: 'CreateAccount', institutionId: ids[1]!, label: 'Roth' });

    const first = await c.query({ family: 'Institution', pageSize: 2 });
    expect(first).toEqual({
      kind: 'Page',
      items: [expect.objectContaining({ label: 'E*TRADE' }), expect.objectContaining({ label: 'Fidelity' })],
      snapshot: { catalogRevision: 5 },
      nextCursor: expect.any(String) as string,
    });
    if (first.kind !== 'Page' || !first.nextCursor) throw new Error('expected a next page');
    const second = await c.query({ family: 'Institution', pageSize: 2, cursor: first.nextCursor });
    expect(second).toEqual({
      kind: 'Page',
      items: [expect.objectContaining({ label: 'schwab' })],
      snapshot: { catalogRevision: 5 },
    });
    const accounts = await c.query({ family: 'Account' });
    expect(accounts.kind === 'Page' && accounts.items.map((a) => a.label)).toEqual(['Roth']);
    const strategies = await c.query({ family: 'Strategy' });
    expect(strategies.kind === 'Page' && strategies.items.map((a) => a.label)).toEqual(['Long Stock']);
  });

  it('should reject a cursor with CursorExpired after any Catalog change', async () => {
    const { catalog: c } = await catalog();
    for (const label of ['A', 'B', 'C']) await c.save({ kind: 'CreateInstitution', label });
    const first = await c.query({ family: 'Institution', pageSize: 2 });
    if (first.kind !== 'Page' || !first.nextCursor) throw new Error('expected a next page');
    await c.save({ kind: 'CreateInstitution', label: 'D' });
    expect(await c.query({ family: 'Institution', pageSize: 2, cursor: first.nextCursor })).toEqual({
      kind: 'CursorExpired',
      snapshot: { catalogRevision: 4 },
    });
  });
});

describe('resolve', () => {
  async function seededWithAccount() {
    const setup = await catalog();
    await setup.catalog.seedDefaults(D1_CATALOG_MANIFEST);
    const institution = await setup.catalog.save({ kind: 'CreateInstitution', label: 'Fidelity' });
    if (institution.kind !== 'Saved') throw new Error('institution not saved');
    const account = await setup.catalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Roth' });
    if (account.kind !== 'Saved') throw new Error('account not saved');
    const strategies = await setup.catalog.query({ family: 'Strategy' });
    if (strategies.kind !== 'Page') throw new Error('no strategies');
    return { ...setup, institution: institution.record, account: account.record, strategy: strategies.items[0]! };
  }

  it('should resolve a selectable Account and Strategy as NewSelection with record revisions and the Account\'s Institution', async () => {
    const { catalog: c, institution, account, strategy } = await seededWithAccount();
    expect(
      await c.resolve([
        { name: 'account', kind: 'Account', id: account.id, mode: 'NewSelection' },
        { name: 'strategy', kind: 'Strategy', id: strategy.id, mode: 'NewSelection' },
      ]),
    ).toEqual({
      kind: 'Resolved',
      snapshot: { catalogRevision: 3 },
      resolved: {
        account: {
          id: account.id,
          kind: 'Account',
          label: 'Roth',
          recordRevision: 1,
          selectable: true,
          institution: { id: institution.id, label: 'Fidelity', recordRevision: 1 },
        },
        strategy: {
          id: strategy.id,
          kind: 'Strategy',
          label: 'Long Stock',
          recordRevision: 1,
          selectable: true,
          shape: { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] },
        },
      },
    });
  });

  it('should return every issue at once when an identity is unknown or of the wrong kind', async () => {
    const { catalog: c, institution } = await seededWithAccount();
    expect(
      await c.resolve([
        { name: 'account', kind: 'Account', id: institution.id, mode: 'NewSelection' },
        { name: 'strategy', kind: 'Strategy', id: 'missing', mode: 'NewSelection' },
      ]),
    ).toEqual({
      kind: 'Unresolved',
      snapshot: { catalogRevision: 3 },
      issues: [
        { name: 'account', code: 'WrongKind' },
        { name: 'strategy', code: 'UnknownReference' },
      ],
    });
  });

  it('should resolve DisplayOnly to the current label without granting selection eligibility', async () => {
    const { catalog: c, institution } = await seededWithAccount();
    const result = await c.resolve([{ name: 'shown', kind: 'Institution', id: institution.id, mode: 'DisplayOnly' }]);
    expect(result).toEqual({
      kind: 'Resolved',
      snapshot: { catalogRevision: 3 },
      resolved: {
        shown: { id: institution.id, kind: 'Institution', label: 'Fidelity', recordRevision: 1, selectable: false },
      },
    });
  });
});
