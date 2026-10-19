import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { createInstitution, onboardingFrom } from "../../src/onboarding";
import { catalogRows, closeCatalog, openCatalog } from "../catalog/support";

describe("Institution onboarding creates the trader's own Institution and never invents one", () => {
  it("should show onboarding as Needs Institution and Account on a fresh Workspace and offer no preselected or fictional brokerage record", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    expect(await catalogRows(seam)).toEqual([
      expect.objectContaining({ kind: "strategy" }),
    ]);
    expect(
      onboardingFrom({ revision: 1, strategies: [], institutions: [], accounts: [] }),
    ).toBe("Needs Institution and Account");

    await closeCatalog(database);
  });

  it("should create the Institution through the production form and return the generated identity, the complete record and the new onboarding state without a follow-up query", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);

    const result = await createInstitution(
      { seam: async () => seam },
      { label: "Fidelity", expectedSnapshotRevision: 1 },
    );

    expect(result).toMatchObject({
      outcome: "Created",
      identity: "institution:fidelity",
      record: { kind: "institution", label: "Fidelity", revision: 1 },
      onboarding: "Needs Institution and Account",
      catalog: { revision: 2 },
    });
    if (result.outcome === "Created") {
      expect(result.catalog.institutions).toEqual([
        { id: "institution:fidelity", label: "Fidelity", archived: false, revision: 1 },
      ]);
    }

    await closeCatalog(database);
  });

  it("should return a typed conflict carrying the current catalog snapshot, preserve the trader's input and explain what must be reviewed when the expected snapshot is stale", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    await createInstitution(
      { seam: async () => seam },
      { label: "Fidelity", expectedSnapshotRevision: 1 },
    );
    const before = JSON.stringify(await catalogRows(seam));

    const stale = await createInstitution(
      { seam: async () => seam },
      { label: "Schwab", expectedSnapshotRevision: 1 },
    );

    expect(stale).toMatchObject({
      outcome: "Conflict",
      message: "This catalog changed while you were editing. Review it and try again.",
      current: { revision: 2 },
    });
    expect(JSON.stringify(await catalogRows(seam))).toBe(before);

    await closeCatalog(database);
  });

  it("should keep a historical and a current label both available after a rename of a retained reference", async () => {
    const { database, seam } = await openCatalog();
    await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
    const created = await createInstitution(
      { seam: async () => seam },
      { label: "Fidelity", expectedSnapshotRevision: 1 },
    );
    if (created.outcome !== "Created") throw new Error("not created");
    const { save, query } = await import("../../src/catalog/save");
    await save(seam, {
      type: "renameInstitution",
      id: created.identity,
      label: "Fidelity Investments",
      expectedSnapshotRevision: 2,
    });

    const page = await query(seam, { kind: "institution", view: "includeInactive" });
    expect(page.outcome).toBe("Page");
    if (page.outcome === "Page") {
      const record = page.records[0];
      expect(record?.label).toBe("Fidelity Investments");
      expect(record?.history).toEqual([
        { revision: 1, label: "Fidelity", inactive: false },
        { revision: 2, label: "Fidelity Investments", inactive: false },
      ]);
    }

    await closeCatalog(database);
  });
});
