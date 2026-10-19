import type { StrategyShape } from '../../domain/strategy.ts';

export interface CatalogSeedManifest {
  readonly version: number;
  readonly strategies: readonly { readonly productKey: string; readonly label: string; readonly shape: StrategyShape }[];
}

// D1 seeds only the Long Stock Strategy (decision 1); later deliverables add seeds as migrations.
export const D1_CATALOG_MANIFEST: CatalogSeedManifest = {
  version: 1,
  strategies: [
    {
      productKey: 'strategy.long-stock',
      label: 'Long Stock',
      shape: { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] },
    },
  ],
};
