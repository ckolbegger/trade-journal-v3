import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should return a typed SeedConflict and write nothing when a known stable product key already exists with an incompatible shape", async () => {
    const { database, seam } = await openCatalog();
    await seam.commit({
      participants: [
        {
          store: "referenceCatalog",
          put: [
            {
              id: "strategy:strategy.long-stock",
              kind: "strategy",
              stableKey: "strategy.long-stock",
              label: "Long Stock",
              revision: 1,
              retired: false,
              shape: {
                roles: [
                  { side: "long", kind: "stock", quantity: "1" },
                  { side: "long", kind: "call", quantity: "1" },
                ],
                constraints: [],
              },
            },
          ],
        },
      ],
    });
    const before = JSON.stringify(await catalogRows(seam));

    const result = await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    expect(result).toMatchObject({
      outcome: "SeedConflict",
      stableKey: "strategy.long-stock",
    });
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    await closeCatalog(database);
  });
});
