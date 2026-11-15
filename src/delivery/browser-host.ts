import type { ExportPort } from '../coordinators/workspace/backup-export.ts';
import type { WorkerExportMessage } from '../workers/backup-export.ts';
import type { DownloadPort, FileSelectionPort, HostPort } from './host.ts';

// A browser keeps an object URL for as long as a download might still read it (D8 A128).
const OBJECT_URL_LIFETIME_MS = 60_000;

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

// The export port: each export runs in its own module worker (D8 A128), which is stopped when it
// answers. A worker that cannot start or that fails is a failed read, never a thrown error.
export function browserExportPort(): ExportPort {
  return {
    run: (job) =>
      new Promise((resolve) => {
        const { onProgress, ...plain } = job;
        const failed = (name: string, message: string) => resolve({ kind: 'Failed', reason: 'ReadFailed', detail: { stage: 'Read', name, message } });
        let worker: Worker;
        try {
          worker = new Worker(new URL('../workers/backup-export.ts', import.meta.url), { type: 'module' });
        } catch (error) {
          failed(error instanceof Error ? error.name : 'NonError', error instanceof Error ? error.message : 'The export worker could not start');
          return;
        }
        worker.onmessage = (event: MessageEvent<WorkerExportMessage>) => {
          if (event.data.kind === 'progress') {
            onProgress?.({ done: event.data.done, total: event.data.total });
            return;
          }
          worker.terminate();
          resolve(event.data.run);
        };
        worker.onerror = (event) => {
          worker.terminate();
          failed('WorkerError', event.message || 'The export worker failed');
        };
        worker.postMessage(plain);
      }),
  };
}

// The download port: one file offered through an object URL and a download anchor (D8 A128). The
// browser cannot say whether or where the trader saved it, so success is only Offered.
export function browserDownload(): DownloadPort {
  return {
    offer(file) {
      try {
        const url = URL.createObjectURL(file.blob.slice(0, file.blob.size, file.type));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.fileName;
        anchor.hidden = true;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
        return Promise.resolve({ kind: 'Offered' });
      } catch (error) {
        return Promise.resolve({ kind: 'Failed', reason: error instanceof Error ? error.message : 'The browser did not accept the download' });
      }
    },
  };
}

// The file-selection port: the browser's ordinary file chooser. Called from the click that asks for it,
// so the browser allows the chooser to open.
export function browserFileSelection(): FileSelectionPort {
  return {
    choose: () =>
      new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.hidden = true;
        // Attached while open, so the page keeps the element a browser may otherwise discard.
        document.body.append(input);
        const settle = (result: Awaited<ReturnType<FileSelectionPort['choose']>>) => {
          input.remove();
          resolve(result);
        };
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          settle(file ? { kind: 'Chosen', file } : { kind: 'Cancelled' });
        });
        input.addEventListener('cancel', () => settle({ kind: 'Cancelled' }));
        input.click();
      }),
  };
}
