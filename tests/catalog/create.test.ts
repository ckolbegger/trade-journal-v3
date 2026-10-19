import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { save } from "../../src/catalog/save";
import { closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog save and query handle Institution and Account identity, availability and history", () => {
  it("should create an Institution and return the generated stable identity, the complete current record, the appended history head and the new Catalog snapshot, so the caller needs no query", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    const result = await save(seam, {
      type: "createInstitution",
      label: "Fidelity",
      expectedSnapshotRevision: 1,
    });

    expect(result).toMatchObject({
      outcome: "Saved",
      identity: "institution:fidelity",
      record: { id: "institution:fidelity", kind: "institution", label: "Fidelity", revision: 1 },
      historyHead: { revision: 1, label: "Fidelity", inactive: false },
      catalog: { revision: 2 },
    });
    if (result.outcome === "Saved") {
      expect(result.catalog.institutions).toEqual([
        { id: "institution:fidelity", label: "Fidelity", archived: false, revision: 1 },
      ]);
    }

    await closeCatalog(database);
  });

  it("should create an Account under a selectable Institution and bind its Institution parent immutably for the life of that identity", async () => {
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
    expect(account).toMatchObject({
      outcome: "Saved",
      record: { kind: "account", parentId: "institution:fidelity", revision: 1 },
    });

    const renamed = await save(seam, {
      type: "renameInstitution",
      id: institution.identity,
      label: "Fidelity Investments",
      expectedSnapshotRevision: 3,
    });
    expect(renamed).toMatchObject({ outcome: "Saved" });
    if (account.outcome === "Saved" && renamed.outcome === "Saved") {
      expect(renamed.catalog.accounts[0]?.institutionId).toBe("institution:fidelity");
    }

    await closeCatalog(database);
  });
});
