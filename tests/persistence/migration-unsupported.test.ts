import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase, transactionDone } from "../../src/persistence/indexeddb/schema";
import {
  CONTROL_DATABASE_NAME,
  migrate,
  readPointer,
} from "../../src/persistence/indexeddb/migration";

const SOURCE = "trade-journal";

afterEach(async () => {
  await deleteDatabase(CONTROL_DATABASE_NAME);
  await deleteDatabase(SOURCE);
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should reject an unknown newer stored version with a typed UnsupportedVersion naming both versions and write nothing", async () => {
    const source = await openDatabase(SOURCE, 3);
    const write = source.transaction("tradeRecord", "readwrite");
    write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
    await transactionDone(write);
    source.close();

    const result = await migrate({
      migrationId: "m3",
      targetVersion: 2,
      steps: [{ id: "m3.unused", fromVersion: 3, toVersion: 2, apply: (snapshot) => snapshot }],
      seedVersion: "seed-v1",
      seedAdditions: [],
    });

    expect(result).toEqual({
      outcome: "UnsupportedVersion",
      storedVersion: 3,
      targetVersion: 2,
      activeDatabaseName: SOURCE,
    });
    expect(await readPointer()).toBeUndefined();
  });
});
