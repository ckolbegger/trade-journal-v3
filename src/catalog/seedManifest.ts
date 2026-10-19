export interface StrategyRole {
  readonly side: "long" | "short";
  readonly kind: "stock" | "call" | "put";
  /** Positive relative quantity, an exact decimal string. */
  readonly quantity: string;
}

export interface StrategyShape {
  readonly roles: readonly StrategyRole[];
  readonly constraints: readonly {
    readonly kind: "sameUnderlying" | "expirationOrder" | "strikeOrder" | "shareCoverage";
    readonly detail: string;
  }[];
}

export interface StrategySeed {
  readonly stableKey: string;
  readonly label: string;
  readonly shape: StrategyShape;
}

export interface CatalogSeedManifest {
  readonly version: string;
  readonly strategies: readonly StrategySeed[];
}

/** Seed manifest v1 declares the Long Stock Strategy only (`vertical-deliverables.md:62`). */
export const CATALOG_SEED_MANIFEST_V1: CatalogSeedManifest = {
  version: "catalog-seed-v1",
  strategies: [
    {
      stableKey: "strategy.long-stock",
      label: "Long Stock",
      shape: {
        roles: [{ side: "long", kind: "stock", quantity: "1" }],
        constraints: [{ kind: "sameUnderlying", detail: "one Underlying" }],
      },
    },
  ],
};

/**
 * Manifest v2. The Catalog side adds no identity that v1 did not already seed (decision PD15); the
 * version advances because the Journal side installs the exact Plan Reflection definition. The
 * remaining ten Strategies, the reason taxonomies and the IdeaSource Tag Type are not seeded until
 * D8, D9, D11 and D12, so their absence is never presented as a domain `Unavailable`.
 */
export const CATALOG_SEED_MANIFEST_V2: CatalogSeedManifest = {
  version: "catalog-seed-v2",
  strategies: CATALOG_SEED_MANIFEST_V1.strategies,
};
