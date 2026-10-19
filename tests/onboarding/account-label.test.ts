import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { query, save } from "../../src/catalog/save";
import { createAccount, createInstitution } from "../../src/onboarding";
import { closeCatalog, openCatalog } from "../catalog/support";

describe("Account setup completes onboarding and reports readiness to plan honestly", () => {
  it("should keep the Account's Institution parent identity immutable while the displayed label follows a rename of that Institution", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const institution = await createInstitution(
      { seam: async () => seam },
      { label: "Fidelity", expectedSnapshotRevision: 1 },
    );
    if (institution.outcome !== "Created") throw new Error("not created");
    const account = await createAccount(
      { seam: async () => seam },
      { institutionId: institution.identity, label: "Brokerage One", expectedSnapshotRevision: 2 },
    );
    if (account.outcome !== "Created") throw new Error("not created");
    await save(seam, {
      type: "renameInstitution",
      id: institution.identity,
      label: "Fidelity Investments",
      expectedSnapshotRevision: 3,
    });

    const accounts = await query(seam, { kind: "account", view: "selectable" });
    const institutions = await query(seam, { kind: "institution", view: "selectable" });

    expect(accounts.outcome).toBe("Page");
    expect(institutions.outcome).toBe("Page");
    if (accounts.outcome === "Page" && institutions.outcome === "Page") {
      expect(accounts.records[0]?.parentId).toBe("institution:fidelity");
      expect(institutions.records[0]?.label).toBe("Fidelity Investments");
    }

    await closeCatalog(database);
  });
});
