import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";

const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

afterEach(async () => {
  await deleteDatabase();
});

describe("one commit spans every named store atomically", () => {
  it("should open exactly one readwrite transaction spanning the named stores with no nested transaction", async () => {
    const database = await openDatabase();
    const seam = createTransactionSeam(database, createWriteGate(writable));

    const prototype = Object.getPrototypeOf(database) as {
      transaction: (...args: unknown[]) => unknown;
    };
    const original = prototype.transaction;
    const opened: { stores: string[]; mode: string }[] = [];
    prototype.transaction = function patched(this: unknown, ...args: unknown[]) {
      const storeNames = args[0];
      opened.push({
        stores: [
          ...(Array.isArray(storeNames) ? (storeNames as string[]) : [String(storeNames)]),
        ],
        mode: String(args[1] ?? "readonly"),
      });
      return original.apply(this, args);
    };

    try {
      const result = await seam.commit({
        participants: [
          { store: "tradeRecord", put: [{ id: "trade-1" }] },
          { store: "journal", put: [{ id: "entry-1" }] },
          { store: "referenceCatalog", put: [{ id: "ref-1" }] },
        ],
      });
      expect(result.kind).toBe("Committed");
    } finally {
      prototype.transaction = original;
    }

    expect(opened).toHaveLength(1);
    expect(opened[0]?.mode).toBe("readwrite");
    expect(opened[0]?.stores).toEqual(
      expect.arrayContaining(["tradeRecord", "journal", "referenceCatalog"]),
    );
    expect(seam.counters.readwriteTransactions).toBe(1);

    database.close();
  });
});
