import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase, transactionDone, SCHEMA_MANIFEST, validateManifest, type StoreDefinition, rebuildProjections, SCHEMA_VERSION } from "../../src/persistence/indexeddb/schema";
import { queryOpenLifecycle } from "../../src/persistence/indexeddb/lifecycleQuery";
import { schemaMismatches } from "../../src/persistence/indexeddb/schemaCheck";

describe("the Open selection is bounded and asserts its counted storage requests", () => {
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

describe("every declared store declares its residency and rebuildability", () => {
  function without(name: string, change: Partial<StoreDefinition>): StoreDefinition[] {
    return SCHEMA_MANIFEST.map((store) => (store.name === name ? { ...store, ...change } : store));
  }

  it("should accept the declared manifest with no problem", () => {
      expect(validateManifest()).toEqual([]);
    });

  it("should fail naming the store when an added store declares no residency", () => {
      const added = [
        ...SCHEMA_MANIFEST,
        { name: "undeclaredStore", keyPath: "id" } as unknown as StoreDefinition,
      ];

      expect(validateManifest(added)).toContain(
        "undeclaredStore: declares no residency (authoritative or rebuildable)",
      );
    });

  it("should fail naming the projection when a rebuildable store names no rebuild source", () => {
      const problems = validateManifest(
        without("lifecycleListProjection", { rebuildSource: undefined }),
      );

      expect(problems).toContain(
        "lifecycleListProjection: a rebuildable store must declare its rebuild source",
      );
    });

  it("should fail naming the projection when its rebuild source is not authoritative", () => {
      const problems = validateManifest(
        without("lifecycleListProjection", { rebuildSource: "unknownStore" }),
      );

      expect(problems).toContain(
        "lifecycleListProjection: rebuild source unknownStore is not an authoritative store",
      );
    });
});

describe("a rebuildable projection is rebuilt from authoritative facts", () => {
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

describe("the declared schema is exactly the schema the database opens", () => {
  afterEach(async () => {
    await deleteDatabase();
  });

  it("should create every declared store with its keyPath and indexes at the baseline version", async () => {
      const database = await openDatabase();

      expect(database.version).toBe(SCHEMA_VERSION);
      expect(Array.from(database.objectStoreNames).sort()).toEqual(
        SCHEMA_MANIFEST.map((store) => store.name).sort(),
      );
      expect(schemaMismatches(database)).toEqual([]);

      database.close();
    });

  it("should name a missing or renamed index instead of passing silently", async () => {
      const database = await openDatabase();
      const renamed: StoreDefinition[] = SCHEMA_MANIFEST.map((store) =>
        store.name === "lifecycleIndex"
          ? {
              ...store,
              indexes: store.indexes.map((index) =>
                index.name === "state" ? { ...index, name: "lifecycleState" } : index,
              ),
            }
          : store,
      );

      const problems = schemaMismatches(database, renamed);

      expect(problems).toContain("lifecycleIndex: the index lifecycleState is missing");
      database.close();
    });
});
