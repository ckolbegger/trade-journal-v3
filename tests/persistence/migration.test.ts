import { afterEach, describe, expect, it } from "vitest";
import {
  deleteDatabase,
  openDatabase,
  transactionDone,
} from "../../src/persistence/indexeddb/schema";
import { CONTROL_DATABASE_NAME } from "../../src/persistence/indexeddb/migration";
import {
  readActiveVersion,
  readPointer,
  migrate,
} from "../../src/persistence/indexeddb/migration";

const SOURCE = "trade-journal";

afterEach(async () => {
  await deleteDatabase(CONTROL_DATABASE_NAME);
  await deleteDatabase(SOURCE);
  await deleteDatabase("trade-journal-candidate-m1");
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should build the candidate, validate every section, and flip the active pointer only after validation when the stored schema version is one supported step behind", async () => {
    const source = await openDatabase(SOURCE, 1);
    const write = source.transaction("tradeRecord", "readwrite");
    write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
    await transactionDone(write);
    source.close();

    const result = await migrate({
      migrationId: "m1",
      targetVersion: 2,
      steps: [
        {
          id: "m1.add-settlement-field",
          fromVersion: 1,
          toVersion: 2,
          apply: (snapshot) => ({
            stores: {
              ...snapshot.stores,
              tradeRecord: (snapshot.stores.tradeRecord ?? []).map((row) => ({
                ...row,
                settlementKind: null,
              })),
            },
          }),
        },
      ],
      seedVersion: "seed-v1",
      seedAdditions: [],
    });

    expect(result.outcome).toBe("Migrated");

    // The source version is still present and openable at its original version.
    const stillThere = await openDatabase(SOURCE, 1);
    expect(stillThere.version).toBe(1);
    const rows = await new Promise<unknown>((resolve, reject) => {
      const request = stillThere.transaction("tradeRecord").objectStore("tradeRecord").get("trade-1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(rows).toEqual({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
    stillThere.close();

    expect(result).toMatchObject({ activeDatabaseName: "trade-journal-candidate-m1" });
    expect(await readActiveVersion()).toBe(2);

    const pointer = await readPointer();
    expect(pointer?.databaseName).toBe("trade-journal-candidate-m1");
  });
});
