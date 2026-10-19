import {
  SCHEMA_MANIFEST,
  type StoreDefinition,
} from "./schema";

/** Name every declared store, keyPath or index the opened database does not match. */
export function schemaMismatches(
  database: IDBDatabase,
  manifest: readonly StoreDefinition[] = SCHEMA_MANIFEST,
): string[] {
  const problems: string[] = [];
  const present = new Set(Array.from(database.objectStoreNames));

  for (const store of manifest) {
    if (!present.has(store.name)) problems.push(`${store.name}: the store is missing`);
  }
  if (problems.length > 0) return problems;

  const transaction = database.transaction(
    manifest.map((store) => store.name),
    "readonly",
  );
  for (const store of manifest) {
    const objectStore = transaction.objectStore(store.name);
    if (objectStore.keyPath !== store.keyPath) {
      problems.push(`${store.name}: keyPath is ${String(objectStore.keyPath)}, expected ${store.keyPath}`);
    }
    for (const index of store.indexes) {
      if (!objectStore.indexNames.contains(index.name)) {
        problems.push(`${store.name}: the index ${index.name} is missing`);
      }
    }
    for (const indexName of Array.from(objectStore.indexNames)) {
      if (!store.indexes.some((index) => index.name === indexName)) {
        problems.push(`${store.name}: the index ${indexName} is not declared`);
      }
    }
  }
  return problems;
}
