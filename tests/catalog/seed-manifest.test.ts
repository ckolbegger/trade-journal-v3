import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should create exactly the Long Stock Strategy under its stable product key with one long Stock role and the contract's shape vocabulary, and no other Strategy", async () => {
    const { database, seam } = await openCatalog();

    const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    expect(result).toMatchObject({
      outcome: "Seeded",
      seedVersion: "catalog-seed-v1",
      additions: ["strategy.long-stock"],
    });
    const strategies = (await catalogRows(seam)).filter((row) => row.kind === "strategy");
    expect(strategies).toHaveLength(1);
    expect(strategies[0]).toMatchObject({
      stableKey: "strategy.long-stock",
      label: "Long Stock",
      revision: 1,
      retired: false,
      shape: {
        roles: [{ side: "long", kind: "stock", quantity: "1" }],
        constraints: [{ kind: "sameUnderlying", detail: "one Underlying" }],
      },
    });

    await closeCatalog(database);
  });
});
