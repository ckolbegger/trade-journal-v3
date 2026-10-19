import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog.seedDefaults seeds exactly manifest v1's declared identities and reports the catalog state", () => {
  it("should create no seeded Institution, no seeded Account, no Close Reason, no Abandonment Reason, no generic Custom or Other Strategy, no settlement-derived reason value and no Tag Type", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    const rows = await catalogRows(seam);
    const kinds = new Set(rows.map((row) => row.kind));
    const labels = rows.map((row) => String(row.label).toLowerCase());

    expect([...kinds]).toEqual(["strategy"]);
    expect(kinds.has("institution")).toBe(false);
    expect(kinds.has("account")).toBe(false);
    expect(kinds.has("closeReason")).toBe(false);
    expect(kinds.has("abandonmentReason")).toBe(false);
    expect(kinds.has("tagType")).toBe(false);
    expect(kinds.has("tagValue")).toBe(false);
    for (const forbidden of ["custom", "other", "expired", "assigned", "exercised", "never filled"]) {
      expect(labels).not.toContain(forbidden);
    }

    await closeCatalog(database);
  });
});
