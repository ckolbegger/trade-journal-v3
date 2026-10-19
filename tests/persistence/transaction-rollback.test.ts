import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";

const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

afterEach(async () => {
  await deleteDatabase();
});

describe("one commit spans every named store atomically", () => {
  it("should abort and leave the first stores at their pre-transaction rows when a later participant throws", async () => {
    const database = await openDatabase();
    const seam = createTransactionSeam(database, createWriteGate(writable));

    await seam.commit({
      participants: [
        { store: "tradeRecord", put: [{ id: "trade-1", kind: "trade" }] },
        { store: "journal", put: [{ id: "entry-1", entryType: "Plan Reflection" }] },
      ],
    });
    const before = await seam.snapshot(["tradeRecord", "journal", "workspaceMeta"]);

    await expect(
      seam.commit({
        participants: [
          { store: "tradeRecord", put: [{ id: "trade-2", kind: "trade" }] },
          { store: "journal", put: [{ id: "entry-2", entryType: "Plan Reflection" }] },
          // The third participant cannot be written: its row has no keyPath value.
          { store: "referenceCatalog", put: [{ notAKey: true }] },
        ],
      }),
    ).rejects.toBeTruthy();

    const after = await seam.snapshot(["tradeRecord", "journal", "workspaceMeta"]);
    expect(after.rows("tradeRecord")).toEqual(before.rows("tradeRecord"));
    expect(after.rows("journal")).toEqual(before.rows("journal"));
    expect(after.rows("workspaceMeta")).toEqual(before.rows("workspaceMeta"));

    database.close();
  });
});
