import { afterEach, describe, expect, it } from "vitest";
import {
  D2_MIGRATION,
  D2_MIGRATION_ID,
  migrateD2,
} from "../../src/persistence/indexeddb/d2Migration";
import {
  CONTROL_DATABASE_NAME,
  migrate,
  readActiveVersion,
} from "../../src/persistence/indexeddb/migration";
import {
  CANDIDATE_DATABASE_PREFIX,
  DATABASE_NAME,
  D2_SCHEMA_MANIFEST,
  D2_SCHEMA_VERSION,
  SCHEMA_VERSION,
  deleteDatabase,
  openDatabase,
  openDatabaseWithStores,
  transactionDone,
} from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate } from "../../src/persistence/indexeddb/writeGate";

const SOURCE = DATABASE_NAME;
const CANDIDATE = `${CANDIDATE_DATABASE_PREFIX}${D2_MIGRATION_ID}`;

const writable = { outcome: "Writable" as const, failedChecks: [] };
const recoveryOnly = {
  outcome: "RecoveryOnly" as const,
  failedChecks: [{ check: "capacity" as const, detail: "below the derived minimum" }],
};

async function seedD1(): Promise<void> {
  const database = await openDatabase(SOURCE, SCHEMA_VERSION);
  const write = database.transaction(
    ["tradeRecord", "journal", "referenceCatalog", "workspaceMeta"],
    "readwrite",
  );
  write.objectStore("tradeRecord").put({ id: "fact-1", kind: "trade", economicTime: "2026-10-19" });
  write.objectStore("journal").put({ id: "entryType:plan-reflection", kind: "entryType" });
  write.objectStore("referenceCatalog").put({ id: "strategy:long-stock", kind: "strategy" });
  write.objectStore("workspaceMeta").put({ key: "workspace", value: { timeZone: "America/New_York" } });
  await transactionDone(write);
  database.close();
}

async function storeNamesOf(name: string): Promise<string[]> {
  const database = await openExisting(name);
  const names = Array.from(database.objectStoreNames).sort();
  database.close();
  return names;
}

