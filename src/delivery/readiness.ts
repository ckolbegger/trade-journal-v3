import type { RootInspection } from '../persistence/index.ts';
import { ROOT_DATABASE, ROOT_VERSION, upgradeRoot } from '../persistence/schema.ts';
import type { HostPort } from './host.ts';
import type { ReadinessFailure } from './runtime-not-writable.ts';
import { assetDigest, releaseIdentityOf, type OfflineReleaseInventory } from './inventory.ts';

export type CheckResult =
  | { readonly passed: true; readonly evidence?: CheckEvidence }
  | { readonly passed: false; readonly reason: string; readonly evidence?: CheckEvidence };

export interface CapacityEvidence {
  readonly quota: number;
  readonly usage: number;
  readonly available: number;
  readonly projectedWorkspaceBytes: number;
  readonly requiredQuotaBytes: number;
}

export interface InventoryEvidence {
  readonly assetCount: number;
  readonly problems?: readonly { readonly path: string; readonly problem: 'Missing' | 'DigestMismatch' }[];
}

export type CheckEvidence = CapacityEvidence | InventoryEvidence;

export interface CapacityRequirement {
  readonly projectedWorkspaceBytes: number;
  readonly requiredQuotaBytes: number;
}

export interface ReadinessInput {
  readonly host: HostPort;
  readonly rootInspection: RootInspection;
  readonly capacityRequirement: CapacityRequirement;
  readonly pageReleaseId: string;
}

export type ReadinessOutcome =
  | { readonly outcome: 'Writable' }
  | { readonly outcome: 'RecoveryOnly'; readonly workspaceStatus: 'RecoveryOnly' }
  | { readonly outcome: 'Unsupported'; readonly workspaceStatus: 'None' | 'IntegrityBlocked' };

export type StorageProtection = 'Protected' | 'BestEffort' | 'Unavailable';

export type ReadinessEvaluation = ReadinessOutcome & {
  readonly failures: readonly ReadinessFailure[];
  // Advisory only (ADR 0009): reported on every launch, never part of the outcome.
  readonly protection: StorageProtection;
  readonly checks: { readonly diagnostic: CheckResult; readonly capacity: CheckResult; readonly control: CheckResult;
    readonly inventory: CheckResult;
  };
};

// An isolated write, read-back, and delete in the root's diagnostics store, in one
// transaction, that leaves no record behind and touches no Workspace store.
function diagnosticCheck(factory: IDBFactory): Promise<CheckResult> {
  return new Promise((resolve) => {
    const open = factory.open(ROOT_DATABASE, ROOT_VERSION);
    open.onupgradeneeded = (event) => upgradeRoot(open.result, event.oldVersion);
    open.onerror = () => resolve({ passed: false, reason: 'OpenFailed' });
    open.onsuccess = () => {
      const db = open.result;
      let outcome: CheckResult = { passed: true };
      const fail = (reason: string) => {
        if (outcome.passed) outcome = { passed: false, reason };
      };
      // Runs one step; a step that throws or whose request errors fails the check by name.
      const step = (reason: string, run: () => IDBRequest, then?: (result: unknown) => void) => {
        try {
          const request = run();
          request.onerror = () => fail(reason);
          if (then) request.onsuccess = () => then(request.result);
        } catch {
          fail(reason);
          tx.abort();
        }
      };
      const tx = db.transaction('diagnostics', 'readwrite');
      const store = tx.objectStore('diagnostics');
      const probe = { id: 'readiness-probe', nonce: crypto.randomUUID() };
      step('WriteFailed', () => store.put(probe), () =>
        step('ReadBackFailed', () => store.get(probe.id), (read) => {
          if ((read as typeof probe | undefined)?.nonce !== probe.nonce) fail('ReadBackMismatch');
          step('DeleteFailed', () => store.delete(probe.id));
        }),
      );
      tx.oncomplete = () => {
        db.close();
        resolve(outcome);
      };
      tx.onabort = () => {
        db.close();
        fail('TransactionAborted');
        resolve(outcome);
      };
    };
  });
}

// Origin quota against the plan-derived requirement for a mature Workspace plus migration and
// backup headroom (decision 18).
async function capacityCheck(host: HostPort, requirement: CapacityRequirement): Promise<CheckResult> {
  let estimate: StorageEstimate;
  try {
    if (!host.estimate) return { passed: false, reason: 'EstimateUnavailable' };
    estimate = await host.estimate();
  } catch {
    return { passed: false, reason: 'EstimateUnavailable' };
  }
  const quota = estimate.quota ?? 0;
  const usage = estimate.usage ?? 0;
  const evidence: CapacityEvidence = {
    quota,
    usage,
    available: quota - usage,
    projectedWorkspaceBytes: requirement.projectedWorkspaceBytes,
    requiredQuotaBytes: requirement.requiredQuotaBytes,
  };
  return quota >= requirement.requiredQuotaBytes
    ? { passed: true, evidence }
    : { passed: false, reason: 'InsufficientQuota', evidence };
}

