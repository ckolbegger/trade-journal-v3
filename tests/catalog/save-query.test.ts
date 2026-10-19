import { describe, expect, it } from "vitest";
import { CATALOG_SEED_MANIFEST_V1, seedDefaults } from "../../src/catalog";
import { save, query, resolveReference } from "../../src/catalog/save";
import { catalogRows, closeCatalog, openCatalog } from "../support/domains";

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

  it("should list one typed family in deterministic label-and-identity order with snapshot-bound pagination and an Include-inactive view, and return complete history for one identity", async () => {
      const { database, seam } = await openCatalog();
      await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
      for (const [index, label] of ["Beta", "Alpha", "Gamma"].entries()) {
        await save(seam, {
          type: "createInstitution",
          label,
          expectedSnapshotRevision: index + 1,
        });
      }
      await save(seam, {
        type: "archiveInstitution",
        id: "institution:beta",
        expectedSnapshotRevision: 4,
      });
      await save(seam, {
        type: "renameInstitution",
        id: "institution:alpha",
        label: "Zeta Prime",
        expectedSnapshotRevision: 5,
      });

      const selectable = await query(seam, { kind: "institution", view: "selectable" });
      expect(selectable.outcome).toBe("Page");
      if (selectable.outcome === "Page") {
        expect(selectable.records.map((record) => record.label)).toEqual(["Gamma", "Zeta Prime"]);
        expect(selectable.snapshotRevision).toBe(6);
      }

      const includeInactive = await query(seam, { kind: "institution", view: "includeInactive" });
      if (includeInactive.outcome === "Page") {
        expect(includeInactive.records.map((record) => record.label)).toEqual([
          "Beta",
          "Gamma",
          "Zeta Prime",
        ]);
      }

      const firstPage = await query(seam, {
        kind: "institution",
        view: "includeInactive",
        limit: 2,
      });
      expect(firstPage.outcome).toBe("Page");
      if (firstPage.outcome === "Page") {
        expect(firstPage.records.map((record) => record.label)).toEqual(["Beta", "Gamma"]);
        expect(firstPage.nextCursor).toBe("institution:gamma");
      }

      const history = await query(seam, {
        kind: "institution",
        view: "includeInactive",
        identity: "institution:alpha",
      });
      if (history.outcome === "Page") {
        expect(history.records[0]?.label).toBe("Zeta Prime");
        expect(history.history).toEqual([
          { revision: 1, label: "Alpha", inactive: false },
          { revision: 2, label: "Zeta Prime", inactive: false },
        ]);
      }

      await closeCatalog(database);
    });

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

  it("should return a typed Conflict carrying the current Catalog snapshot and write nothing when the supplied expected snapshot is stale", async () => {
      const { database, seam } = await openCatalog();
      await seedDefaults(seam, CATALOG_SEED_MANIFEST_V1);
      await save(seam, {
        type: "createInstitution",
        label: "Fidelity",
        expectedSnapshotRevision: 1,
      });
      const before = JSON.stringify(await catalogRows(seam));

      const stale = await save(seam, {
        type: "createInstitution",
        label: "Schwab",
        expectedSnapshotRevision: 1,
      });

      expect(stale.outcome).toBe("Conflict");
      if (stale.outcome === "Conflict") {
        expect(stale.current.revision).toBe(2);
        expect(stale.current.institutions.map((record) => record.label)).toEqual(["Fidelity"]);
      }
      expect(JSON.stringify(await catalogRows(seam))).toBe(before);

      await closeCatalog(database);
    });
});
