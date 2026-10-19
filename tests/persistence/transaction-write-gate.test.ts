import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";
import { runtimeNotWritable } from "../../src/results";

afterEach(async () => {
  await deleteDatabase();
});

describe("one commit spans every named store atomically", () => {
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
