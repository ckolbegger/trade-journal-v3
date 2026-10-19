// NodeTestHost: the disclosed Node substitute for the browser host (D1 breakdown, section 6.0).
// It reports Runtime Readiness inputs in memory and can be told to fail any of the four checks.
import type { HostPort } from '../../src/delivery/host.ts';
import type { ReadinessCheckName } from '../../src/delivery/runtime-not-writable.ts';
import { stageRelease } from '../../src/sw/index.ts';
import { fakeFetch, fakeRelease, MemoryCacheStorage, ORIGIN } from '../../src/sw/test-doubles.ts';

const GB = 1024 ** 3;

// An IndexedDB factory whose every open fails, for a failing diagnostic transaction.
const failingFactory = {
  open() {
    const request = { onerror: null as null | (() => void), error: new DOMException('injected', 'UnknownError') };
    setTimeout(() => request.onerror?.(), 0);
    return request;
  },
} as unknown as IDBFactory;

export interface NodeTestHost {
  readonly host: HostPort;
  readonly releaseId: string;
  fail(checks: readonly ReadinessCheckName[]): void;
  setProtection(state: { persisted?: boolean; persistResult?: boolean; available?: boolean }): void;
}

export async function nodeTestHost(indexedDB: IDBFactory): Promise<NodeTestHost> {
  const release = await fakeRelease('node-test');
  const caches = new MemoryCacheStorage();
  await stageRelease({
    releaseId: release.releaseId,
    origin: ORIGIN,
    caches: caches as unknown as CacheStorage,
    fetch: fakeFetch(release, []).fetch,
    skipWaiting: () => Promise.resolve(),
    claimClients: () => Promise.resolve(),
  });
  const empty = new MemoryCacheStorage();
  let failing = new Set<ReadinessCheckName>();
  let persisted = false;
  let persistResult = false;
  let available = true;
  const host: HostPort = {
    get indexedDB() {
      return failing.has('diagnostic') ? failingFactory : indexedDB;
    },
    get caches() {
      return (failing.has('inventory') ? empty : caches) as unknown as CacheStorage;
    },
    get estimate() {
      return () => Promise.resolve({ quota: failing.has('capacity') ? GB : 10 * GB, usage: 1024 });
    },
    get persisted() {
      return available ? () => Promise.resolve(persisted) : undefined;
    },
    get persist() {
      return available
        ? () => {
            persisted ||= persistResult;
            return Promise.resolve(persistResult);
          }
        : undefined;
    },
    controllerRelease: () => Promise.resolve(failing.has('control') ? null : release.releaseId),
  };
  return {
    host,
    releaseId: release.releaseId,
    fail(checks) {
      failing = new Set(checks);
    },
    setProtection(state) {
      persisted = state.persisted ?? persisted;
      persistResult = state.persistResult ?? persistResult;
      available = state.available ?? available;
    },
  };
}
