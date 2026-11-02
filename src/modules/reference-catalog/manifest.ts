import type { StrategyShape } from '../../domain/strategy.ts';

export interface CatalogSeedManifest {
  readonly version: number;
  readonly strategies: readonly { readonly productKey: string; readonly label: string; readonly shape: StrategyShape }[];
  // Seed order is the array order; manifests before v2 declare none.
  readonly closeReasons?: readonly { readonly productKey: string; readonly label: string }[];
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

// D6 adds the four Close Reasons; Rolled arrives with Roll support (D21).
export const D6_CATALOG_MANIFEST: CatalogSeedManifest = {
  version: 2,
  strategies: D1_CATALOG_MANIFEST.strategies,
  closeReasons: [
    { productKey: 'close-reason.target-reached', label: 'Target Reached' },
    { productKey: 'close-reason.stop-triggered', label: 'Stop Triggered' },
    { productKey: 'close-reason.thesis-invalidated', label: 'Thesis Invalidated' },
    { productKey: 'close-reason.time-based-exit', label: 'Time-Based Exit' },
  ],
};
