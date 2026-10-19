import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { createInstitution } from "../../src/onboarding";
import { catalogRows, closeCatalog, openCatalog } from "../catalog/support";

describe("Institution onboarding creates the trader's own Institution and never invents one", () => {
  it("should reject an empty or whitespace-only required name with a field-level validation message and write nothing", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const before = JSON.stringify(await catalogRows(seam));
    const ports = { seam: async () => seam };

    const empty = await createInstitution(ports, { label: "", expectedSnapshotRevision: 1 });
    const whitespace = await createInstitution(ports, {
      label: "   ",
      expectedSnapshotRevision: 1,
    });

    expect(empty).toEqual({
      outcome: "Rejected",
      message: "Enter the brokerage name.",
      field: "name",
    });
    expect(whitespace).toEqual({
      outcome: "Rejected",
      message: "Enter the brokerage name.",
      field: "name",
    });
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    await closeCatalog(database);
  });
});
