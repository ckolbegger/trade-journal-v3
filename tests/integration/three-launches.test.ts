import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { establishReadiness } from "../../src/readiness";
import { buildRelease, closeAll, openStore, readinessPorts } from "./support";

afterEach(async () => {
  await closeAll();
});

describe("the D1 integration suite proves the installed foundation end to end through the real stack", () => {
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
