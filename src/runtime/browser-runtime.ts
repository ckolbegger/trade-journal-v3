import { ReferenceCatalogService } from '../domain/reference-catalog/reference-catalog-service';
import {
  MIN_REQUIRED_STORAGE_BYTES,
  evaluateRuntimeReadiness,
  type RuntimeEnvironmentAdapters,
  type RuntimeStorageProtection,
} from '../domain/workspace/runtime-readiness';
import { WorkspaceService } from '../domain/workspace/workspace-service';
import { DB_NAME_DEFAULT } from '../persistence/schema-v1';
import { TransactionManager } from '../persistence/transaction-manager';
import {
  isOfflineReleaseInventory,
  type OfflineReleaseInventory,
} from '../pwa/release-inventory';
import { UpdateCoordinator } from '../pwa/update-coordinator';

export interface RuntimeTestOverrides {
  readonly freeStorageBytes?: number | null;
  readonly storageProtection?: RuntimeStorageProtection;
  readonly persistGrantResult?: boolean;
  readonly persistThrows?: boolean;
  readonly swActiveOk?: boolean;
  readonly swErrorMessage?: string;
  readonly inventoryOverride?: OfflineReleaseInventory | null | 'corrupt';
  readonly probeFailure?: string | null;
  readonly storageReadFailure?: string | null;
  readonly knownUnreadableRoot?: boolean;
  readonly midSessionFailure?: string | null;
}

export interface AppRuntime {
  readonly transactionManager: TransactionManager;
  readonly workspaceService: WorkspaceService;
  readonly catalogService: ReferenceCatalogService;
  readonly updateCoordinator: UpdateCoordinator;
  readonly setHasUnsavedFormState: (dirty: boolean) => void;
  readonly setTestOverrides: (overrides: RuntimeTestOverrides) => void;
  readonly getTestOverrides: () => RuntimeTestOverrides;
}

declare global {
  interface Window {
    __TRADE_JOURNAL_TEST_OVERRIDES__?: RuntimeTestOverrides;
    __TRADE_JOURNAL_RUNTIME__?: AppRuntime;
  }
}

async function ensureServiceWorkerRegisteredAndReady(): Promise<{
  readonly ok: boolean;
  readonly releaseVersion?: string;
  readonly errorMessage?: string;
}> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      ok: false,
      errorMessage: 'Service Worker API is not supported in this browser.',
    };
  }

  try {
    let reg = await navigator.serviceWorker.getRegistration('/');
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }

    if (reg.active) {
      return { ok: true, releaseVersion: '1.0.0-d01' };
    }

    const installing = reg.installing ?? reg.waiting;
    if (installing) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timed out waiting for Service Worker activation.'));
        }, 6000);
        installing.addEventListener('statechange', () => {
          if (installing.state === 'activated') {
            clearTimeout(timeout);
            resolve();
          } else if (installing.state === 'redundant') {
            clearTimeout(timeout);
            reject(new Error('Service Worker became redundant during installation.'));
          }
        });
      });
    }

    await navigator.serviceWorker.ready;
    return { ok: true, releaseVersion: '1.0.0-d01' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      errorMessage: `Service Worker registration or activation failed: ${msg}`,
    };
  }
}

async function loadInventoryFromCacheOrNetwork(): Promise<OfflineReleaseInventory | null> {
  try {
    if (typeof caches !== 'undefined') {
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) {
        if (key.startsWith('trade-journal-v3-release-')) {
          const cache = await caches.open(key);
          const match = await cache.match('/offline-release-inventory.json');
          if (match) {
            const json = (await match.json()) as unknown;
            if (isOfflineReleaseInventory(json)) {
              return json;
            }
          }
        }
      }
    }
    const response = await fetch('/offline-release-inventory.json', { cache: 'no-cache' });
    if (!response.ok) return null;
    const json = (await response.json()) as unknown;
    return isOfflineReleaseInventory(json) ? json : null;
  } catch {
    return null;
  }
}

