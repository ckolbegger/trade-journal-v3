import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog save and query handle Institution and Account identity, availability and history", () => {
  it("should refuse to archive an Institution that has selectable Accounts, and refuse reactivation whose meaning changed, with typed rejections and no writes", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const institution = await save(seam, {
      type: "createInstitution",
      label: "Fidelity",
      expectedSnapshotRevision: 1,
    });
    if (institution.outcome !== "Saved") throw new Error("the Institution was not created");
    const account = await save(seam, {
      type: "createAccount",
      institutionId: institution.identity,
      label: "Brokerage One",
      expectedSnapshotRevision: 2,
    });
    if (account.outcome !== "Saved") throw new Error("the Account was not created");

    const archiveWithAccounts = await save(seam, {
      type: "archiveInstitution",
      id: institution.identity,
      expectedSnapshotRevision: 3,
    });
    expect(archiveWithAccounts).toMatchObject({
      outcome: "Rejected",
      reason: "an Institution with selectable Accounts cannot be archived",
    });

    await save(seam, { type: "retireAccount", id: account.identity, expectedSnapshotRevision: 3 });
    await save(seam, {
      type: "archiveInstitution",
      id: institution.identity,
      expectedSnapshotRevision: 4,
    });
    const before = JSON.stringify(await catalogRows(seam));

    const changedMeaning = await save(seam, {
      type: "reactivateInstitution",
      id: institution.identity,
      label: "Something Else",
      expectedSnapshotRevision: 5,
    });
    expect(changedMeaning).toMatchObject({
      outcome: "Rejected",
      reason: "reactivation cannot change the meaning of the identity",
    });
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    const reactivated = await save(seam, {
      type: "reactivateInstitution",
      id: institution.identity,
      expectedSnapshotRevision: 5,
    });
    expect(reactivated).toMatchObject({ outcome: "Saved" });

    await closeCatalog(database);
  });
});
