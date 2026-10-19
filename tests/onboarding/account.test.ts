import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { query, save } from "../../src/catalog/save";
import { createAccount, createInstitution, onboardingFrom } from "../../src/onboarding";
import { closeCatalog, openCatalog, catalogRows } from "../support/domains";

describe("Account setup completes onboarding and reports readiness to plan honestly", () => {
  it("should keep the Account's Institution parent identity immutable while the displayed label follows a rename of that Institution", async () => {
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
      await save(seam, {
        type: "renameInstitution",
        id: institution.identity,
        label: "Fidelity Investments",
        expectedSnapshotRevision: 3,
      });

      const accounts = await query(seam, { kind: "account", view: "selectable" });
      const institutions = await query(seam, { kind: "institution", view: "selectable" });

      expect(accounts.outcome).toBe("Page");
      expect(institutions.outcome).toBe("Page");
      if (accounts.outcome === "Page" && institutions.outcome === "Page") {
        expect(accounts.records[0]?.parentId).toBe("institution:fidelity");
        expect(institutions.records[0]?.label).toBe("Fidelity Investments");
      }

      await closeCatalog(database);
    });

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

  it("should return the Account in the typed query under the Selectable-only default view in deterministic order", async () => {
      const { database, seam } = await openCatalog();
      await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
      const institution = await createInstitution(
        { seam: async () => seam },
        { label: "Fidelity", expectedSnapshotRevision: 1 },
      );
      if (institution.outcome !== "Created") throw new Error("not created");
      await createAccount(
        { seam: async () => seam },
        { institutionId: institution.identity, label: "Zulu", expectedSnapshotRevision: 2 },
      );
      await createAccount(
        { seam: async () => seam },
        { institutionId: institution.identity, label: "Alpha", expectedSnapshotRevision: 3 },
      );

      const page = await query(seam, { kind: "account", view: "selectable" });

      expect(page.outcome).toBe("Page");
      if (page.outcome === "Page") {
        expect(page.records.map((record) => record.label)).toEqual(["Alpha", "Zulu"]);
        expect(page.snapshotRevision).toBe(4);
      }

      await closeCatalog(database);
    });

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
