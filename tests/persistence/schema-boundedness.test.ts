import { afterEach, describe, expect, it } from "vitest";
import {
  deleteDatabase,
  openDatabase,
  transactionDone,
} from "../../src/persistence/indexeddb/schema";
import { queryOpenLifecycle } from "../../src/persistence/indexeddb/lifecycleQuery";

const TOTAL_LIFECYCLE_ROWS = 25_000;
const OPEN_ROWS = 200;
const BATCH_SIZE = 250;

afterEach(async () => {
  await deleteDatabase();
});

async function seed(database: IDBDatabase): Promise<void> {
  const transaction = database.transaction(["lifecycleIndex", "tradeRecord"], "readwrite");
  const lifecycle = transaction.objectStore("lifecycleIndex");
  const trades = transaction.objectStore("tradeRecord");

  for (let index = 0; index < TOTAL_LIFECYCLE_ROWS; index += 1) {
    const open = index < OPEN_ROWS;
    lifecycle.put({
      tradeId: `trade-${index}`,
      state: open ? "Open" : "Closed",
      cutoffTradingDate: "2026-10-19",
    });
    if (open) {
      trades.put({
        id: `trade-${index}`,
        economicTime: "2026-10-19T20:00:00.000Z",
        kind: "trade",
      });
    }
  }

  await transactionDone(transaction);
}

describe("the Open selection is bounded and asserts its counted storage requests", () => {
  it("should read the 200 indexed rows plus one bounded batch through exactly one index cursor at 25,000 lifecycle rows", async () => {
    const database = await openDatabase();
    await seed(database);

    const sample = database
      .transaction("lifecycleIndex", "readonly")
      .objectStore("lifecycleIndex");
    const storePrototype = Object.getPrototypeOf(sample) as {
      get: (...args: unknown[]) => unknown;
    };
    const indexPrototype = Object.getPrototypeOf(sample.index("state")) as {
      openCursor: (...args: unknown[]) => unknown;
    };
    const originalOpenCursor = indexPrototype.openCursor;
    const originalGet = storePrototype.get;
    let cursors = 0;
    let gets = 0;
    indexPrototype.openCursor = function patched(this: unknown, ...args: unknown[]) {
      cursors += 1;
      return originalOpenCursor.apply(this, args);
    };
    storePrototype.get = function patched(this: unknown, ...args: unknown[]) {
      gets += 1;
      return originalGet.apply(this, args);
    };

    try {
      const result = await queryOpenLifecycle(database, { batchSize: BATCH_SIZE });

      expect(result.rows).toHaveLength(OPEN_ROWS);
      expect(result.batch).toHaveLength(OPEN_ROWS);
      expect(result.counts).toEqual({
        indexCursors: 1,
        cursorSteps: OPEN_ROWS,
        batchReads: 1,
        batchEntries: OPEN_ROWS,
      });
      expect({ cursors, gets }).toEqual({ cursors: 1, gets: OPEN_ROWS });
    } finally {
      indexPrototype.openCursor = originalOpenCursor;
      storePrototype.get = originalGet;
      database.close();
    }
  });
});
