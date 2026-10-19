import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { runtimeNotWritable } from "../../src/results";

describe("one commit spans every named store atomically", () => {
  const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

  afterEach(async () => {
    await deleteDatabase();
  });

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

describe("one commit spans every named store atomically", () => {
  const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

  afterEach(async () => {
    await deleteDatabase();
  });

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

describe("one commit spans every named store atomically", () => {
  const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

  afterEach(async () => {
    await deleteDatabase();
  });

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

describe("one commit spans every named store atomically", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should reject with RuntimeNotWritable and open no readwrite transaction when the gate is not Writable", async () => {
      const database = await openDatabase();
      const seam = createTransactionSeam(
        database,
        createWriteGate({
          current: async () => ({
            outcome: "RecoveryOnly" as const,
            failedChecks: [{ check: "capacity" as const, detail: "below the derived minimum" }],
          }),
        }),
      );

      const result = await seam.commit({
        participants: [{ store: "tradeRecord", put: [{ id: "trade-1" }] }],
      });

      expect(result).toMatchObject({
        kind: "Rejected",
        payload: { outcome: "RuntimeNotWritable", runtimeReadiness: "RecoveryOnly" },
      });
      expect(seam.counters.readwriteTransactions).toBe(0);

      // The seam's rejection is field-for-field the one the shared constructor builds directly.
      expect(result).toEqual({
        kind: "Rejected",
        payload: runtimeNotWritable({
          runtimeReadiness: "RecoveryOnly",
          failedChecks: [{ check: "capacity", detail: "below the derived minimum" }],
        }),
      });

      const snapshot = await seam.snapshot(["tradeRecord", "workspaceMeta"]);
      expect(snapshot.rows("tradeRecord")).toEqual([]);
      expect(snapshot.rows("workspaceMeta")).toEqual([]);

      database.close();
    });
});

describe("one commit spans every named store atomically", () => {
  const writable = { current: async () => ({ outcome: "Writable" as const, failedChecks: [] }) };

  afterEach(async () => {
    await deleteDatabase();
  });

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