async function fetchAssetBytesFromCacheOrNetwork(path: string): Promise<Uint8Array | null> {
  try {
    if (typeof caches !== 'undefined') {
      const cacheKeys = await caches.keys();
      for (const key of cacheKeys) {
        if (key.startsWith('trade-journal-v3-release-')) {
          const cache = await caches.open(key);
          const match = await cache.match(path);
          if (match) {
            const buf = await match.arrayBuffer();
            return new Uint8Array(buf);
          }
        }
      }
    }
    const response = await fetch(path);
    if (!response.ok) return null;
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export function createBrowserAppRuntime(options: {
  readonly dbName?: string;
  readonly initialOverrides?: RuntimeTestOverrides;
} = {}): AppRuntime {
  const tm = new TransactionManager({
    dbName: options.dbName ?? DB_NAME_DEFAULT,
  });

  let localOverrides: RuntimeTestOverrides = {
    ...(typeof window !== 'undefined' ? window.__TRADE_JOURNAL_TEST_OVERRIDES__ : {}),
    ...options.initialOverrides,
  };

  let currentProtectionState: RuntimeStorageProtection | null = null;
  let hasUnsavedFormStateFlag = false;
  let lastLoadedReleaseId = '1.0.0-d01';

  const applyFaultOverrides = () => {
    const merged: RuntimeTestOverrides = {
      ...(typeof window !== 'undefined' ? window.__TRADE_JOURNAL_TEST_OVERRIDES__ : {}),
      ...localOverrides,
    };
    tm.injectFaults({
      probeFailure: merged.probeFailure ?? null,
      storageReadFailure: merged.storageReadFailure ?? null,
      knownUnreadableRoot: merged.knownUnreadableRoot ?? false,
      midSessionFailure: merged.midSessionFailure ?? null,
    });
    return merged;
  };

  const getProtection = async (): Promise<RuntimeStorageProtection> => {
    const merged = applyFaultOverrides();
    if (currentProtectionState !== null) {
      return currentProtectionState;
    }
    if (merged.storageProtection !== undefined) {
      return merged.storageProtection;
    }
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persisted === 'function'
    ) {
      try {
        const persisted = await navigator.storage.persisted();
        return persisted ? 'PersistentGranted' : 'BestEffort';
      } catch {
        return 'Unavailable';
      }
    }
    return 'BestEffort';
  };

  const evaluateReadiness = async () => {
    const merged = applyFaultOverrides();
    let cachedInventory: OfflineReleaseInventory | null = null;

    const loadInv = async (): Promise<OfflineReleaseInventory | null> => {
      if (merged.inventoryOverride === 'corrupt') {
        return null;
      }
      if (merged.inventoryOverride !== undefined) {
        cachedInventory = merged.inventoryOverride;
        if (cachedInventory) {
          lastLoadedReleaseId = cachedInventory.releaseId;
        }
        return cachedInventory;
      }
      cachedInventory = await loadInventoryFromCacheOrNetwork();
      if (cachedInventory) {
        lastLoadedReleaseId = cachedInventory.releaseId;
      }
      return cachedInventory;
    };

    const preloaded = await loadInv();
    const expectedReleaseVersion = preloaded?.releaseId ?? lastLoadedReleaseId;

    const adapters: RuntimeEnvironmentAdapters = {
      isIndexedDbSupported: () => typeof indexedDB !== 'undefined',
      runDiagnosticProbe: () => tm.runDiagnosticProbeTransaction(),
      inspectStorageRoot: () => tm.inspectStorageRoot(),
      estimateFreeStorageBytes: async () => {
        if (merged.freeStorageBytes !== undefined) {
          return merged.freeStorageBytes;
        }
        if (
          typeof navigator !== 'undefined' &&
          navigator.storage &&
          typeof navigator.storage.estimate === 'function'
        ) {
          try {
            const est = await navigator.storage.estimate();
            if (typeof est.quota === 'number' && typeof est.usage === 'number') {
              return Math.max(0, est.quota - est.usage);
            }
          } catch {
            // Fall through to default sufficient estimate when browser estimate fails
          }
        }
        return MIN_REQUIRED_STORAGE_BYTES * 4;
      },
      getStorageProtection: getProtection,
      isServiceWorkerSupported: () =>
        merged.swActiveOk !== undefined
          ? true
          : typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
      verifyServiceWorkerActive: async () => {
        if (merged.swActiveOk !== undefined) {
          return {
            ok: merged.swActiveOk,
            releaseVersion: expectedReleaseVersion,
            errorMessage: merged.swErrorMessage,
          };
        }
        return ensureServiceWorkerRegisteredAndReady();
      },
      loadOfflineReleaseInventory: async () => preloaded,
      fetchCachedAssetBytes: async (path: string) => {
        if (merged.inventoryOverride === 'corrupt') {
          return null;
        }
        return fetchAssetBytesFromCacheOrNetwork(path);
      },
      expectedReleaseVersion,
    };

    return evaluateRuntimeReadiness(adapters);
  };

  const workspaceService = new WorkspaceService({
    transactionManager: tm,
    evaluateReadiness,
    requestDurabilityAdapter: {
      getCurrentProtection: getProtection,
      requestPersistentStorage: async () => {
        const merged = applyFaultOverrides();
        if (merged.persistThrows) {
          throw new Error('Persist call threw');
        }
        if (merged.persistGrantResult !== undefined) {
          if (merged.persistGrantResult) {
            currentProtectionState = 'PersistentGranted';
          }
          return merged.persistGrantResult;
        }
        if (
          typeof navigator !== 'undefined' &&
          navigator.storage &&
          typeof navigator.storage.persist === 'function'
        ) {
          const granted = await navigator.storage.persist();
          if (granted) {
            currentProtectionState = 'PersistentGranted';
          }
          return granted;
        }
        return false;
      },
    },
  });

  const catalogService = new ReferenceCatalogService({
    transactionManager: tm,
    evaluateReadiness,
  });

  const updateCoordinator = new UpdateCoordinator({
    initialReleaseId: '1.0.0-d01',
    hasUnsavedFormState: () => hasUnsavedFormStateFlag,
  });

  const runtime: AppRuntime = {
    transactionManager: tm,
    workspaceService,
    catalogService,
    updateCoordinator,
    setHasUnsavedFormState: (dirty: boolean) => {
      hasUnsavedFormStateFlag = dirty;
    },
    setTestOverrides: (overrides: RuntimeTestOverrides) => {
      localOverrides = { ...localOverrides, ...overrides };
      if (overrides.storageProtection !== undefined) {
        currentProtectionState = null;
      }
      applyFaultOverrides();
    },
    getTestOverrides: () => ({
      ...(typeof window !== 'undefined' ? window.__TRADE_JOURNAL_TEST_OVERRIDES__ : {}),
      ...localOverrides,
    }),
  };

  if (typeof window !== 'undefined') {
    window.__TRADE_JOURNAL_RUNTIME__ = runtime;
  }

  return runtime;
}
