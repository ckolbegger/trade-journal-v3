import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { createAccount, createInstitution, onboardingFrom } from "../../src/onboarding";
import { closeCatalog, openCatalog } from "./../catalog/support";

describe("Account setup completes onboarding and reports readiness to plan honestly", () => {
  it("should create an Account under the chosen selectable Institution and move onboarding to Ready for Trade Planning only after both an Institution and a selectable Account exist", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const institution = await createInstitution(
      { seam: async () => seam },
      { label: "Fidelity", expectedSnapshotRevision: 1 },
    );
    if (institution.outcome !== "Created") throw new Error("not created");
    expect(institution.onboarding).toBe("Needs Institution and Account");

    const account = await createAccount(
      { seam: async () => seam },
      { institutionId: institution.identity, label: "Brokerage One", expectedSnapshotRevision: 2 },
    );
    expect(account).toMatchObject({
      outcome: "Created",
      record: { kind: "account", parentId: "institution:fidelity" },
      onboarding: "Ready for Trade Planning",
    });

    await closeCatalog(database);
  });

  it("should not report readiness to plan while the only Account is retired or while no Account exists", async () => {
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

    const retired = await save(seam, {
      type: "retireAccount",
      id: account.identity,
      expectedSnapshotRevision: 3,
    });

    expect(retired.outcome).toBe("Saved");
    if (retired.outcome === "Saved") {
      expect(onboardingFrom(retired.catalog)).toBe("Needs Institution and Account");
    }
    expect(onboardingFrom({ revision: 0, strategies: [], institutions: [], accounts: [] })).toBe(
      "Needs Institution and Account",
    );

    await closeCatalog(database);
  });
});