// The page is controlled by the service worker of the same release it was loaded from.
async function controlCheck(host: HostPort, pageReleaseId: string): Promise<CheckResult> {
  const controller = await host.controllerRelease();
  if (controller === null) return { passed: false, reason: 'NoController' };
  return controller === pageReleaseId ? { passed: true } : { passed: false, reason: 'DifferentRelease' };
}

// The current release's complete Offline Release Inventory is cached and digest-valid.
async function inventoryCheck(host: HostPort, pageReleaseId: string): Promise<CheckResult> {
  const name = `tj-release-${pageReleaseId}`;
  // `open` would create an empty cache; the check never changes cache state.
  if (!(await host.caches.has(name))) return { passed: false, reason: 'InventoryMissing' };
  const cache = await host.caches.open(name);
  const stored = await cache.match('/inventory.json');
  if (!stored) return { passed: false, reason: 'InventoryMissing' };
  const inventory = (await stored.json()) as OfflineReleaseInventory;
  if ((await releaseIdentityOf(inventory.assets)) !== pageReleaseId) return { passed: false, reason: 'InventoryMismatch' };
  const problems: { path: string; problem: 'Missing' | 'DigestMismatch' }[] = [];
  for (const asset of [...inventory.assets].sort((a, b) => (a.path < b.path ? -1 : 1))) {
    const cached = await cache.match(asset.path);
    if (!cached) {
      problems.push({ path: asset.path, problem: 'Missing' });
    } else if ((await assetDigest(new Uint8Array(await cached.arrayBuffer()), pageReleaseId)) !== asset.digest) {
      problems.push({ path: asset.path, problem: 'DigestMismatch' });
    }
  }
  const assetCount = inventory.assets.length;
  return problems.length === 0
    ? { passed: true, evidence: { assetCount } }
    : { passed: false, reason: 'InventoryInvalid', evidence: { assetCount, problems } };
}

export async function storageProtection(host: HostPort): Promise<StorageProtection> {
  try {
    if (!host.persisted) return 'Unavailable';
    return (await host.persisted()) ? 'Protected' : 'BestEffort';
  } catch {
    return 'Unavailable';
  }
}

export async function evaluateReadiness(input: ReadinessInput): Promise<ReadinessEvaluation> {
  const unreadable = input.rootInspection.kind === 'Unreadable';
  const checks = {
    // A known or possible existing root that cannot be read is never probed or written.
    diagnostic: unreadable
      ? ({ passed: false, reason: 'ExistingRootUnreadable' } as const)
      : await diagnosticCheck(input.host.indexedDB),
    capacity: await capacityCheck(input.host, input.capacityRequirement),
    control: await controlCheck(input.host, input.pageReleaseId),
    inventory: await inventoryCheck(input.host, input.pageReleaseId),
  };
  const protection = await storageProtection(input.host);
  // Every failed check is reported, never only the first.
  const failures: ReadinessFailure[] = [];
  for (const [check, result] of Object.entries(checks) as [ReadinessFailure['check'], CheckResult][]) {
    if (!result.passed) failures.push({ check, reason: result.reason });
  }
  if (failures.length === 0) return { outcome: 'Writable', failures, protection, checks };
  if (unreadable) return { outcome: 'Unsupported', workspaceStatus: 'IntegrityBlocked', failures, protection, checks };
  // A readable existing Workspace stays readable: Recovery Only, never Unsupported.
  if (input.rootInspection.kind === 'KnownWorkspace') {
    return { outcome: 'RecoveryOnly', workspaceStatus: 'RecoveryOnly', failures, protection, checks };
  }
  return { outcome: 'Unsupported', workspaceStatus: 'None', failures, protection, checks };
}

// The current session's readiness. Re-evaluated on launch, before each authoritative mutation
// (D1 A4), and after update activation; a storage failure downgrades it at once.
export interface ReadinessSession {
  current(): ReadinessEvaluation;
  reportStorageFailure(context: { readonly workspaceReadable: boolean }): void;
  recheck(): Promise<ReadinessEvaluation>;
}

export async function createReadinessSession(evaluate: () => Promise<ReadinessEvaluation>): Promise<ReadinessSession> {
  let state = await evaluate();
  return {
    current: () => state,
    async recheck() {
      state = await evaluate();
      return state;
    },
    reportStorageFailure(context) {
      if (state.outcome === 'Writable' && context.workspaceReadable) {
        state = {
          ...state,
          outcome: 'RecoveryOnly',
          workspaceStatus: 'RecoveryOnly',
          failures: [{ check: 'diagnostic', reason: 'StorageFailure' }],
        };
      }
    },
  };
}
