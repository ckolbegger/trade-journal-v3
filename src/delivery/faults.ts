// Faults build only (D1 T1.27): fails any subset of the four readiness checks at the host-port
// boundary. Everything above the port is production code. The production bundle never imports
// this module; `verify:no-fault-hooks` proves the marker below and `__tjFaults` are absent there.
import type { HostPort } from './host.ts';
import type { ReadinessCheckName } from './runtime-not-writable.ts';

export const FAULT_HOOK_MARKER = 'tj-fault-hooks-v1';

const CHECKS: readonly ReadinessCheckName[] = ['diagnostic', 'capacity', 'control', 'inventory'];

declare global {
  interface Window {
    __tjFaults?: { readonly marker: string; set(checks: readonly ReadinessCheckName[]): void };
  }
}

// An IndexedDB factory whose every open fails, so the diagnostic transaction fails.
const failingFactory = {
  open() {
    const request = { onerror: null as null | (() => void), error: new DOMException('injected fault', 'UnknownError') };
    setTimeout(() => request.onerror?.(), 0);
    return request;
  },
} as unknown as IDBFactory;

// A CacheStorage holding no release cache, so the inventory check finds nothing.
const emptyCaches = {
  has: () => Promise.resolve(false),
  open: () => Promise.reject(new Error('injected fault')),
} as unknown as CacheStorage;

function parse(list: string | null): Set<ReadinessCheckName> {
  const names = (list ?? '').split(',').map((s) => s.trim());
  return new Set(CHECKS.filter((check) => names.includes(check)));
}

// Wraps the real host: the failing set comes from `?faults=` at launch and changes mid-session
// through `window.__tjFaults.set([...])`.
export function faultyHost(real: HostPort): HostPort {
  let failing = parse(new URLSearchParams(window.location.search).get('faults'));
  window.__tjFaults = {
    marker: FAULT_HOOK_MARKER,
    set(checks) {
      failing = new Set(CHECKS.filter((check) => checks.includes(check)));
    },
  };
  return {
    get indexedDB() {
      return failing.has('diagnostic') ? failingFactory : real.indexedDB;
    },
    get caches() {
      return failing.has('inventory') ? emptyCaches : real.caches;
    },
    get estimate() {
      const estimate = real.estimate;
      if (!failing.has('capacity') || !estimate) return estimate;
      // The real usage, with no quota beyond it.
      return async () => {
        const { usage = 0 } = await estimate();
        return { usage, quota: usage };
      };
    },
    get persisted() {
      return real.persisted;
    },
    get persist() {
      return real.persist;
    },
    controllerRelease: () => (failing.has('control') ? Promise.resolve(null) : real.controllerRelease()),
  };
}
