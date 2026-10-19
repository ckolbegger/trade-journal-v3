import { afterEach, describe, expect, it } from "vitest";
import { query } from "../../src/catalog/save";
import { createAccount, createInstitution } from "../../src/onboarding";
import { openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { establishReadiness } from "../../src/readiness";
import { buildRelease, closeAll, initializeWorkspace, openStore, readinessPorts } from "./support";

afterEach(async () => {
  await closeAll();
});

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
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
