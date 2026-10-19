import { afterEach, describe, expect, it } from "vitest";
import {
  deleteDatabase,
  openDatabase,
  rebuildProjections,
  transactionDone,
} from "../../src/persistence/indexeddb/schema";

afterEach(async () => {
  await deleteDatabase();
});

function readAll(database: IDBDatabase, storeName: string): Promise<readonly unknown[]> {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as readonly unknown[]);
    request.onerror = () => reject(request.error ?? new Error("read failed"));
  });
}

describe("a rebuildable projection is rebuilt from authoritative facts", () => {
  it("should reproduce identical projection contents after the projection is deliberately emptied", async () => {
    const database = await openDatabase();

    const seed = database.transaction("lifecycleIndex", "readwrite");
    const lifecycle = seed.objectStore("lifecycleIndex");
    lifecycle.put({ tradeId: "trade-1", state: "Open", cutoffTradingDate: "2026-10-19" });
    lifecycle.put({ tradeId: "trade-2", state: "Open", cutoffTradingDate: "2026-10-20" });
    lifecycle.put({ tradeId: "trade-3", state: "Closed", cutoffTradingDate: "2026-10-21" });
    await transactionDone(seed);

    await rebuildProjections(database);
    const first = await readAll(database, "lifecycleListProjection");
    expect(first).toHaveLength(3);

    const clear = database.transaction("lifecycleListProjection", "readwrite");
    clear.objectStore("lifecycleListProjection").clear();
    await transactionDone(clear);
    expect(await readAll(database, "lifecycleListProjection")).toEqual([]);

    await rebuildProjections(database);
    expect(await readAll(database, "lifecycleListProjection")).toEqual(first);

    database.close();
  });
});
