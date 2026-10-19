/**
 * The one durable schema of D1 decision 1: one store per fact module, one authoritative lifecycle
 * index, one candidate namespace, and explicitly rebuildable projections. Every store declares its
 * residency and, when rebuildable, its rebuild source, so a store cannot be added informally.
 */
export const DATABASE_NAME = "trade-journal";
export const CANDIDATE_DATABASE_PREFIX = "trade-journal-candidate-";
export const SCHEMA_VERSION = 1;

export type StoreResidency = "authoritative" | "rebuildable";

export interface IndexDefinition {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  readonly unique?: boolean;
}

export interface StoreDefinition {
  readonly name: string;
  readonly keyPath: string;
  readonly residency: StoreResidency;
  readonly indexes: readonly IndexDefinition[];
  /** Required for a rebuildable store: the authoritative store it is rebuilt from. */
  readonly rebuildSource?: string;
}

export const SCHEMA_MANIFEST: readonly StoreDefinition[] = [
  {
    name: "tradeRecord",
    keyPath: "id",
    residency: "authoritative",
    indexes: [
      { name: "economicTime", keyPath: "economicTime" },
      { name: "kind", keyPath: "kind" },
    ],
  },
  {
    name: "journal",
    keyPath: "id",
    residency: "authoritative",
    indexes: [
      { name: "anchor", keyPath: "anchorKey" },
      { name: "obligationKey", keyPath: "obligationKey" },
      { name: "entryType", keyPath: "entryType" },
    ],
  },
  {
    name: "marketData",
    keyPath: "id",
    residency: "authoritative",
    indexes: [{ name: "keyAndDate", keyPath: ["instrumentKey", "tradingDate"], unique: true }],
  },
  {
    name: "referenceCatalog",
    keyPath: "id",
    residency: "authoritative",
    indexes: [{ name: "kindAndParent", keyPath: ["kind", "parentId"] }],
  },
  {
    name: "workspaceMeta",
    keyPath: "key",
    residency: "authoritative",
    indexes: [],
  },
  {
    name: "lifecycleIndex",
    keyPath: "tradeId",
    residency: "authoritative",
    indexes: [
      { name: "state", keyPath: "state" },
      { name: "stateAndCutoff", keyPath: ["state", "cutoffTradingDate"] },
    ],
  },
  {
    name: "lifecycleListProjection",
    keyPath: "tradeId",
    residency: "rebuildable",
    rebuildSource: "lifecycleIndex",
    indexes: [{ name: "state", keyPath: "state" }],
  },
];

export const PROJECTION_STORES = SCHEMA_MANIFEST.filter(
  (store) => store.residency === "rebuildable",
);

export function validateManifest(stores: readonly StoreDefinition[] = SCHEMA_MANIFEST): string[] {
  const problems: string[] = [];
  const authoritative = new Set(
    stores.filter((store) => store.residency === "authoritative").map((store) => store.name),
  );

  for (const store of stores) {
    if (store.residency !== "authoritative" && store.residency !== "rebuildable") {
      problems.push(`${store.name}: declares no residency (authoritative or rebuildable)`);
    }
    if (store.residency === "rebuildable") {
      if (store.rebuildSource === undefined || store.rebuildSource === "") {
        problems.push(`${store.name}: a rebuildable store must declare its rebuild source`);
      } else if (!authoritative.has(store.rebuildSource)) {
        problems.push(
          `${store.name}: rebuild source ${store.rebuildSource} is not an authoritative store`,
        );
      }
    }
  }

  return problems;
}

export function openDatabase(
  name: string = DATABASE_NAME,
  version: number = SCHEMA_VERSION,
): Promise<IDBDatabase> {
  const problems = validateManifest();
  if (problems.length > 0) {
    return Promise.reject(new Error(`invalid schema manifest: ${problems.join("; ")}`));
  }

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = () => {
      const database = request.result;
      const upgrade = request.transaction;
      for (const store of SCHEMA_MANIFEST) {
        const objectStore = database.objectStoreNames.contains(store.name)
          ? upgrade?.objectStore(store.name)
          : database.createObjectStore(store.name, { keyPath: store.keyPath });
        if (objectStore === undefined) continue;
        for (const index of store.indexes) {
          if (!objectStore.indexNames.contains(index.name)) {
            objectStore.createIndex(index.name, index.keyPath as string, {
              unique: index.unique === true,
            });
          }
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("the database did not open"));
  });
}

export function deleteDatabase(name: string = DATABASE_NAME): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("the database did not delete"));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("the request failed"));
  });
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("the transaction aborted"));
    transaction.onerror = () => reject(transaction.error ?? new Error("the transaction failed"));
  });
}

/**
 * Rebuild every rebuildable projection from its authoritative source. A projection holds no
 * authority, so this may run at any time and must reproduce identical contents (rule 8).
 */
export async function rebuildProjections(database: IDBDatabase): Promise<void> {
  for (const projection of PROJECTION_STORES) {
    const source = await readProjectionSource(database, projection);
    const transaction = database.transaction([projection.name], "readwrite");
    const store = transaction.objectStore(projection.name);
    store.clear();
    for (const row of source) store.put(row);
    await transactionDone(transaction);
  }
}

async function readProjectionSource(
  database: IDBDatabase,
  projection: StoreDefinition,
): Promise<readonly unknown[]> {
  if (projection.rebuildSource === undefined) return [];
  const transaction = database.transaction([projection.rebuildSource], "readonly");
  const rows = (await requestResult(
    transaction.objectStore(projection.rebuildSource).getAll(),
  )) as readonly Record<string, unknown>[];
  await transactionDone(transaction);

  if (projection.name === "lifecycleListProjection") {
    return rows.map((row) => ({
      tradeId: row.tradeId,
      state: row.state,
      ...(row.cutoffTradingDate === undefined ? {} : { cutoffTradingDate: row.cutoffTradingDate }),
      ...(row.factRevision === undefined ? {} : { factRevision: row.factRevision }),
      ...(row.openedOn === undefined ? {} : { openedOn: row.openedOn }),
      ...(row.closedOn === undefined ? {} : { closedOn: row.closedOn }),
    }));
  }
  return rows;
}
