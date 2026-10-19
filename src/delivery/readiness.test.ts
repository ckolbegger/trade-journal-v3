import { IDBFactory, IDBObjectStore as FakeIDBObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stageRelease } from '../sw/index.ts';
import { fakeFetch, fakeRelease, MemoryCacheStorage, ORIGIN, type FakeRelease } from '../sw/test-doubles.ts';
import type { HostPort } from './host.ts';
import { createReadinessSession, evaluateReadiness } from './readiness.ts';

const GB = 1024 ** 3;
const requirement = { projectedWorkspaceBytes: 0.7 * GB, requiredQuotaBytes: 2.1 * GB };

let factory: IDBFactory;
let release: FakeRelease;
let caches: MemoryCacheStorage;

beforeEach(async () => {
  factory = new IDBFactory();
  release = await fakeRelease('v1');
  caches = new MemoryCacheStorage();
  await stageRelease({
    releaseId: release.releaseId,
    origin: ORIGIN,
    caches: caches as unknown as CacheStorage,
    fetch: fakeFetch(release, []).fetch,
    skipWaiting: () => Promise.resolve(),
    claimClients: () => Promise.resolve(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function host(overrides: Partial<HostPort> = {}): HostPort {
  return {
    indexedDB: factory,
    caches: caches as unknown as CacheStorage,
    estimate: () => Promise.resolve({ quota: 10 * GB, usage: 1024 }),
    persisted: () => Promise.resolve(false),
    persist: () => Promise.resolve(false),
    controllerRelease: () => Promise.resolve(release.releaseId),
    ...overrides,
  };
}

function evaluate(overrides: Partial<HostPort> = {}, rootInspection: Parameters<typeof evaluateReadiness>[0]['rootInspection'] = { kind: 'NoWorkspace', deletedOrphans: [] }) {
  return evaluateReadiness({ host: host(overrides), rootInspection, capacityRequirement: requirement, pageReleaseId: release.releaseId });
}

function rawAll(database: string, store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const open = factory.open(database);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
    open.onsuccess = () => {
      const request = open.result.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => {
        open.result.close();
        resolve(request.result);
      };
    };
  });
}

describe('diagnostic transaction check', () => {
  it('should write, read back, and delete a probe in tj-root.diagnostics in one transaction and pass, leaving the store empty and no Workspace store touched', async () => {
    const evaluation = await evaluate();
    expect(evaluation.checks.diagnostic).toEqual({ passed: true });
    expect(await rawAll('tj-root', 'diagnostics')).toEqual([]);
    expect((await factory.databases()).map((d) => d.name)).toEqual(['tj-root']);
  });

  it('should fail with the failing step named when the probe write, read-back comparison, or delete fails', async () => {
    const store = FakeIDBObjectStore.prototype;
    const fault = () => {
      throw new DOMException('injected', 'UnknownError');
    };

    vi.spyOn(store, 'put').mockImplementation(fault);
    expect((await evaluate()).checks.diagnostic).toEqual({ passed: false, reason: 'WriteFailed' });
    vi.restoreAllMocks();

    const realGet = Reflect.get(store, 'get') as (this: IDBObjectStore, key: IDBValidKey) => IDBRequest;
    vi.spyOn(store, 'get').mockImplementation(function (this: IDBObjectStore) {
      return realGet.call(this, 'some-other-key');
    });
    expect((await evaluate()).checks.diagnostic).toEqual({ passed: false, reason: 'ReadBackMismatch' });
    vi.restoreAllMocks();

    vi.spyOn(store, 'delete').mockImplementation(fault);
    expect((await evaluate()).checks.diagnostic).toEqual({ passed: false, reason: 'DeleteFailed' });
  });
});

describe('capacity check', () => {
  it('should pass when quota ≥ the requirement and record quota, usage, available, M, and the requirement as evidence', async () => {
    const evaluation = await evaluate({ estimate: () => Promise.resolve({ quota: 3 * GB, usage: 0.5 * GB }) });
    expect(evaluation.checks.capacity).toEqual({
      passed: true,
      evidence: {
        quota: 3 * GB,
        usage: 0.5 * GB,
        available: 2.5 * GB,
        projectedWorkspaceBytes: requirement.projectedWorkspaceBytes,
        requiredQuotaBytes: requirement.requiredQuotaBytes,
      },
    });
  });

  it('should fail when quota < the requirement', async () => {
    const evaluation = await evaluate({ estimate: () => Promise.resolve({ quota: 2 * GB, usage: 0 }) });
    expect(evaluation.checks.capacity).toEqual(
      expect.objectContaining({ passed: false, reason: 'InsufficientQuota' }),
    );
  });

  it('should fail with reason EstimateUnavailable when storage.estimate is absent or rejects', async () => {
    expect((await evaluate({ estimate: undefined })).checks.capacity).toEqual({
      passed: false,
      reason: 'EstimateUnavailable',
    });
    const rejects = () => Promise.reject(new Error('no estimate'));
    expect((await evaluate({ estimate: rejects })).checks.capacity).toEqual({
      passed: false,
      reason: 'EstimateUnavailable',
    });
  });
});

describe('service-worker control check', () => {
  it('should pass when the controller reports the page\'s release identity', async () => {
    expect((await evaluate()).checks.control).toEqual({ passed: true });
  });

  it('should fail when there is no controller after the first-claim wait, or when the controller reports a different release identity', async () => {
    expect((await evaluate({ controllerRelease: () => Promise.resolve(null) })).checks.control).toEqual({
      passed: false,
      reason: 'NoController',
    });
    expect((await evaluate({ controllerRelease: () => Promise.resolve('another-release') })).checks.control).toEqual({
      passed: false,
      reason: 'DifferentRelease',
    });
  });
});

describe('inventory check', () => {
  it('should pass when every inventory asset is cached and its recomputed digest matches', async () => {
    expect((await evaluate()).checks.inventory).toEqual({
      passed: true,
      evidence: { assetCount: release.inventory.assets.length },
    });
  });

  it('should fail and name each asset that is missing or whose digest differs', async () => {
    const cache = caches.caches.get(`tj-release-${release.releaseId}`);
    cache?.entries.delete(`${ORIGIN}/manifest.webmanifest`);
    cache?.entries.set(`${ORIGIN}/assets/app.js`, new Response('tampered'));
    expect((await evaluate()).checks.inventory).toEqual({
      passed: false,
      reason: 'InventoryInvalid',
      evidence: {
        assetCount: release.inventory.assets.length,
        problems: [
          { path: '/assets/app.js', problem: 'DigestMismatch' },
          { path: '/manifest.webmanifest', problem: 'Missing' },
        ],
      },
    });

    caches.caches.clear();
    expect((await evaluate()).checks.inventory).toEqual({ passed: false, reason: 'InventoryMissing' });
    expect(await caches.keys()).toEqual([]);
  });
});

describe('outcome classification', () => {
  it('should return Writable when all four checks pass', async () => {
    const evaluation = await evaluate();
    expect(evaluation.outcome).toBe('Writable');
    expect(evaluation.failures).toEqual([]);
  });

  it('should return Unsupported with every failed check when the root inspection reports NoWorkspace', async () => {
    const evaluation = await evaluate({ controllerRelease: () => Promise.resolve(null) });
    expect(evaluation).toEqual(
      expect.objectContaining({
        outcome: 'Unsupported',
        workspaceStatus: 'None',
        failures: [{ check: 'control', reason: 'NoController' }],
      }),
    );
  });

  it('should return RecoveryOnly with every failed check when a readable Workspace exists', async () => {
    const evaluation = await evaluate(
      { estimate: () => Promise.resolve({ quota: GB, usage: 0 }) },
      { kind: 'KnownWorkspace', databaseName: 'tj-ws-a', schemaVersion: 1, deletedOrphans: [] },
    );
    expect(evaluation).toEqual(
      expect.objectContaining({
        outcome: 'RecoveryOnly',
        workspaceStatus: 'RecoveryOnly',
        failures: [{ check: 'capacity', reason: 'InsufficientQuota' }],
      }),
    );
  });

  it('should return Unsupported with Workspace status IntegrityBlocked when the root is Unreadable, whatever the other checks report', async () => {
    // The unreadable store is itself reported as a failed diagnostic, because RuntimeNotWritable
    // always names at least one failed check (design overview).
    const unreadable = { check: 'diagnostic', reason: 'ExistingRootUnreadable' };
    for (const root of ['PossibleRoot', 'KnownRoot'] as const) {
      const allPass = await evaluate({}, { kind: 'Unreadable', root });
      expect(allPass).toEqual(expect.objectContaining({ outcome: 'Unsupported', workspaceStatus: 'IntegrityBlocked' }));
      expect(allPass.failures).toContainEqual(unreadable);
      const oneFails = await evaluate({ controllerRelease: () => Promise.resolve(null) }, { kind: 'Unreadable', root });
      expect(oneFails).toEqual(expect.objectContaining({ outcome: 'Unsupported', workspaceStatus: 'IntegrityBlocked' }));
      expect(oneFails.failures).toContainEqual(unreadable);
    }
  });

  it('should report all failed checks when two or more fail at once, never only the first', async () => {
    const evaluation = await evaluate({
      estimate: undefined,
      controllerRelease: () => Promise.resolve(null),
      caches: new MemoryCacheStorage() as unknown as CacheStorage,
    });
    expect(evaluation.failures).toEqual([
      { check: 'capacity', reason: 'EstimateUnavailable' },
      { check: 'control', reason: 'NoController' },
      { check: 'inventory', reason: 'InventoryMissing' },
    ]);
  });
});

describe('storage protection is advisory', () => {
  it('should report Protected, BestEffort, or Unavailable from storage.persisted and remain Writable when protection is BestEffort or Unavailable', async () => {
    const protectedEval = await evaluate({ persisted: () => Promise.resolve(true) });
    expect([protectedEval.protection, protectedEval.outcome]).toEqual(['Protected', 'Writable']);
    const bestEffort = await evaluate({ persisted: () => Promise.resolve(false) });
    expect([bestEffort.protection, bestEffort.outcome]).toEqual(['BestEffort', 'Writable']);
    const absent = await evaluate({ persisted: undefined });
    expect([absent.protection, absent.outcome]).toEqual(['Unavailable', 'Writable']);
    const rejects = await evaluate({ persisted: () => Promise.reject(new Error('denied')) });
    expect([rejects.protection, rejects.outcome]).toEqual(['Unavailable', 'Writable']);
  });
});

describe('session readiness', () => {
  it('should move the session from Writable to RecoveryOnly immediately when a storage failure is reported and the Workspace is still readable', async () => {
    const initial = await evaluate();
    let evaluations = 0;
    const session = await createReadinessSession(() => {
      evaluations++;
      return Promise.resolve(initial);
    });
    expect(session.current().outcome).toBe('Writable');
    session.reportStorageFailure({ workspaceReadable: true });
    expect(session.current()).toEqual(
      expect.objectContaining({
        outcome: 'RecoveryOnly',
        workspaceStatus: 'RecoveryOnly',
        failures: [{ check: 'diagnostic', reason: 'StorageFailure' }],
      }),
    );
    expect(evaluations).toBe(1);
  });

  it('should replace the session state with a fresh evaluation when recheck is called', async () => {
    const writable = await evaluate();
    const failing = await evaluate({ controllerRelease: () => Promise.resolve('another-release') });
    const results = [writable, failing];
    const session = await createReadinessSession(() => Promise.resolve(results.shift() ?? failing));
    expect(session.current()).toBe(writable);
    expect(await session.recheck()).toBe(failing);
    expect(session.current()).toBe(failing);
  });
});
