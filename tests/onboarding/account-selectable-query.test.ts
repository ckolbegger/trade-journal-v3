import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { query } from "../../src/catalog/save";
import { createAccount, createInstitution } from "../../src/onboarding";
import { closeCatalog, openCatalog } from "../catalog/support";

describe("Account setup completes onboarding and reports readiness to plan honestly", () => {
  it("should return the Account in the typed query under the Selectable-only default view in deterministic order", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const institution = await createInstitution(
      { seam: async () => seam },
      { label: "Fidelity", expectedSnapshotRevision: 1 },
    );
    if (institution.outcome !== "Created") throw new Error("not created");
    await createAccount(
      { seam: async () => seam },
      { institutionId: institution.identity, label: "Zulu", expectedSnapshotRevision: 2 },
    );
    await createAccount(
      { seam: async () => seam },
      { institutionId: institution.identity, label: "Alpha", expectedSnapshotRevision: 3 },
    );

    const page = await query(seam, { kind: "account", view: "selectable" });

    expect(page.outcome).toBe("Page");
    if (page.outcome === "Page") {
      expect(page.records.map((record) => record.label)).toEqual(["Alpha", "Zulu"]);
      expect(page.snapshotRevision).toBe(4);
    }

    await closeCatalog(database);
  });
});
