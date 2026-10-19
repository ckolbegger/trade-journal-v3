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
