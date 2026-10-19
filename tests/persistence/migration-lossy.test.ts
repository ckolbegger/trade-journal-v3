import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase, transactionDone } from "../../src/persistence/indexeddb/schema";
import {
  CONTROL_DATABASE_NAME,
  migrate,
  readPointer,
} from "../../src/persistence/indexeddb/migration";

const SOURCE = "trade-journal";
const CANDIDATE = "trade-journal-candidate-m5";

afterEach(async () => {
  await deleteDatabase(CONTROL_DATABASE_NAME);
  await deleteDatabase(SOURCE);
  await deleteDatabase(CANDIDATE);
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should reject a conversion that cannot preserve an authoritative identity, fact, audit revision or provenance field with a typed LossyMigrationRequired and discard the candidate", async () => {
    const source = await openDatabase(SOURCE, 1);
    const write = source.transaction("tradeRecord", "readwrite");
    write.objectStore("tradeRecord").put({ id: "trade-1", kind: "trade", auditRevision: "r7" });
    await transactionDone(write);
    source.close();

    const result = await migrate({
      migrationId: "m5",
      targetVersion: 2,
      steps: [
        {
          id: "m5.drop-audit-revision",
          fromVersion: 1,
          toVersion: 2,
          apply: () => ({
            refusal: "LossyMigrationRequired",
            detail: "the audit revision cannot be preserved",
          }),
        },
      ],
      seedVersion: "seed-v1",
      seedAdditions: [],
    });

    expect(result).toMatchObject({
      outcome: "MigrationBlocked",
      reason: "LossyMigrationRequired",
      detail: "the audit revision cannot be preserved",
    });
    expect(await readPointer()).toBeUndefined();

    const unchanged = await openDatabase(SOURCE, 1);
    expect(unchanged.version).toBe(1);
    unchanged.close();

    const databases = await indexedDB.databases();
    expect(databases.map((database) => database.name)).not.toContain(CANDIDATE);
  });
});
