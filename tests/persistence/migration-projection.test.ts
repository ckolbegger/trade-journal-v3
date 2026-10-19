import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase, transactionDone } from "../../src/persistence/indexeddb/schema";
import {
  CONTROL_DATABASE_NAME,
  migrate,
  readPointer,
} from "../../src/persistence/indexeddb/migration";

const SOURCE = "trade-journal";
const CANDIDATE = "trade-journal-candidate-m8";

afterEach(async () => {
  await deleteDatabase(CONTROL_DATABASE_NAME);
  await deleteDatabase(SOURCE);
  await deleteDatabase(CANDIDATE);
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should rebuild the private projections inside the candidate and prove recomputed index membership equals the candidate's stored membership before the flip", async () => {
    const source = await openDatabase(SOURCE, 1);
    const write = source.transaction("lifecycleIndex", "readwrite");
    write.objectStore("lifecycleIndex").put({ tradeId: "trade-1", state: "Open", cutoffTradingDate: "2026-10-19" });
    write.objectStore("lifecycleIndex").put({ tradeId: "trade-2", state: "Closed", cutoffTradingDate: "2026-10-20" });
    await transactionDone(write);
    source.close();

    const result = await migrate({
      migrationId: "m8",
      targetVersion: 2,
      steps: [{ id: "m8.noop", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot }],
      seedVersion: "seed-v1",
      seedAdditions: [],
    });

    expect(result.outcome).toBe("Migrated");
    expect(result).toMatchObject({ receipt: { privateRebuilds: ["lifecycleListProjection"] } });

    const pointer = await readPointer();
    const candidate = await openDatabase(pointer?.databaseName ?? CANDIDATE, 2);
    const projection = await new Promise<unknown[]>((resolve, reject) => {
      const request = candidate.transaction("lifecycleListProjection").objectStore("lifecycleListProjection").getAll();
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error);
    });
    candidate.close();

    expect(projection).toEqual([
      { tradeId: "trade-1", state: "Open", cutoffTradingDate: "2026-10-19" },
      { tradeId: "trade-2", state: "Closed", cutoffTradingDate: "2026-10-20" },
    ]);
  });
});
