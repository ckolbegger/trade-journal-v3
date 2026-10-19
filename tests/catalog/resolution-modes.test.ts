import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { resolveReference, save } from "../../src/catalog/save";
import { closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog save and query handle Institution and Account identity, availability and history", () => {
  it("should reject a new selection of an archived Institution or a retired Account with InactiveForRequestedUse while resolving the same identity as a retained reference successfully", async () => {
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

    await save(seam, { type: "retireAccount", id: account.identity, expectedSnapshotRevision: 3 });
    await save(seam, {
      type: "archiveInstitution",
      id: institution.identity,
      expectedSnapshotRevision: 4,
    });

    expect(
      await resolveReference(seam, {
        kind: "account",
        id: account.identity,
        mode: "newSelection",
      }),
    ).toEqual({ outcome: "InactiveForRequestedUse", identity: account.identity });
    expect(
      await resolveReference(seam, {
        kind: "institution",
        id: institution.identity,
        mode: "newSelection",
      }),
    ).toEqual({ outcome: "InactiveForRequestedUse", identity: institution.identity });

    expect(
      await resolveReference(seam, {
        kind: "institution",
        id: institution.identity,
        mode: "retainedReference",
      }),
    ).toMatchObject({ outcome: "Resolved", active: false, currentLabel: "Fidelity" });

    await closeCatalog(database);
  });
});
