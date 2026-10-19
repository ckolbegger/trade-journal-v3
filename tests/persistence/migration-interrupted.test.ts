import { afterEach, describe, expect, it } from "vitest";
import {
  CANDIDATE_DATABASE_PREFIX,
  deleteDatabase,
  openDatabase,
  transactionDone,
} from "../../src/persistence/indexeddb/schema";
import {
  CONTROL_DATABASE_NAME,
  migrate,
  readPointer,
} from "../../src/persistence/indexeddb/migration";

const SOURCE = "trade-journal";
const STALE = `${CANDIDATE_DATABASE_PREFIX}stale`;
const FRESH = `${CANDIDATE_DATABASE_PREFIX}m6`;

afterEach(async () => {
  await deleteDatabase(CONTROL_DATABASE_NAME);
  await deleteDatabase(SOURCE);
  await deleteDatabase(STALE);
  await deleteDatabase(FRESH);
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should discard a stale candidate and leave the prior version in control when the process is interrupted after the candidate is built and before the pointer flip", async () => {
    const source = await openDatabase(SOURCE, 1);
    const write = source.transaction("tradeRecord", "readwrite");
    write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", economicTime: "2026-10-19" });
    await transactionDone(write);
    source.close();

    // Simulate the interrupted run: a candidate exists but the pointer was never flipped.
    const stale = await openDatabase(STALE, 1);
    const staleWrite = stale.transaction("tradeRecord", "readwrite");
    staleWrite.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade" });
    await transactionDone(staleWrite);
    stale.close();
    expect(await readPointer()).toBeUndefined();

    const result = await migrate({
      migrationId: "m6",
      targetVersion: 2,
      steps: [{ id: "m6.noop", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot }],
      seedVersion: "seed-v1",
      seedAdditions: [],
    });

    expect(result.outcome).toBe("Migrated");
    const pointer = await readPointer();
    expect(pointer?.databaseName).toBe(FRESH);

    const databases = await indexedDB.databases();
    expect(databases.map((database) => database.name)).not.toContain(STALE);

    const stillThere = await openDatabase(SOURCE, 1);
    expect(stillThere.version).toBe(1);
    stillThere.close();
  });
});
