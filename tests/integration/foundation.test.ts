import { afterEach, describe, expect, it } from "vitest";
import { query } from "../../src/catalog/save";
import { createAccount, createInstitution } from "../../src/onboarding";
import { openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { establishReadiness } from "../../src/readiness";
import { buildRelease, closeAll, initializeWorkspace, openStore, readinessPorts, type ReadinessOptions } from "./support";

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
  afterEach(async () => {
    await closeAll();
  });

  it("should start from a clean origin, pass the real readiness gate, initialize the Workspace, create an Institution and an Account, and prove the durable after-state through one production request/response path per layer", async () => {
      const cache = await buildRelease();
      const { database, seam } = await openStore();
      const readiness = await establishReadiness(readinessPorts(database, cache));
      expect(readiness.outcome).toBe("Writable");

      const opened = await initializeWorkspace(seam, readiness);
      expect(opened.outcome).toBe("Opened");

      const seeded = await seam.snapshot(["referenceCatalog", "journal"]);
      expect(seeded.rows("referenceCatalog").map((row) => row.label)).toContain("Long Stock");
      expect(seeded.rows("journal").length).toBeGreaterThan(0);

      const institution = await createInstitution(
        { seam: async () => seam },
        { label: "Fidelity", expectedSnapshotRevision: 1 },
      );
      expect(institution.outcome).toBe("Created");
      const account = await createAccount(
        { seam: async () => seam },
        { institutionId: "institution:fidelity", label: "Brokerage One", expectedSnapshotRevision: 2 },
      );
      expect(account).toMatchObject({ outcome: "Created", onboarding: "Ready for Trade Planning" });

      const revisions = async (): Promise<unknown> => {
        const snapshot = await seam.snapshot(["workspaceMeta"]);
        return snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")?.value;
      };
      const before = await revisions();
      database.close();

      const reopened = await openDatabase();
      const reopenedSeam = createTransactionSeam(
        reopened,
        createWriteGate({ current: async () => ({ outcome: "Writable", failedChecks: [] }) }),
      );
      const institutions = await query(reopenedSeam, { kind: "institution", view: "selectable" });
      const accounts = await query(reopenedSeam, { kind: "account", view: "selectable" });
      expect(institutions.outcome).toBe("Page");
      expect(accounts.outcome).toBe("Page");
      if (institutions.outcome === "Page" && accounts.outcome === "Page") {
        expect(institutions.records.map((record) => record.label)).toEqual(["Fidelity"]);
        expect(accounts.records.map((record) => record.label)).toEqual(["Brokerage One"]);
      }
      const after = await reopenedSeam.snapshot(["workspaceMeta"]);
      expect(after.rows("workspaceMeta").find((row) => row.key === "revisions")?.value).toEqual(before);
      reopened.close();
    });
});

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
  afterEach(async () => {
    await closeAll();
  });

  const SINGLE_FAILURES: readonly { name: string; options: ReadinessOptions; check: string }[] = [
    {
      name: "diagnostic transaction",
      options: { diagnostic: { outcome: "Failed", detail: "the isolated transaction was refused" } },
      check: "diagnostic-transaction",
    },
    { name: "capacity", options: { capacityFreeBytes: 1 }, check: "capacity" },
    {
      name: "service-worker control",
      options: { workerControl: { kind: "NotControlled", reason: "no controller" } },
      check: "service-worker-control",
    },
    {
      name: "inventory",
      options: {
        inventory: { outcome: "Incomplete", failures: [{ kind: "Missing", assetUrl: "assets/app.js" }] },
      },
      check: "offline-release-inventory",
    },
  ];

  it("should return RuntimeNotWritable from Workspace initialization and from the persistence seam with unchanged authoritative revisions for each single failed check and for the simultaneous-failure case", async () => {
      for (const failure of SINGLE_FAILURES) {
        await closeAll();
        const cache = await buildRelease();
        const { database, seam, decisions } = await openStore();
        const readiness = await establishReadiness(readinessPorts(database, cache, failure.options));
        expect(readiness.outcome, failure.name).not.toBe("Writable");
        expect(readiness.failedChecks.map((entry) => entry.check)).toContain(failure.check);

        const initialized = await initializeWorkspace(seam, readiness);
        expect(initialized.outcome).toBe("RuntimeNotWritable");

        decisions.current = {
          outcome: "Unsupported",
          failedChecks: readiness.failedChecks,
          existingRootUnreadable: false,
          safeActions: readiness.safeActions,
        };
        const before = await seam.snapshot(["workspaceMeta", "referenceCatalog"]);
        const refused = await seam.commit({
          participants: [{ store: "referenceCatalog", put: [{ id: "institution:x", kind: "institution" }] }],
        });
        expect(refused.kind).toBe("Rejected");
        const after = await seam.snapshot(["workspaceMeta", "referenceCatalog"]);
        expect(after.rows("referenceCatalog")).toEqual(before.rows("referenceCatalog"));
        expect(after.rows("workspaceMeta")).toEqual(before.rows("workspaceMeta"));
        database.close();
      }

      await closeAll();
      const cache = await buildRelease();
      const { database } = await openStore();
      const simultaneous = await establishReadiness(
        readinessPorts(database, cache, {
          diagnostic: { outcome: "Failed", detail: "refused" },
          capacityFreeBytes: 1,
        }),
      );
      expect(simultaneous.outcome).not.toBe("Writable");
      expect(simultaneous.failedChecks.map((entry) => entry.check)).toEqual(
        expect.arrayContaining(["diagnostic-transaction", "capacity"]),
      );
      database.close();
    });
});

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
  afterEach(async () => {
    await closeAll();
  });

  it("should re-establish readiness on each of three consecutive launches and reject the next mutation when a release-integrity failure is injected during a running session", async () => {
      const cache = await buildRelease();
      const { database, seam, decisions } = await openStore();
      for (let launch = 0; launch < 3; launch += 1) {
        const readiness = await establishReadiness(readinessPorts(database, cache));
        expect(readiness.outcome, `launch ${launch + 1}`).toBe("Writable");
      }

      cache.entries.delete("/assets/app.js");
      const broken = await establishReadiness(readinessPorts(database, cache));
      expect(broken.outcome).not.toBe("Writable");
      expect(broken.failedChecks.map((entry) => entry.check)).toContain("offline-release-inventory");

      decisions.current = {
        outcome: "Unsupported",
        failedChecks: broken.failedChecks,
        existingRootUnreadable: false,
        safeActions: broken.safeActions,
      };
      const before = await seam.snapshot(["workspaceMeta", "referenceCatalog"]);
      const refused = await seam.commit({
        participants: [{ store: "referenceCatalog", put: [{ id: "institution:x", kind: "institution" }] }],
      });
      expect(refused.kind).toBe("Rejected");
      const after = await seam.snapshot(["workspaceMeta", "referenceCatalog"]);
      expect(after.rows("workspaceMeta")).toEqual(before.rows("workspaceMeta"));
      expect(after.rows("referenceCatalog")).toEqual(before.rows("referenceCatalog"));
      database.close();
      await openDatabase().then((handle) => handle.close());
    });
});

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
  afterEach(async () => {
    await closeAll();
  });

  it("should roll back every participating store to its prior revision when one participant fails inside a multi-store semantic commit", async () => {
      const { database, seam, decisions } = await openStore();
      decisions.current = { outcome: "Writable", failedChecks: [] };
      const seeded = await seam.commit({
        participants: [
          { store: "journal", put: [{ id: "journal:1", anchorKey: "trade:1:open" }] },
          { store: "tradeRecord", put: [{ id: "trade:1", kind: "trade" }] },
        ],
        counters: ["journalEntries"],
      });
      expect(seeded.kind).toBe("Committed");
      const before = await seam.snapshot(["workspaceMeta", "journal", "tradeRecord"]);

      const failing = seam.commit({
        participants: [
          { store: "journal", put: [{ id: "journal:2", anchorKey: "trade:2:open" }] },
          {
            store: "tradeRecord",
            // Not structured-cloneable: adding this request throws and aborts the transaction.
            put: [{ id: "trade:2", kind: "trade", invalid: () => undefined }],
          },
        ],
      });
      await expect(failing).rejects.toThrow();

      const after = await seam.snapshot(["workspaceMeta", "journal", "tradeRecord"]);
      expect(after.rows("workspaceMeta")).toEqual(before.rows("workspaceMeta"));
      expect(after.rows("journal")).toEqual(before.rows("journal"));
      expect(after.rows("tradeRecord")).toEqual(before.rows("tradeRecord"));
      database.close();
    });
});
