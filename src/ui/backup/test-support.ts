// Test doubles for the Backup page and Restore flow (D8 T8.23): a facade whose every result a test
// configures, and a file selection port a test controls.
import type { FileSelectionPort } from '../../app/types.ts';
import type { BackupFacade } from './facade.ts';

type Operation = keyof BackupFacade;
type Result<K extends Operation> = Awaited<ReturnType<BackupFacade[K]>>;
type Request<K extends Operation> = Parameters<BackupFacade[K]>[0];
// A fixed result, or a function of the request (it may return a promise the test resolves later).
type Responder<K extends Operation> = Result<K> | ((request: Request<K>) => Result<K> | Promise<Result<K>>);

export interface BackupFacadeDouble {
  readonly facade: BackupFacade;
  // Sets what the operation returns from now on, for every call.
  respond<K extends Operation>(operation: K, responder: Responder<K>): void;
  // The requests each operation received, in order.
  readonly calls: { readonly [K in Operation]: Request<K>[] };
}

export function createBackupFacadeDouble(): BackupFacadeDouble {
  const responders: { [K in Operation]?: Responder<K> } = {};
  const calls: { [K in Operation]: Request<K>[] } = { exportBackup: [], confirmBackup: [], prepareRestore: [], applyPreparedRestore: [] };
  const operation =
    <K extends Operation>(name: K) =>
    (request: Request<K>): Promise<Result<K>> => {
      calls[name].push(request);
      const responder = responders[name] as Responder<K> | undefined;
      if (responder === undefined) return Promise.reject(new Error(`No result configured for ${name}`));
      return Promise.resolve(typeof responder === 'function' ? responder(request) : responder);
    };
  const facade: BackupFacade = {
    exportBackup: operation('exportBackup'),
    confirmBackup: operation('confirmBackup'),
    prepareRestore: operation('prepareRestore'),
    applyPreparedRestore: operation('applyPreparedRestore'),
  };
  return {
    facade,
    respond(name, responder) {
      (responders as Record<Operation, unknown>)[name] = responder;
    },
    calls,
  };
}

export interface FileSelectionDouble {
  readonly port: FileSelectionPort;
  // How many times the page asked the trader to choose a file.
  readonly requests: () => number;
  // What the next choose() returns, until set again.
  choose(file: File): void;
  cancel(): void;
}

export function createFileSelectionDouble(): FileSelectionDouble {
  let next: Awaited<ReturnType<FileSelectionPort['choose']>> = { kind: 'Cancelled' };
  let requests = 0;
  return {
    port: {
      choose() {
        requests += 1;
        return Promise.resolve(next);
      },
    },
    requests: () => requests,
    choose(file) {
      next = { kind: 'Chosen', file };
    },
    cancel() {
      next = { kind: 'Cancelled' };
    },
  };
}
