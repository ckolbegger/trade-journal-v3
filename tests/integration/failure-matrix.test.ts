import { afterEach, describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import {
  buildRelease,
  closeAll,
  initializeWorkspace,
  openStore,
  readinessPorts,
  type ReadinessOptions,
} from "./support";

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

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
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
