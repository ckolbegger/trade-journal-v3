import { describe, expect, it } from 'vitest';
import { recordSourceOf } from '../../../tests/support/record-source.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { D7_CATALOG_MANIFEST, prepareSeed, validateSection, type CatalogRecord, type StrategyRecord } from './index.ts';

function seeded(): StrategyRecord[] {
  const seed = prepareSeed([], D7_CATALOG_MANIFEST, sequentialIds('seed'));
  if (seed.kind !== 'Additions') throw new Error('seed conflict');
  return seed.records.filter((r): r is StrategyRecord => r.kind === 'Strategy');
}

describe('Catalog section, option Strategies', () => {
  it('should report a seeded option Strategy whose shape differs from its product key shape', async () => {
    const strategies = seeded();
    const clean = await validateSection(recordSourceOf({ catalog: strategies }), D7_CATALOG_MANIFEST);

    expect(clean.issues).toEqual([]);
    // Every Strategy's shape by identity, in the references Workspace passes on to the Trade section.
    expect(Object.fromEntries(clean.references.strategyShapes)).toEqual(Object.fromEntries(strategies.map((s) => [s.id, s.shape])));

    const [longStock, longCall, longPut, cashSecuredPut] = strategies as [StrategyRecord, StrategyRecord, StrategyRecord, StrategyRecord];
    const records: CatalogRecord[] = [
      longStock,
      // The Long Call carries a Put role; the inactive Long Put is still in the map and its shape is the manifest's.
      { ...longCall, shape: { roles: [{ side: 'Long', instrument: 'Put', ratio: 1 }] } },
      { ...longPut, active: false },
      // A different ratio is a different shape too.
      { ...cashSecuredPut, shape: { roles: [{ side: 'Short', instrument: 'Put', ratio: 2 }] } },
    ];

    const result = await validateSection(recordSourceOf({ catalog: records }), D7_CATALOG_MANIFEST);

    expect(result.issues).toEqual([
      { code: 'StrategyShapeMismatch', id: longCall.id, productKey: 'strategy.long-call' },
      { code: 'StrategyShapeMismatch', id: cashSecuredPut.id, productKey: 'strategy.cash-secured-put' },
    ]);
    expect(result.references.strategyShapes.get(longPut.id)).toEqual(longPut.shape);
    expect(result.references.strategyShapes.size).toBe(4);
  });
});
