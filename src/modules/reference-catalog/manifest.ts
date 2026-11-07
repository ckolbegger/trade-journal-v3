import type { StrategyShape } from '../../domain/strategy/index.ts';

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

// D7 adds the single-leg option Strategies, after Long Stock in seed order (A101). The
// Cash-Secured Put names trader intent: the application does not verify cash coverage.
export const D7_CATALOG_MANIFEST: CatalogSeedManifest = {
  version: 3,
  strategies: [
    ...D6_CATALOG_MANIFEST.strategies,
    { productKey: 'strategy.long-call', label: 'Long Call', shape: { roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] } },
    { productKey: 'strategy.long-put', label: 'Long Put', shape: { roles: [{ side: 'Long', instrument: 'Put', ratio: 1 }] } },
    { productKey: 'strategy.cash-secured-put', label: 'Cash-Secured Put', shape: { roles: [{ side: 'Short', instrument: 'Put', ratio: 1 }] } },
  ],
  closeReasons: D6_CATALOG_MANIFEST.closeReasons,
};
