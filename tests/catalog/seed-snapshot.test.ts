import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should return the resulting Catalog snapshot, the exact additions and the selectable-Account summary Workspace needs for onboarding without a follow-up query", async () => {
    const { database, seam } = await openCatalog();

    const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    expect(result.outcome).toBe("Seeded");
    if (result.outcome === "Seeded") {
      expect(result.additions).toEqual(["strategy.long-stock"]);
      expect(result.catalog.strategies).toEqual([
        {
          stableKey: "strategy.long-stock",
          label: "Long Stock",
          shape: CATALOG_SEED_MANIFEST_V1.strategies[0]?.shape,
          retired: false,
        },
      ]);
      expect(result.catalog.revision).toBe(1);
      expect(result.selectableAccounts).toEqual([]);
    }

    await closeCatalog(database);
  });
});
