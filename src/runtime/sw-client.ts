import type { PersistenceSeam } from '../persistence/idb';
import type { StorageProtectionStatus } from '../shared/result';
import type { InventoryVerificationResult } from './inventory';
import type { ReadinessProbes } from './readiness';

export interface SwUpdateHandle {
  activateUpdate(): Promise<void>;
}

export interface SwRegistrationOptions {
  readonly onUpdateAvailable: (handle: SwUpdateHandle) => void;
}

const wiredRegistrations = new WeakSet<ServiceWorkerRegistration>();

function postSwMessage<T>(worker: ServiceWorker, message: unknown, timeoutMs = 5000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      reject(new Error('Service worker verification timed out.'));
    }, timeoutMs);

    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      channel.port1.close();
      if (typeof event.data !== 'object' || event.data === null) {
        reject(new Error('Service worker returned a malformed message payload.'));
        return;
      }
      resolve(event.data as T);
    };

    try {
      worker.postMessage(message, [channel.port2]);
    } catch (error) {
      clearTimeout(timer);
      channel.port1.close();
      reject(error);
    }
  });
}

async function waitForController(timeoutMs = 5000): Promise<ServiceWorker | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }
  if (navigator.serviceWorker.controller) {
    return navigator.serviceWorker.controller;
  }

  return new Promise<ServiceWorker | null>((resolve) => {
    const timer = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(navigator.serviceWorker.controller);
    }, timeoutMs);

    const onChange = () => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(navigator.serviceWorker.controller);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
}

export async function registerAppServiceWorker(
  options: SwRegistrationOptions,
): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  const notifyWaiting = (waiting: ServiceWorker) => {
    let activating = false;
    options.onUpdateAvailable({
      activateUpdate: async () => {
        if (activating) return;
        activating = true;
        try {
          await new Promise<void>((resolve, reject) => {
            if (waiting.state === 'redundant') {
              reject(new Error('Staged service worker became redundant before activation.'));
              return;
            }
            const timer = setTimeout(() => {
              cleanup();
              reject(new Error('Timed out waiting for updated service worker to take control.'));
            }, 10_000);

            const onControllerChange = () => {
              cleanup();
              resolve();
            };

            const onStateChange = () => {
              if (waiting.state === 'redundant') {
                cleanup();
                reject(new Error('Staged service worker failed to activate.'));
              }
            };

            const cleanup = () => {
              clearTimeout(timer);
              navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
              waiting.removeEventListener('statechange', onStateChange);
            };

            navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
            waiting.addEventListener('statechange', onStateChange);
            waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
          });
          window.location.reload();
        } finally {
          activating = false;
        }
      },
    });
  };

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    if (registration.waiting && navigator.serviceWorker.controller) {
      notifyWaiting(registration.waiting);
    }

    if (!wiredRegistrations.has(registration)) {
      wiredRegistrations.add(registration);
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) {
          return;
        }
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            notifyWaiting(installing);
          }
        });
      });
    }

    if (!navigator.serviceWorker.controller) {
      await waitForController(4000);
    } else {
      // Proactively check for a newer stamped sw.js when returning to an already-controlled tab
      void registration.update().catch(() => {});
    }
    return registration;
  } catch {
    return null;
  }
}

export function createBrowserReadinessProbes(persistence: PersistenceSeam): ReadinessProbes {
  return {
    runStorageDiagnostic: () => persistence.runDiagnosticProbe(),
    inspectRoot: () => persistence.inspectRoot(),

    async estimateCapacity() {
      if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
        return {
          supported: false,
          reason: 'Browser does not expose StorageManager.estimate() capacity information.',
        };
      }
      try {
        const estimate = await navigator.storage.estimate();
        if (typeof estimate.quota !== 'number' || typeof estimate.usage !== 'number') {
          return {
            supported: false,
            reason: 'Browser returned incomplete storage quota/usage figures.',
          };
        }
        return {
          supported: true,
          quotaBytes: estimate.quota,
          usageBytes: estimate.usage,
        };
      } catch (error) {
        return {
          supported: false,
          reason: error instanceof Error ? error.message : 'Unable to estimate storage capacity.',
        };
      }
    },

    async checkServiceWorkerControl() {
      if (!('serviceWorker' in navigator)) {
        return {
          controlled: false,
          reason: 'Service workers are not supported in this context.',
        };
      }
      const controller = navigator.serviceWorker.controller ?? (await waitForController(3000));
      if (!controller) {
        return {
          controlled: false,
          reason: 'The versioned service worker is not controlling this page.',
        };
      }
      try {
        const status = await postSwMessage<
          { controlled: true; releaseId: string } | { controlled: false; reason: string }
        >(controller, { type: 'GET_STATUS' }, 5000);
        return status;
      } catch (error) {
        return {
          controlled: false,
          reason: error instanceof Error ? error.message : 'Service worker did not respond.',
        };
      }
    },

    async verifyOfflineInventory(): Promise<InventoryVerificationResult> {
      if (!('serviceWorker' in navigator)) {
        return {
          valid: false,
          reason: 'Service workers are not supported in this context.',
        };
      }
      const controller = navigator.serviceWorker.controller ?? (await waitForController(3000));
      if (!controller) {
        return {
          valid: false,
          reason:
            'No controlling service worker is available to verify the offline release inventory.',
        };
      }
      try {
        return await postSwMessage<InventoryVerificationResult>(
          controller,
          { type: 'VERIFY_INVENTORY' },
          15_000,
        );
      } catch (error) {
        return {
          valid: false,
          reason:
            error instanceof Error ? error.message : 'Offline release inventory check failed.',
        };
      }
    },

    async checkStorageProtection(): Promise<StorageProtectionStatus> {
      if (!navigator.storage || typeof navigator.storage.persisted !== 'function') {
        return {
          state: 'Unavailable',
          reason: 'Browser does not expose StorageManager.persisted().',
        };
      }
      try {
        const persisted = await navigator.storage.persisted();
        if (persisted) {
          return { state: 'Protected' };
        }
        return {
          state: 'BestEffort',
          reason: 'Storage is currently best-effort; the browser may evict data under pressure.',
        };
      } catch (error) {
        return {
          state: 'Unavailable',
          reason:
            error instanceof Error ? error.message : 'Unable to query browser storage persistence.',
        };
      }
    },
  };
}

export async function requestBrowserPersistentStorage(): Promise<StorageProtectionStatus> {
  if (!navigator.storage || typeof navigator.storage.persist !== 'function') {
    return {
      state: 'Unavailable',
      reason: 'Browser does not support requesting persistent storage.',
    };
  }
  try {
    const granted = await navigator.storage.persist();
    if (granted) {
      return { state: 'Protected' };
    }
    return {
      state: 'BestEffort',
      reason: 'Browser declined persistent storage; storage remains best-effort.',
    };
  } catch (error) {
    return {
      state: 'Unavailable',
      reason: error instanceof Error ? error.message : 'Failed to request persistent storage.',
    };
  }
}
