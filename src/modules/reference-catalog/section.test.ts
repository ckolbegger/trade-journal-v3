import { describe, expect, it } from 'vitest';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import {
  D1_CATALOG_MANIFEST,
  D6_CATALOG_MANIFEST,
  prepareSeed,
  validateSection,
  type AccountRecord,
  type CatalogRecord,
  type CloseReasonRecord,
  type InstitutionRecord,
} from './index.ts';

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

describe('Catalog section, Close Reasons', () => {
  function d6Catalog(): CatalogRecord[] {
    const seed = prepareSeed([], D6_CATALOG_MANIFEST, sequentialIds('seed'));
    if (seed.kind !== 'Additions') throw new Error('seed conflict');
    return [...seed.records, institution('inst-1', 'Broker A'), account('acct-1', 'inst-1', 'Margin')];
  }
  const reason = (records: readonly CatalogRecord[], productKey: string) =>
    records.find((r): r is CloseReasonRecord => r.kind === 'CloseReason' && r.productKey === productKey)!;

  it('should report a seeded Close Reason that is inactive, and a Close Reason whose label is not distinguishable from another Close Reason', async () => {
    const clean = d6Catalog();
    const accepted = await validateSection(recordSourceOf({ catalog: clean }), D6_CATALOG_MANIFEST);

    expect(accepted.issues).toEqual([]);
    // Workspace closes the Trade section's Close Reason references against these.
    expect([...accepted.references.closeReasonIds]).toEqual(
      clean.filter((r) => r.kind === 'CloseReason').map((r) => r.id),
    );

    const target = reason(clean, 'close-reason.target-reached');
    const stop = reason(clean, 'close-reason.stop-triggered');
    const thesis = reason(clean, 'close-reason.thesis-invalidated');
    const records = clean.map((r) => {
      if (r.id === target.id) return { ...target, active: false };
      // Stop Triggered's label now reads as Thesis Invalidated's, after case and spacing.
      if (r.id === stop.id) return { ...stop, label: ' thesis   INVALIDATED', normalizedLabel: 'thesis invalidated' };
      return r;
    });
    const result = await validateSection(recordSourceOf({ catalog: records }), D6_CATALOG_MANIFEST);

    expect(result.issues).toEqual([
      { code: 'SeededRecordInactive', id: target.id, productKey: 'close-reason.target-reached' },
      { code: 'LabelNotDistinguishable', id: thesis.id, otherId: stop.id },
    ]);
    expect(result.repairs).toEqual([]);

    // A Close Reason under a product key this release's manifest does not seed, as Rolled is not before D21.
    const unseeded = { ...thesis, id: 'seed-9', productKey: 'close-reason.rolled', label: 'Rolled', normalizedLabel: 'rolled' };
    const unknown = await validateSection(recordSourceOf({ catalog: [...clean, unseeded] }), D6_CATALOG_MANIFEST);

    expect(unknown.issues).toEqual([{ code: 'UnknownSeedKey', id: 'seed-9', productKey: 'close-reason.rolled' }]);
  });

  it('should report UnknownSeedKey for a Close Reason carrying a Strategy product key and a Strategy carrying a Close Reason product key', async () => {
    const clean = d6Catalog();
    const strategy = clean.find((r) => r.kind === 'Strategy')!;
    const thesis = reason(clean, 'close-reason.thesis-invalidated');
    // Each key is in the manifest, but under the other family's list.
    const records = clean.map((r) => {
      if (r.id === strategy.id) return { ...strategy, productKey: 'close-reason.target-reached' };
      if (r.id === thesis.id) return { ...thesis, productKey: 'strategy.long-stock' };
      return r;
    });

    const result = await validateSection(recordSourceOf({ catalog: records }), D6_CATALOG_MANIFEST);

    expect(result.issues).toEqual([
      { code: 'UnknownSeedKey', id: strategy.id, productKey: 'close-reason.target-reached' },
      { code: 'UnknownSeedKey', id: thesis.id, productKey: 'strategy.long-stock' },
    ]);
  });
});
