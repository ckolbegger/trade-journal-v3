import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { createAccount } from "../../src/onboarding";
import { catalogRows, closeCatalog, openCatalog } from "../catalog/support";

describe("Account setup completes onboarding and reports readiness to plan honestly", () => {
  it("should reject a missing Institution choice with a field-level validation message and write nothing", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const before = JSON.stringify(await catalogRows(seam));

    const result = await createAccount(
      { seam: async () => seam },
      { institutionId: "", label: "Brokerage One", expectedSnapshotRevision: 1 },
    );

    expect(result).toEqual({
      outcome: "Rejected",
      message: "Choose the Institution this Account belongs to.",
      field: "institution",
    });
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    await closeCatalog(database);
  });
});
