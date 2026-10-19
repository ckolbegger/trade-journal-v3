import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { resolveReference, save } from "../../src/catalog/save";
import { catalogRows, closeCatalog, openCatalog } from "./support";

describe("ReferenceCatalog save and query handle Institution and Account identity, availability and history", () => {
  it("should append a rename revision under the same stable identity and return both the historical and the current label for a retained reference", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const institution = await save(seam, {
      type: "createInstitution",
      label: "Fidelity",
      expectedSnapshotRevision: 1,
    });
    if (institution.outcome !== "Saved") throw new Error("the Institution was not created");

    const renamed = await save(seam, {
      type: "renameInstitution",
      id: institution.identity,
      label: "Fidelity Investments",
      expectedSnapshotRevision: 2,
    });
    expect(renamed).toMatchObject({
      outcome: "Saved",
      identity: "institution:fidelity",
      historyHead: { revision: 2, label: "Fidelity Investments", inactive: false },
    });

    const record = (await catalogRows(seam)).find((row) => row.id === "institution:fidelity");
    expect(record?.revision).toBe(2);
    expect(record?.history).toEqual([
      { revision: 1, label: "Fidelity", inactive: false },
      { revision: 2, label: "Fidelity Investments", inactive: false },
    ]);

    const retained = await resolveReference(seam, {
      kind: "institution",
      id: "institution:fidelity",
      mode: "retainedReference",
    });
    expect(retained).toEqual({
      outcome: "Resolved",
      identity: "institution:fidelity",
      currentLabel: "Fidelity Investments",
      historicalLabel: "Fidelity",
      active: true,
    });

    await closeCatalog(database);
  });
});
