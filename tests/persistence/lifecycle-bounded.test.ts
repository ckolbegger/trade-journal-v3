import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase, transactionDone } from "../../src/persistence/indexeddb/schema";
import { queryOpenLifecycle } from "../../src/persistence/indexeddb/lifecycleQuery";
import type { TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { writable } from "./revision-support";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";

const TOTAL = 25_000;
const OPEN = 200;
const BATCH = 250;
let database: IDBDatabase;
let seam: TransactionSeam;

beforeAll(async () => {
  database = await openDatabase();
  const transaction = database.transaction(["lifecycleIndex", "tradeRecord"], "readwrite");
  const lifecycle = transaction.objectStore("lifecycleIndex");
  const trades = transaction.objectStore("tradeRecord");
  for (let index = 0; index < TOTAL; index += 1) {
    const open = index < OPEN;
    lifecycle.put({
      tradeId: `trade-${index}`,
      state: open ? "Open" : "Closed",
      factRevision: index,
      openedOn: "2026-10-01",
      ...(open ? {} : { closedOn: "2026-10-20" }),
    });
    trades.put({ id: `trade-${index}`, tradeId: `trade-${index}`, kind: "execution" });
  }
  await transactionDone(transaction);
  seam = createTransactionSeam(database, createWriteGate({ current: async () => writable }));
});

afterAll(async () => {
  database.close();
  await deleteDatabase();
});

describe("lifecycle index membership commits with its facts and answers cutoff queries within a bounded read", () => {
  it("should return only the currently Open Trades from the index, reading one indexed cursor plus the declared bounded batch rather than scanning the Trade store", async () => {
    const result = await queryOpenLifecycle(database, { batchSize: BATCH });

    expect(result.rows).toHaveLength(OPEN);
    expect(result.rows.every((row) => row.state === "Open")).toBe(true);
    expect(result.batch).toHaveLength(OPEN);
  });

  it("should stay bounded at 25,000 Trades: the query reads at most the declared batch plus the indexed rows, asserted by the counted storage requests and never by elapsed time", async () => {
    const result = await queryOpenLifecycle(database, { batchSize: BATCH });

    expect(result.counts).toEqual({
      indexCursors: 1,
      cursorSteps: OPEN,
      batchReads: 1,
      batchEntries: OPEN,
    });
    expect(result.rows.length).toBeLessThanOrEqual(BATCH);
    expect(seam.counters.readwriteTransactions).toBe(0);
  });
});
