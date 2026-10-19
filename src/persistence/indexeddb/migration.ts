import {
  CANDIDATE_DATABASE_PREFIX,
  DATABASE_NAME,
  PROJECTION_STORES,
  deleteDatabase,
  openDatabase,
  rebuildProjections,
  transactionDone,
} from "./schema";

export const CONTROL_DATABASE_NAME = "trade-journal-control";
const POINTER_STORE = "pointer";
const POINTER_KEY = "active";

export const DEFAULT_ACTIVE_DATABASE = DATABASE_NAME;

export interface ActivePointer {
  readonly databaseName: string;
  readonly schemaVersion: number;
  readonly migrationId: string;
}

export interface DatabaseSnapshot {
  readonly stores: Readonly<Record<string, readonly Record<string, unknown>[]>>;
}

export interface MigrationRefusal {
  readonly refusal: "LossyMigrationRequired";
  readonly detail: string;
}

export interface MigrationStep {
  readonly id: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  apply(snapshot: DatabaseSnapshot): DatabaseSnapshot | MigrationRefusal;
}

export interface SeedAddition {
  readonly store: string;
  readonly stableKey: string;
  readonly values: Readonly<Record<string, unknown>>;
}

export interface SectionProblem {
  readonly section: string;
  readonly detail: string;
}

export interface MigrationPlan {
  readonly migrationId: string;
  readonly targetVersion: number;
  readonly steps: readonly MigrationStep[];
  readonly seedVersion: string;
  readonly seedAdditions: readonly SeedAddition[];
  readonly validate?: (snapshot: DatabaseSnapshot) => SectionProblem | undefined;
}

export interface MigrationReceipt {
  readonly migrationId: string;
  readonly schemaTransitions: readonly { readonly from: number; readonly to: number }[];
  readonly migrationsApplied: readonly string[];
  readonly seedVersion: string;
  readonly seedAdditions: readonly string[];
  readonly privateRebuilds: readonly string[];
}

export type MigrationOutcome =
  | {
      readonly outcome: "Migrated";
      readonly activeDatabaseName: string;
      readonly receipt: MigrationReceipt;
    }
  | {
      readonly outcome: "UnsupportedVersion";
      readonly storedVersion: number;
      readonly targetVersion: number;
      readonly activeDatabaseName: string;
    }
  | {
      readonly outcome: "MigrationBlocked";
      readonly reason: "ValidationFailed" | "LossyMigrationRequired";
      readonly detail: string;
      readonly activeDatabaseName: string;
    };

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("the request failed"));
  });
}

function openControlDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CONTROL_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(POINTER_STORE)) {
        database.createObjectStore(POINTER_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("the control database did not open"));
  });
}

export async function readPointer(): Promise<ActivePointer | undefined> {
  const database = await openControlDatabase();
  try {
    const row = await requestResult(
      database.transaction(POINTER_STORE).objectStore(POINTER_STORE).get(POINTER_KEY),
    );
    return row as ActivePointer | undefined;
  } finally {
    database.close();
  }
}

