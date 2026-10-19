import { afterEach, describe, expect, it } from "vitest";
import {
  SCHEMA_MANIFEST,
  SCHEMA_VERSION,
  deleteDatabase,
  openDatabase,
  type StoreDefinition,
} from "../../src/persistence/indexeddb/schema";
import { schemaMismatches } from "../../src/persistence/indexeddb/schemaCheck";

afterEach(async () => {
  await deleteDatabase();
});

describe("the declared schema is exactly the schema the database opens", () => {
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
