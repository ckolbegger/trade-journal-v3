// Faults build only (D1 T1.27, D2 T2.16): fails any subset of the four readiness checks at the
// host-port boundary, and acts at the migration stage boundaries. Everything above the port and
// every migration stage (copying, validation, activation) is production code. The production
// bundle never imports this module; `verify:no-fault-hooks` proves the marker below and
// `__tjFaults` are absent there.
import { Temporal } from 'temporal-polyfill';
import type { Clock } from '../domain/time/index.ts';
import type { MigrationStageHooks } from '../coordinators/workspace/index.ts';
import type { HostPort } from './host.ts';
import type { ReadinessCheckName } from './runtime-not-writable.ts';

export const FAULT_HOOK_MARKER = 'tj-fault-hooks-v1';
export const CLOCK_PIN_MARKER = 'tj-clock-pin-v1';

const CHECKS: readonly ReadinessCheckName[] = ['diagnostic', 'capacity', 'control', 'inventory'];

// migration:validate: validation reports one more issue. migration:activate: the root flip
// transaction aborts. migration:hold: the migrator waits before activating until release().
export type MigrationFault = 'migration:validate' | 'migration:activate' | 'migration:hold';
export const MIGRATION_FAULTS: readonly MigrationFault[] = ['migration:validate', 'migration:activate', 'migration:hold'];

export type FaultName = ReadinessCheckName | MigrationFault;
const FAULTS: readonly FaultName[] = [...CHECKS, ...MIGRATION_FAULTS];

declare global {
  interface Window {
    // Set only while a launch is pinned by ?clock= (T4.26).
    __tjClockPin?: { readonly marker: string; readonly instant: string };
    __tjFaults?: {
      readonly marker: string;
      // Replaces the active faults.
      set(faults: readonly FaultName[]): void;
      // Lets a migrator held by migration:hold continue to activation.
      release(): void;
    };
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

const only = (names: readonly string[]) => new Set(FAULTS.filter((fault) => names.includes(fault)));

let active: Set<FaultName> | undefined;
let releaseHold: () => void = () => undefined;
let held: Promise<void> = new Promise((resolve) => (releaseHold = resolve));

// The active faults: `?faults=` at launch, then `window.__tjFaults.set([...])` mid-session.
function faults(): Set<FaultName> {
  if (active) return active;
  active = only((new URLSearchParams(window.location.search).get('faults') ?? '').split(',').map((s) => s.trim()));
  window.__tjFaults = {
    marker: FAULT_HOOK_MARKER,
    set(names) {
      active = only(names);
    },
    release() {
      releaseHold();
      held = new Promise((resolve) => (releaseHold = resolve));
    },
  };
  return active;
}

// Wraps the real host: each failing readiness check fails at the port.
export function faultyHost(real: HostPort): HostPort {
  faults();
  return {
    get indexedDB() {
      return faults().has('diagnostic') ? failingFactory : real.indexedDB;
    },
    get caches() {
      return faults().has('inventory') ? emptyCaches : real.caches;
    },
    get estimate() {
      const estimate = real.estimate;
      if (!faults().has('capacity') || !estimate) return estimate;
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
    controllerRelease: () => (faults().has('control') ? Promise.resolve(null) : real.controllerRelease()),
  };
}

// The migration stage-boundary hooks, each acting only while its fault is active.
export function migrationFaults(): MigrationStageHooks {
  faults();
  return {
    validated: (issues) =>
      faults().has('migration:validate') ? [...issues, { code: 'UnknownAccount', tradeId: 'fault-injected', accountId: 'fault-injected' }] : issues,
    beforeActivate: () => (faults().has('migration:hold') ? held : Promise.resolve()),
    activating: () => {
      if (faults().has('migration:activate')) throw new Error('injected fault: migration:activate');
    },
  };
}

// D4 T4.26 (A49): `?clock=<ISO instant>` fixes the app's now for that launch. The app reads now only
// through the injected Clock, so pinning that seam fixes the Review Date, the shell's calendar
// state and every saved time together; timers still run normally. An absent or non-instant value
// (a zone-less time included) is ignored, like an unknown fault name.
export function pinnedClock(search: string, real: Clock): Clock {
  const value = new URLSearchParams(search).get('clock');
  if (!value) return real;
  try {
    const pinned = Temporal.Instant.from(value).toString();
    if (typeof window !== 'undefined') window.__tjClockPin = { marker: CLOCK_PIN_MARKER, instant: pinned };
    return { now: () => pinned };
  } catch {
    return real;
  }
}