export async function writePointer(pointer: ActivePointer): Promise<void> {
  const database = await openControlDatabase();
  try {
    const transaction = database.transaction(POINTER_STORE, "readwrite");
    transaction.objectStore(POINTER_STORE).put({ key: POINTER_KEY, ...pointer });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function readActiveDatabaseName(): Promise<string> {
  return (await readPointer())?.databaseName ?? DEFAULT_ACTIVE_DATABASE;
}

export async function readActiveVersion(): Promise<number> {
  const pointer = await readPointer();
  if (pointer !== undefined) return pointer.schemaVersion;
  return storedVersion(DEFAULT_ACTIVE_DATABASE);
}

async function databaseExists(name: string): Promise<boolean> {
  const databases = await indexedDB.databases();
  return databases.some((database) => database.name === name);
}

function openExistingDatabase(name: string): Promise<IDBDatabase | undefined> {
  return databaseExists(name).then(
    (exists) =>
      new Promise<IDBDatabase | undefined>((resolve, reject) => {
        if (!exists) {
          resolve(undefined);
          return;
        }
        const request = indexedDB.open(name);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () =>
          reject(request.error ?? new Error("the database did not open"));
      }),
  );
}

async function storedVersion(name: string): Promise<number> {
  const database = await openExistingDatabase(name);
  if (database === undefined) return 0;
  const version = database.objectStoreNames.length === 0 ? 0 : database.version;
  database.close();
  return version;
}

export async function snapshotOf(database: IDBDatabase): Promise<DatabaseSnapshot> {
  const names = Array.from(database.objectStoreNames);
  const transaction = database.transaction(names, "readonly");
  const requests = names.map((name) =>
    requestResult(transaction.objectStore(name).getAll()),
  );
  const results = await Promise.all(requests);
  const stores: Record<string, readonly Record<string, unknown>[]> = {};
  names.forEach((name, index) => {
    stores[name] = results[index] as Record<string, unknown>[];
  });
  return { stores };
}

async function writeSnapshot(
  database: IDBDatabase,
  snapshot: DatabaseSnapshot,
): Promise<void> {
  const names = Object.keys(snapshot.stores).filter((name) =>
    database.objectStoreNames.contains(name),
  );
  const transaction = database.transaction(names, "readwrite");
  for (const name of names) {
    const store = transaction.objectStore(name);
    for (const row of snapshot.stores[name] ?? []) store.put(row);
  }
  await transactionDone(transaction);
}

function applySeeds(
  snapshot: DatabaseSnapshot,
  additions: readonly SeedAddition[],
): { snapshot: DatabaseSnapshot; applied: string[] } {
  const stores: Record<string, readonly Record<string, unknown>[]> = { ...snapshot.stores };
  const applied: string[] = [];

  for (const addition of additions) {
    const rows = [...(stores[addition.store] ?? [])];
    const existing = rows.some((row) => row.stableKey === addition.stableKey);
    if (existing) continue;
    rows.push({ ...addition.values, stableKey: addition.stableKey });
    stores[addition.store] = rows;
    applied.push(addition.stableKey);
  }

  return { snapshot: { stores }, applied };
}

function projectionMembershipMismatch(snapshot: DatabaseSnapshot): string | undefined {
  const identity = (row: Record<string, unknown>): string =>
    `${String(row.tradeId)}|${String(row.state)}`;
  const stored = new Set((snapshot.stores.lifecycleIndex ?? []).map(identity));
  const rebuilt = new Set((snapshot.stores.lifecycleListProjection ?? []).map(identity));
  const agrees =
    stored.size === rebuilt.size && [...stored].every((entry) => rebuilt.has(entry));
  return agrees
    ? undefined
    : "lifecycleIndex: recomputed projection membership differs from stored membership";
}

function blocked(
  reason: "ValidationFailed" | "LossyMigrationRequired",
  detail: string,
  activeDatabaseName: string,
): MigrationOutcome {
  return { outcome: "MigrationBlocked", reason, detail, activeDatabaseName };
}

async function discardStaleCandidates(): Promise<void> {
  const databases = await indexedDB.databases();
  for (const database of databases) {
    if (database.name?.startsWith(CANDIDATE_DATABASE_PREFIX) === true) {
      await deleteDatabase(database.name);
    }
  }
}

export async function migrate(plan: MigrationPlan): Promise<MigrationOutcome> {
  const activeName = await readActiveDatabaseName();
  const storedVersion = await readActiveVersion();

  await discardStaleCandidates();

  if (storedVersion > plan.targetVersion) {
    return {
      outcome: "UnsupportedVersion",
      storedVersion,
      targetVersion: plan.targetVersion,
      activeDatabaseName: activeName,
    };
  }


  const source = await openExistingDatabase(activeName);
  const snapshot = source === undefined ? { stores: {} } : await snapshotOf(source);
  source?.close();

  let current = snapshot;
  for (const step of plan.steps) {
    if (step.fromVersion < storedVersion) continue;
    const applied = step.apply(current);
    if ("refusal" in applied) {
      return blocked("LossyMigrationRequired", applied.detail, activeName);
    }
    current = applied;
  }

  const seeded = applySeeds(current, plan.seedAdditions);
  current = seeded.snapshot;

  const candidateName = `${CANDIDATE_DATABASE_PREFIX}${plan.migrationId}`;
  const candidate = await openDatabase(candidateName, plan.targetVersion);
  await writeSnapshot(candidate, current);
  await rebuildProjections(candidate);
  const candidateSnapshot = await snapshotOf(candidate);
  candidate.close();

  const problem = plan.validate?.(candidateSnapshot);
  if (problem !== undefined) {
    await deleteDatabase(candidateName);
    return blocked("ValidationFailed", `${problem.section}: ${problem.detail}`, activeName);
  }

  const membership = projectionMembershipMismatch(candidateSnapshot);
  if (membership !== undefined) {
    await deleteDatabase(candidateName);
    return blocked("ValidationFailed", membership, activeName);
  }

  await writePointer({
    databaseName: candidateName,
    schemaVersion: plan.targetVersion,
    migrationId: plan.migrationId,
  });

  return {
    outcome: "Migrated",
    activeDatabaseName: candidateName,
    receipt: {
      migrationId: plan.migrationId,
      schemaTransitions: [{ from: storedVersion, to: plan.targetVersion }],
      migrationsApplied: plan.steps.map((step) => step.id),
      seedVersion: plan.seedVersion,
      seedAdditions: seeded.applied,
      privateRebuilds: PROJECTION_STORES.map((store) => store.name),
    },
  };
}
