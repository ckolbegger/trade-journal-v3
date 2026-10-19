import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should retain a trader rename and not reactivate a legitimately retired seed, returning the retained current label and availability", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    const strategy = (await catalogRows(seam)).find((row) => row.kind === "strategy") as Record<
      string,
      unknown
    >;
    await seam.commit({
      participants: [
        {
          store: "referenceCatalog",
          put: [{ ...strategy, label: "My Long Stock", retired: true, revision: 2 }],
        },
      ],
    });

    const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    expect(result).toMatchObject({ outcome: "Seeded", additions: [] });
    if (result.outcome === "Seeded") {
      expect(result.catalog.strategies[0]).toMatchObject({
        label: "My Long Stock",
        retired: true,
      });
    }
    const after = (await catalogRows(seam)).find((row) => row.kind === "strategy") as Record<
      string,
      unknown
    >;
    expect(after.revision).toBe(2);
    expect(after.label).toBe("My Long Stock");
    expect(after.retired).toBe(true);

    await closeCatalog(database);
  });
});
