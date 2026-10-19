import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog save and query handle Institution and Account identity, availability and history", () => {
  it("should return a typed Conflict carrying the current Catalog snapshot and write nothing when the supplied expected snapshot is stale", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    await save(seam, {
      type: "createInstitution",
      label: "Fidelity",
      expectedSnapshotRevision: 1,
    });
    const before = JSON.stringify(await catalogRows(seam));

    const stale = await save(seam, {
      type: "createInstitution",
      label: "Schwab",
      expectedSnapshotRevision: 1,
    });

    expect(stale.outcome).toBe("Conflict");
    if (stale.outcome === "Conflict") {
      expect(stale.current.revision).toBe(2);
      expect(stale.current.institutions.map((record) => record.label)).toEqual(["Fidelity"]);
    }
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    await closeCatalog(database);
  });
});
