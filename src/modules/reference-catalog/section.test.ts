import { describe, expect, it } from 'vitest';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { D1_CATALOG_MANIFEST, prepareSeed, validateSection, type AccountRecord, type CatalogRecord, type InstitutionRecord } from './index.ts';

function institution(id: string, label: string): InstitutionRecord {
  return { id, kind: 'Institution', label, normalizedLabel: label.toLowerCase(), active: true, origin: 'Trader', recordRevision: 1 };
}

function account(id: string, institutionId: string, label: string): AccountRecord {
  return { id, kind: 'Account', institutionId, label, normalizedLabel: label.toLowerCase(), active: true, origin: 'Trader', recordRevision: 1 };
}

// The seeded Catalog as seedDefaults leaves it, with the trader's Institutions and Accounts.
function seededCatalog(): CatalogRecord[] {
  const seed = prepareSeed([], D1_CATALOG_MANIFEST, sequentialIds('seed'));
  if (seed.kind !== 'Additions') throw new Error('seed conflict');
  return [
    ...seed.records,
    institution('inst-1', 'Broker A'),
    account('acct-1', 'inst-1', 'Margin'),
    institution('inst-2', 'Broker B'),
    account('acct-2', 'inst-1', 'IRA'),
    account('acct-3', 'inst-2', 'Cash'),
  ];
}

describe('Catalog section', () => {
  it('should accept the seeded Catalog with Institutions and Accounts', async () => {
    const result = await validateSection(recordSourceOf({ catalog: seededCatalog() }), D1_CATALOG_MANIFEST);

    expect(result.issues).toEqual([]);
    expect(result.repairs).toEqual([]);
    // Workspace closes the Trade section's Account references against these.
    expect([...result.references.accountIds].sort()).toEqual(['acct-1', 'acct-2', 'acct-3']);
  });

  it('should report DuplicateIdentity, MissingParent Account whose Institution is absent, and UnknownSeedKey', async () => {
    const seed = prepareSeed([], D1_CATALOG_MANIFEST, sequentialIds('seed'));
    if (seed.kind !== 'Additions') throw new Error('seed conflict');
    const unknownSeed = { ...seed.records[0]!, id: 'seed-9', productKey: 'strategy.covered-call', label: 'Covered Call', normalizedLabel: 'covered call' };
    const records = [
      ...seededCatalog(),
      // Same identity as an earlier record, in a later batch.
      account('inst-1', 'inst-2', 'Duplicate'),
      account('acct-4', 'inst-missing', 'Orphan'),
      unknownSeed,
    ];

    const result = await validateSection(recordSourceOf({ catalog: records }), D1_CATALOG_MANIFEST);

    expect(result.issues).toEqual([
      { code: 'DuplicateIdentity', id: 'inst-1' },
      { code: 'UnknownSeedKey', id: 'seed-9', productKey: 'strategy.covered-call' },
      { code: 'MissingParent', id: 'acct-4', parentId: 'inst-missing' },
    ]);
    expect(result.repairs).toEqual([]);
  });
});
