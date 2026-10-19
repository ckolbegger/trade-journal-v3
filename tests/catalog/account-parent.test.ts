import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog save and query handle Institution and Account identity, availability and history", () => {
  it("should reject Account creation with a typed Rejected naming the parent when the named Institution is archived or unknown, and write nothing", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const institution = await save(seam, {
      type: "createInstitution",
      label: "Fidelity",
      expectedSnapshotRevision: 1,
    });
    if (institution.outcome !== "Saved") throw new Error("the Institution was not created");
    await save(seam, {
      type: "archiveInstitution",
      id: institution.identity,
      expectedSnapshotRevision: 2,
    });
    const before = JSON.stringify(await catalogRows(seam));

    const archivedParent = await save(seam, {
      type: "createAccount",
      institutionId: institution.identity,
      label: "Brokerage One",
      expectedSnapshotRevision: 3,
    });
    const unknownParent = await save(seam, {
      type: "createAccount",
      institutionId: "institution:missing",
      label: "Brokerage Two",
      expectedSnapshotRevision: 3,
    });

    expect(archivedParent).toMatchObject({
      outcome: "Rejected",
      reason: "the parent Institution is archived",
      detail: "institution:fidelity",
    });
    expect(unknownParent).toMatchObject({
      outcome: "Rejected",
      reason: "the parent Institution is unknown",
      detail: "institution:missing",
    });
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    await closeCatalog(database);
  });
});
