// NodeTestHost: the disclosed Node substitute for the browser host (D1 breakdown, section 6.0).
// It reports Runtime Readiness inputs in memory and can be told to fail any of the four checks.
import type { DownloadPort, FileSelectionPort, HostPort } from '../../src/delivery/host.ts';
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
  // The download capture port (D8 T8.23): records each offered file's name, type and bytes.
  readonly downloads: {
    readonly port: DownloadPort;
    readonly offered: readonly CapturedDownload[];
  };
  // The file supply port: returns a File built from the bytes a test sets, or a read failure.
  readonly files: {
    readonly port: FileSelectionPort;
    // The next choose() returns a File with these bytes; every later one too, until set again.
    supply(bytes: Uint8Array, fileName?: string): void;
    // The next choose() returns a File whose every read rejects.
    supplyReadFailure(fileName?: string): void;
    // The next choose() returns Cancelled.
    cancel(): void;
  };
}

export interface CapturedDownload {
  readonly fileName: string;
  readonly type: string;
  readonly bytes: Uint8Array;
}

// A File that exists but cannot be read, as when the trader's file vanished after choosing it.
function unreadableFile(fileName: string): File {
  const file = new File([], fileName);
  const fail = () => Promise.reject(new DOMException('injected read failure', 'NotReadableError'));
  Object.defineProperties(file, {
    arrayBuffer: { value: fail },
    text: { value: fail },
    bytes: { value: fail },
    stream: {
      value: () =>
        new ReadableStream({
          pull: (controller) => controller.error(new DOMException('injected read failure', 'NotReadableError')),
        }),
    },
    slice: { value: () => unreadableFile(fileName) },
  });
  return file;
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
  const offered: CapturedDownload[] = [];
  const downloads = {
    port: {
      async offer(file) {
        offered.push({ fileName: file.fileName, type: file.type, bytes: new Uint8Array(await file.blob.arrayBuffer()) });
        return { kind: 'Offered' };
      },
    } satisfies DownloadPort,
    offered,
  };
  let next: () => Awaited<ReturnType<FileSelectionPort['choose']>> = () => ({ kind: 'Cancelled' });
  const files = {
    port: { choose: () => Promise.resolve(next()) } satisfies FileSelectionPort,
    supply(bytes: Uint8Array, fileName = 'backup.tjbackup') {
      next = () => ({ kind: 'Chosen', file: new File([bytes as BlobPart], fileName) });
    },
    supplyReadFailure(fileName = 'backup.tjbackup') {
      next = () => ({ kind: 'Chosen', file: unreadableFile(fileName) });
    },
    cancel() {
      next = () => ({ kind: 'Cancelled' });
    },
  };
  return {
    host,
    downloads,
    files,
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
