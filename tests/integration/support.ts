import { deriveMinimum, MATURE_WORKLOAD } from "../../src/capacity";
import { runDiagnosticTransaction, type DiagnosticTransactionResult } from "../../src/persistence/indexeddb/diagnostic";
import { deleteDatabase, openDatabase, SCHEMA_MANIFEST } from "../../src/persistence/indexeddb/schema";
import { createTransactionSeam, type TransactionSeam } from "../../src/persistence/indexeddb/transaction";
import { createWriteGate, type ReadinessDecision } from "../../src/persistence/indexeddb/writeGate";
import type { HostPort, StorageProtection, WorkerControl } from "../../src/platform/host";
import type { ReadinessPorts, ReadinessResult } from "../../src/readiness";
import {
  listDigestOf,
  releaseIdOf,
  sha256Hex,
  validateReleaseInventory,
  type InventoryValidation,
} from "../../src/release/inventory";
import { initialize, type WorkspaceInitializationResult } from "../../src/workspace";

export const MINIMUM_BYTES = deriveMinimum(MATURE_WORKLOAD).bytes;

export interface ReleaseCache {
  readonly entries: Map<string, Uint8Array>;
  readonly releaseId: string;
}

export async function buildRelease(overrides: Record<string, string> = {}): Promise<ReleaseCache> {
  const assets: Record<string, string> = {
    "/index.html": "<!doctype html><title>Trade Journal</title>",
    "/assets/app.js": "console.log('journal');",
    "/manifest.webmanifest": "{}",
    ...overrides,
  };
  const entries = new Map<string, Uint8Array>();
  for (const [url, text] of Object.entries(assets)) {
    entries.set(url, new TextEncoder().encode(text));
  }
  const list = await Promise.all(
    [...entries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(async ([url, bytes]) => ({ url, sha256: await sha256Hex(bytes) })),
  );
  const listDigest = await listDigestOf(list);
  const releaseId = await releaseIdOf(listDigest);
  entries.set(
    "/release-inventory.json",
    new TextEncoder().encode(
      JSON.stringify({ releaseId, listDigest, exclusions: ["release-inventory.json"], entries: list }),
    ),
  );
  return { entries, releaseId };
}

/** A real implementation of the host's cache-read operation over an in-memory release. */
export function hostOf(cache: ReleaseCache): HostPort {
  return {
    async cachedAsset(url: string) {
      const bytes = cache.entries.get(url);
      return bytes === undefined
        ? { kind: "Missing" as const, assetUrl: url }
        : { kind: "Present" as const, assetUrl: url, bytes };
    },
  } as unknown as HostPort;
}

export interface ReadinessOptions {
  readonly diagnostic?: DiagnosticTransactionResult;
  readonly capacityFreeBytes?: number;
  readonly protection?: StorageProtection;
  readonly workerControl?: WorkerControl;
  readonly inventory?: InventoryValidation;
}

export function readinessPorts(
  database: IDBDatabase,
  cache: ReleaseCache,
  options: ReadinessOptions = {},
): ReadinessPorts {
  return {
    protection: async () => options.protection ?? { kind: "Protected" },
    diagnostic: async () => options.diagnostic ?? runDiagnosticTransaction(database),
    capacity: async () => ({ freeBytes: options.capacityFreeBytes ?? MINIMUM_BYTES + 1_000_000 }),
    workerControl: async () =>
      options.workerControl ?? { kind: "Controlled", scriptURL: "/sw.js", releaseId: cache.releaseId },
    inventory: async (expectedReleaseId) =>
      options.inventory ??
      validateReleaseInventory(
        hostOf(cache),
        expectedReleaseId === undefined ? {} : { expectedReleaseId },
      ),
  };
}

export const TRIVIAL_MIGRATION = {
  outcome: "Migrated",
  activeDatabaseName: "trade-journal",
  receipt: {
    migrationId: "integration",
    schemaTransitions: [],
    migrationsApplied: [],
    seedVersion: "",
    seedAdditions: [],
    privateRebuilds: [],
  },
} as const;

const openHandles: IDBDatabase[] = [];

export async function closeAll(): Promise<void> {
  for (const handle of openHandles.splice(0)) handle.close();
  await deleteDatabase();
}

export async function openStore(): Promise<{
  database: IDBDatabase;
  seam: TransactionSeam;
  decisions: { current: ReadinessDecision };
}> {
  const database = await openDatabase();
  openHandles.push(database);
  const decisions: { current: ReadinessDecision } = {
    current: { outcome: "Writable", failedChecks: [] },
  };
  const seam = createTransactionSeam(
    database,
    createWriteGate({ current: async () => decisions.current }),
  );
  return { database, seam, decisions };
}

export function initializeWorkspace(
  seam: TransactionSeam,
  readiness: ReadinessResult,
  openingInstant = "2026-10-19T13:30:00.000Z",
): Promise<WorkspaceInitializationResult> {
  return initialize(
    {
      readiness: async () => readiness,
      seam: () => seam,
      migrate: async () => TRIVIAL_MIGRATION as never,
      root: async () => "absent",
    },
    { openingInstant, timeZone: "America/New_York" },
  );
}

export { SCHEMA_MANIFEST };