async function openExisting(name: string): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function rawRows(name: string, store: string): Promise<readonly Record<string, unknown>[]> {
  const databases = await indexedDB.databases();
  const exists = databases.some((database) => database.name === name);
  if (!exists) return [];
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!database.objectStoreNames.contains(store)) {
    database.close();
    return [];
  }
  const rows = await new Promise<readonly Record<string, unknown>[]>((resolve, reject) => {
    const request = database.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return rows;
}

describe("the D2 migration adds the Plan-fact representation on top of D1's schema", () => {
  afterEach(async () => {
    await deleteDatabase(CONTROL_DATABASE_NAME);
    await deleteDatabase(SOURCE);
    await deleteDatabase(CANDIDATE);
  });

  it("should upgrade a fresh D1 database to the D2 version in one isolated candidate and create every D2 store and declared index with its declared key path and flags", async () => {
    await seedD1();

    const result = await migrateD2(createWriteGate({ current: async () => writable }));

    expect(result).toMatchObject({ outcome: "Migrated" });
    if (result.outcome !== "Migrated") throw new Error("the migration did not run");
    expect(result.receipt.schemaTransitions).toEqual([
      { from: SCHEMA_VERSION, to: D2_SCHEMA_VERSION },
    ]);
    expect(result.activeDatabaseName).toBe(CANDIDATE);
    expect(await readActiveVersion()).toBe(D2_SCHEMA_VERSION);

    // Every D2 store and every declared index exists, with the declared shapes.
    const active = await openDatabaseWithStores(D2_SCHEMA_MANIFEST, CANDIDATE, D2_SCHEMA_VERSION);
    for (const store of D2_SCHEMA_MANIFEST) {
      expect(active.objectStoreNames.contains(store.name)).toBe(true);
      const transaction = active.transaction(store.name);
      const objectStore = transaction.objectStore(store.name);
      expect(objectStore.keyPath).toEqual(store.keyPath);
      for (const index of store.indexes) {
        expect(objectStore.indexNames.contains(index.name)).toBe(true);
        const declared = objectStore.index(index.name);
        expect(declared.keyPath).toEqual(index.keyPath);
        expect(declared.unique).toBe(index.unique === true);
        expect(declared.multiEntry).toBe(false);
      }
    }
    active.close();

    // The D1 data survived the upgrade.
    expect(await rawRows(CANDIDATE, "tradeRecord")).toEqual([
      { id: "fact-1", kind: "trade", economicTime: "2026-10-19" },
    ]);
    expect((await rawRows(CANDIDATE, "workspaceMeta")).length).toBe(1);
  });

  it("should leave the D1 data readable at the D1 version constant and expose no partially created D2 store when the candidate is rejected partway through", async () => {
    await seedD1();

    const outcome = await migrate({
      ...D2_MIGRATION,
      validate: () => ({ section: "tradeVersion", detail: "injected candidate failure" }),
    });

    expect(outcome).toMatchObject({
      outcome: "MigrationBlocked",
      reason: "ValidationFailed",
    });
    expect(await readActiveVersion()).toBe(SCHEMA_VERSION);

    const databases = await indexedDB.databases();
    expect(databases.map((database) => database.name)).not.toContain(CANDIDATE);

    const source = await openDatabase(SOURCE, SCHEMA_VERSION);
    expect(source.version).toBe(SCHEMA_VERSION);
    expect(Array.from(source.objectStoreNames)).not.toContain("tradeLifecycle");
    expect(Array.from(source.objectStoreNames)).not.toContain("tradeVersion");
    source.close();
    expect(await rawRows(SOURCE, "tradeRecord")).toEqual([
      { id: "fact-1", kind: "trade", economicTime: "2026-10-19" },
    ]);
  });

  it("should change no record count and no store or index set and report no schema transition when it is re-run against an already-upgraded database", async () => {
    await seedD1();
    await migrateD2(createWriteGate({ current: async () => writable }));

    const firstStores = await storeNamesOf(CANDIDATE);
    const firstRows = (await rawRows(CANDIDATE, "tradeRecord")).length;

    const again = await migrateD2(createWriteGate({ current: async () => writable }));

    expect(again).toMatchObject({ outcome: "Migrated" });
    if (again.outcome !== "Migrated") throw new Error("the second migration did not report");
    expect(again.receipt.schemaTransitions).toEqual([]);
    expect(again.receipt.migrationsApplied).toEqual([]);
    expect(await readActiveVersion()).toBe(D2_SCHEMA_VERSION);
    expect(await storeNamesOf(CANDIDATE)).toEqual(firstStores);
    expect((await rawRows(CANDIDATE, "tradeRecord")).length).toBe(firstRows);
  });

  it("should refuse to begin and create no D2 store when the session is not Writable at the persistence boundary", async () => {
    await seedD1();

    const refused = await migrateD2(createWriteGate({ current: async () => recoveryOnly }));

    expect(refused).toMatchObject({
      outcome: "RuntimeNotWritable",
      payload: { outcome: "RuntimeNotWritable", runtimeReadiness: "RecoveryOnly" },
    });
    expect(await readActiveVersion()).toBe(SCHEMA_VERSION);
    const databases = await indexedDB.databases();
    expect(databases.map((database) => database.name)).not.toContain(CANDIDATE);
    expect(await rawRows(SOURCE, "tradeLifecycle")).toEqual([]);
  });

  it("should commit a write that spans the Trade, Journal and Catalog stores on all three or on none, comparing every participant's revision before and after", async () => {
    await seedD1();
    await migrateD2(createWriteGate({ current: async () => writable }));

    const database = await openDatabaseWithStores(
      D2_SCHEMA_MANIFEST,
      CANDIDATE,
      D2_SCHEMA_VERSION,
    );
    const seam = createTransactionSeam(
      database,
      createWriteGate({ current: async () => writable }),
    );

    const revisionsOf = async (): Promise<Record<string, number>> => {
      const snapshot = await seam.snapshot(["workspaceMeta"]);
      const row = snapshot.rows("workspaceMeta").find((entry) => entry.key === "revisions");
      return (row?.value as Record<string, number> | undefined) ?? {};
    };

    const before = await revisionsOf();
    const committed = await seam.commit({
      participants: [
        { store: "tradeRecord", put: [{ id: "fact-2", kind: "plan", economicTime: "2026-10-19" }] },
        { store: "journal", put: [{ id: "entry-1", kind: "entry" }] },
        { store: "referenceCatalog", put: [{ id: "strategy:long-stock", kind: "strategy", label: "Long Stock" }] },
      ],
    });
    expect(committed.kind).toBe("Committed");
    const after = await revisionsOf();
    for (const store of ["tradeRecord", "journal", "referenceCatalog"]) {
      expect(after[store]).toBe((before[store] ?? 0) + 1);
    }

    // A rejected participant leaves every revision exactly as it was.
    const rejectedBefore = await revisionsOf();
    database.close();

    const closing = await openDatabaseWithStores(
      D2_SCHEMA_MANIFEST,
      CANDIDATE,
      D2_SCHEMA_VERSION,
    );
    const refusing = createTransactionSeam(
      closing,
      createWriteGate({ current: async () => recoveryOnly }),
    );
    const refused = await refusing.commit({
      participants: [
        { store: "tradeRecord", put: [{ id: "fact-3", kind: "plan" }] },
        { store: "journal", put: [{ id: "entry-2", kind: "entry" }] },
        { store: "referenceCatalog", put: [{ id: "other", kind: "strategy" }] },
      ],
    });
    expect(refused.kind).toBe("Rejected");
    const rejectedAfter = await refusing.snapshot(["workspaceMeta"]);
    const rejectedRevisions =
      (rejectedAfter.rows("workspaceMeta").find((row) => row.key === "revisions")?.value as
        | Record<string, number>
        | undefined) ?? {};
    expect(rejectedRevisions).toEqual(rejectedBefore);
    closing.close();
  });
});
