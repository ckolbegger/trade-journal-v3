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
  await deleteDatabase("trade-journal-candidate-m7");
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should add a new manifest default to the candidate without overwriting a trader rename when the target release introduces a seed addition", async () => {
    const source = await openDatabase(SOURCE, 1);
    const write = source.transaction("referenceCatalog", "readwrite");
    write.objectStore("referenceCatalog").put({
      id: "ref-long-stock",
      kind: "strategy",
      stableKey: "strategy.long-stock",
      label: "My Long Stock",
    });
    await transactionDone(write);
    source.close();

    const result = await migrate({
      migrationId: "m7",
      targetVersion: 2,
      steps: [{ id: "m7.noop", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot }],
      seedVersion: "seed-v2",
      seedAdditions: [
        {
          store: "referenceCatalog",
          stableKey: "strategy.long-stock",
          values: { id: "ref-long-stock", kind: "strategy", label: "Long Stock" },
        },
        {
          store: "referenceCatalog",
          stableKey: "strategy.long-call",
          values: { id: "ref-long-call", kind: "strategy", label: "Long Call" },
        },
      ],
    });

    expect(result.outcome).toBe("Migrated");
    expect(result).toMatchObject({ receipt: { seedVersion: "seed-v2", seedAdditions: ["strategy.long-call"] } });

    const pointer = await readPointer();
    expect(pointer?.databaseName).toBe("trade-journal-candidate-m7");
    const candidate = await openDatabase("trade-journal-candidate-m7", 2);
    const rows = await new Promise<unknown[]>((resolve, reject) => {
      const request = candidate.transaction("referenceCatalog").objectStore("referenceCatalog").getAll();
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error);
    });
    candidate.close();

    expect(rows).toContainEqual({
      id: "ref-long-stock",
      kind: "strategy",
      stableKey: "strategy.long-stock",
      label: "My Long Stock",
    });
    expect(rows).toContainEqual({
      id: "ref-long-call",
      kind: "strategy",
      stableKey: "strategy.long-call",
      label: "Long Call",
    });
    expect(rows).toHaveLength(2);
  });
});
