// Disclosed test substitute (D2 section 6.0, T2.21): a request counter around fake-indexeddb.
// It wraps the request-issuing methods of fake-indexeddb's object stores, indexes and cursors so
// each call is logged while a recording is open, then calls the original method with the same
// receiver and arguments and returns its result. It never changes a request, a result, or timing.
import { IDBCursor, IDBIndex, IDBObjectStore } from 'fake-indexeddb';

export interface CountedRequest {
  readonly on: 'store' | 'index' | 'cursor';
  readonly store: string;
  readonly index?: string;
  readonly method: string;
  // The `count` argument of getAll / getAllKeys, when one was passed.
  readonly count?: number;
}

const STORE_METHODS = ['get', 'getKey', 'getAll', 'getAllKeys', 'getAllRecords', 'count', 'openCursor', 'openKeyCursor', 'put', 'add', 'delete', 'clear'];
const INDEX_METHODS = ['get', 'getKey', 'getAll', 'getAllKeys', 'getAllRecords', 'count', 'openCursor', 'openKeyCursor'];
const CURSOR_METHODS = ['continue', 'continuePrimaryKey', 'advance', 'update', 'delete'];

let recording: CountedRequest[] | undefined;

function countOf(args: readonly unknown[]): number | undefined {
  if (typeof args[1] === 'number') return args[1];
  const options = args[0] as { count?: unknown } | undefined;
  return options && typeof options === 'object' && typeof options.count === 'number' ? options.count : undefined;
}

type Describe = (self: unknown, method: string, args: readonly unknown[]) => CountedRequest;

function wrap(prototype: object, methods: readonly string[], describe: Describe) {
  const target = prototype as Record<string, (...args: unknown[]) => unknown>;
  for (const method of methods) {
    const original = target[method]!;
    target[method] = function (this: unknown, ...args: unknown[]) {
      recording?.push(describe(this, method, args));
      return original.apply(this, args);
    };
  }
}

type Store = { name: string };
type Index = { name: string; objectStore: Store };
const sourceOf = (source: Store | Index) =>
  'objectStore' in source ? { store: source.objectStore.name, index: source.name } : { store: source.name };

let installed = false;
function install() {
  if (installed) return;
  installed = true;
  wrap(IDBObjectStore.prototype, STORE_METHODS, (self, method, args) => {
    const count = countOf(args);
    return { on: 'store', store: (self as Store).name, method, ...(method.startsWith('getAll') && count !== undefined && { count }) };
  });
  wrap(IDBIndex.prototype, INDEX_METHODS, (self, method, args) => {
    const index = self as Index;
    const count = countOf(args);
    return { on: 'index', store: index.objectStore.name, index: index.name, method, ...(method.startsWith('getAll') && count !== undefined && { count }) };
  });
  wrap(IDBCursor.prototype, CURSOR_METHODS, (self, method) => ({ on: 'cursor', ...sourceOf((self as { source: Store | Index }).source), method }));
}

// Runs `work` and returns its result with every IndexedDB request it issued, in order.
export async function countRequests<T>(work: () => Promise<T>): Promise<{ result: T; requests: CountedRequest[] }> {
  install();
  if (recording) throw new Error('countRequests does not nest');
  const requests: CountedRequest[] = [];
  recording = requests;
  try {
    return { result: await work(), requests };
  } finally {
    recording = undefined;
  }
}
