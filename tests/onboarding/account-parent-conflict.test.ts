import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { createAccount, createInstitution } from "../../src/onboarding";
import { catalogRows, closeCatalog, openCatalog } from "../catalog/support";

describe("Account setup completes onboarding and reports readiness to plan honestly", () => {
  it("should reject an Account whose parent Institution was archived between form render and submit with a typed conflict, preserving input and writing nothing", async () => {
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
    const before = JSON.stringify(await catalogRows(seam));

    const result = await createAccount(
      { seam: async () => seam },
      { institutionId: institution.identity, label: "Brokerage One", expectedSnapshotRevision: 3 },
    );

    expect(result).toMatchObject({
      outcome: "ParentConflict",
      field: "institution",
      message: "The Institution is no longer selectable. Review it and choose again.",
    });
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    await closeCatalog(database);
  });
});
