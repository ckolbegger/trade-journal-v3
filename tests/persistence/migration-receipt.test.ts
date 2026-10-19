import { afterEach, describe, expect, it } from "vitest";
import { deleteDatabase, openDatabase, transactionDone } from "../../src/persistence/indexeddb/schema";
import { CONTROL_DATABASE_NAME, migrate } from "../../src/persistence/indexeddb/migration";

const SOURCE = "trade-journal";

afterEach(async () => {
  await deleteDatabase(CONTROL_DATABASE_NAME);
  await deleteDatabase(SOURCE);
  await deleteDatabase("trade-journal-candidate-m9");
});

describe("migrationRunner moves a Workspace through an isolated candidate and an atomic pointer flip", () => {
  it("should return a migration receipt naming the schema transitions, the migrations applied, the seed versions and additions, and every private rebuild when migration succeeds", async () => {
    const source = await openDatabase(SOURCE, 1);
    const write = source.transaction("referenceCatalog", "readwrite");
    write.objectStore("referenceCatalog").put({ id: "ref-1", kind: "strategy", stableKey: "strategy.long-stock", label: "Long Stock" });
    await transactionDone(write);
    source.close();

    const result = await migrate({
      migrationId: "m9",
      targetVersion: 3,
      steps: [
        { id: "m9.step-one", fromVersion: 1, toVersion: 2, apply: (snapshot) => snapshot },
        {
          id: "m9.step-two",
          fromVersion: 2,
          toVersion: 3,
          apply: (snapshot) => ({
            stores: {
              ...snapshot.stores,
              referenceCatalog: (snapshot.stores.referenceCatalog ?? []).map((row) => ({
                ...row,
                label: row.label,
              })),
            },
          }),
        },
      ],
      seedVersion: "seed-v3",
      seedAdditions: [
        {
          store: "referenceCatalog",
          stableKey: "strategy.long-call",
          values: { id: "ref-2", kind: "strategy", label: "Long Call" },
        },
      ],
    });

    expect(result).toMatchObject({
      outcome: "Migrated",
      receipt: {
        migrationId: "m9",
        schemaTransitions: [{ from: 1, to: 3 }],
        migrationsApplied: ["m9.step-one", "m9.step-two"],
        seedVersion: "seed-v3",
        seedAdditions: ["strategy.long-call"],
        privateRebuilds: ["lifecycleListProjection"],
      },
    });
  });
});
