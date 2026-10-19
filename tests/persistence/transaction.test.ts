import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";

const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

afterEach(async () => {
  await deleteDatabase();
});

describe("one commit spans every named store atomically", () => {
  it("should write all three participants and return per-store revisions equal to the persisted rows", async () => {
    const database = await openDatabase();
    const seam = createTransactionSeam(database, createWriteGate(writable));

    const result = await seam.commit({
      participants: [
        { store: "tradeRecord", put: [{ id: "trade-1", kind: "trade" }] },
        { store: "journal", put: [{ id: "entry-1", entryType: "Plan Reflection" }] },
        { store: "referenceCatalog", put: [{ id: "ref-1", kind: "strategy" }] },
      ],
    });

    expect(result).toEqual({
      kind: "Committed",
      revisions: { tradeRecord: 1, journal: 1, referenceCatalog: 1 },
    });

    const snapshot = await seam.snapshot([
      "tradeRecord",
      "journal",
      "referenceCatalog",
      "workspaceMeta",
    ]);
    expect(snapshot.rows("tradeRecord")).toEqual([{ id: "trade-1", kind: "trade" }]);
    expect(snapshot.rows("journal")).toEqual([{ id: "entry-1", entryType: "Plan Reflection" }]);
    expect(snapshot.rows("referenceCatalog")).toEqual([{ id: "ref-1", kind: "strategy" }]);
    expect(snapshot.rows("workspaceMeta").find((row) => row.key === "revisions")).toEqual({
      key: "revisions",
      value: { tradeRecord: 1, journal: 1, referenceCatalog: 1 },
    });

    database.close();
  });
});
