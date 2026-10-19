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
const CANDIDATE = `${CANDIDATE_DATABASE_PREFIX}m2`;

afterEach(async () => {
  await deleteDatabase(CONTROL_DATABASE_NAME);
  await deleteDatabase(SOURCE);
  await deleteDatabase(CANDIDATE);
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should leave the prior database readable and unchanged at its original version when validation of one candidate section is made to fail", async () => {
    const source = await openDatabase(SOURCE, 1);
    const write = source.transaction("journal", "readwrite");
    write.objectStore("journal").put({ id: "entry-1", entryType: "Plan Reflection" });
    await transactionDone(write);
    source.close();

    const result = await migrate({
      migrationId: "m2",
      targetVersion: 2,
      steps: [
        {
          id: "m2.noop",
          fromVersion: 1,
          toVersion: 2,
          apply: (snapshot) => snapshot,
        },
      ],
      seedVersion: "seed-v1",
      seedAdditions: [],
      validate: () => ({ section: "journal", detail: "the journal section is incoherent" }),
    });

    expect(result).toMatchObject({
      outcome: "MigrationBlocked",
      reason: "ValidationFailed",
      detail: "journal: the journal section is incoherent",
    });
    expect(await readPointer()).toBeUndefined();

    const unchanged = await openDatabase(SOURCE, 1);
    expect(unchanged.version).toBe(1);
    const row = await new Promise<unknown>((resolve, reject) => {
      const request = unchanged.transaction("journal").objectStore("journal").get("entry-1");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(row).toEqual({ id: "entry-1", entryType: "Plan Reflection" });
    unchanged.close();

    const databases = await indexedDB.databases();
    expect(databases.map((database) => database.name)).not.toContain(CANDIDATE);
  });
});
