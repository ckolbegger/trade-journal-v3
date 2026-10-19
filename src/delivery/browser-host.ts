import type { HostPort } from './host.ts';

const FIRST_CLAIM_WAIT_MS = 10_000;

// The page's controlling service worker reports its release identity over a MessageChannel.
function askRelease(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(null), FIRST_CLAIM_WAIT_MS);
    channel.port1.onmessage = (event: MessageEvent<{ releaseId?: string }>) => {
      clearTimeout(timer);
      resolve(event.data.releaseId ?? null);
    };
    worker.postMessage({ type: 'ReleaseIdentity' }, [channel.port2]);
  });
}

// Waits for the first release to claim this page, which it does at its first activation.
function controller(): Promise<ServiceWorker | null> {
  const container = navigator.serviceWorker;
  if (container.controller) return Promise.resolve(container.controller);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(container.controller), FIRST_CLAIM_WAIT_MS);
    container.addEventListener(
      'controllerchange',
      () => {
        clearTimeout(timer);
        resolve(container.controller);
      },
      { once: true },
    );
  });
}

// The real browser host: functional capabilities only, never browser or OS identity.
export function browserHost(): HostPort {
  const storage = navigator.storage as StorageManager | undefined;
  return {
    indexedDB: window.indexedDB,
    caches: window.caches,
    estimate: storage?.estimate ? () => storage.estimate() : undefined,
    persisted: storage?.persisted ? () => storage.persisted() : undefined,
    persist: storage?.persist ? () => storage.persist() : undefined,
    controllerRelease: async () => {
      if (!('serviceWorker' in navigator)) return null;
      const worker = await controller();
      return worker ? askRelease(worker) : null;
    },
  };
}
