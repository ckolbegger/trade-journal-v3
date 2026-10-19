import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";

const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

afterEach(async () => {
  await deleteDatabase();
});

describe("one commit spans every named store atomically", () => {
  it("should keep reading pre-commit rows for its whole lifetime when a snapshot is opened before a concurrent commit", async () => {
    const database = await openDatabase();
    const seam = createTransactionSeam(database, createWriteGate(writable));

    await seam.commit({
      participants: [{ store: "tradeRecord", put: [{ id: "trade-1", kind: "trade" }] }],
    });
    const before = await seam.snapshot(["tradeRecord"]);

    await seam.commit({
      participants: [{ store: "tradeRecord", put: [{ id: "trade-2", kind: "trade" }] }],
    });

    expect(before.rows("tradeRecord")).toEqual([{ id: "trade-1", kind: "trade" }]);
    const after = await seam.snapshot(["tradeRecord"]);
    expect(after.rows("tradeRecord").map((row) => row.id).sort()).toEqual(["trade-1", "trade-2"]);

    database.close();
  });
});
