import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { query, save } from "../../src/catalog/save";
import { createInstitution } from "../../src/onboarding";
import { closeCatalog, openCatalog } from "../catalog/support";

describe("Institution onboarding creates the trader's own Institution and never invents one", () => {
  it("should present an inactive Institution as Archived everywhere and never offer it as the parent for a new Account", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const institution = await createInstitution(
      { seam: async () => seam },
      { label: "Fidelity", expectedSnapshotRevision: 1 },
    );
    if (institution.outcome !== "Created") throw new Error("not created");
    await save(seam, {
      type: "archiveInstitution",
      id: institution.identity,
      expectedSnapshotRevision: 2,
    });

    const selectable = await query(seam, { kind: "institution", view: "selectable" });
    const includeInactive = await query(seam, { kind: "institution", view: "includeInactive" });

    expect(selectable.outcome).toBe("Page");
    expect(includeInactive.outcome).toBe("Page");
    if (selectable.outcome === "Page" && includeInactive.outcome === "Page") {
      expect(selectable.records).toEqual([]);
      expect(includeInactive.records[0]).toMatchObject({ label: "Fidelity", retired: true });
    }

    await closeCatalog(database);
  });
});
