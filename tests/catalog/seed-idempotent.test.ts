import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should be idempotent and stable-keyed: a second seed with the same manifest adds nothing, and a reworded label never causes a duplicate identity", async () => {
    const { database, seam } = await openCatalog();
    const first = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const second = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    const reworded = await seedDefaults(seam, {
      ...CATALOG_SEED_MANIFEST_V1,
      strategies: CATALOG_SEED_MANIFEST_V1.strategies.map((strategy) => ({
        ...strategy,
        label: "Long Stock Position",
      })),
    });

    expect(second).toMatchObject({ outcome: "Seeded", additions: [] });
    expect(reworded).toMatchObject({ outcome: "Seeded", additions: [] });
    expect((await catalogRows(seam)).filter((row) => row.kind === "strategy")).toHaveLength(1);
    if (first.outcome === "Seeded" && second.outcome === "Seeded") {
      expect(first.catalog.revision).toBe(second.catalog.revision);
    }

    await closeCatalog(database);
  });
});
