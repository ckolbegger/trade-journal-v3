import type { IDBPDatabase, IDBPObjectStore } from 'idb';
import type { RuntimeNotWritable } from '../delivery/runtime-not-writable.ts';
import { deleteDatabase, openDatabase } from './idb.ts';
import { rebuildPrivateState } from './rebuild.ts';
import type { RecordSource } from './record-source.ts';
import {
  keyOf,
  POINTER_KEY,
  PRIVATE_STORES,
  WORKSPACE_KEY_PATHS,
  ROOT_DATABASE,
  ROOT_VERSION,
  SCHEMA_VERSION,
  upgradeRoot,
  upgradeWorkspace,
  WORKSPACE_PREFIX,
  WORKSPACE_VERSION,
  type SessionPolicyIdentity,
  type WorkspaceStore,
} from './schema.ts';

export interface IdGenerator {
  next(): string;
}

// The session's Runtime Readiness as the persistence boundary sees it: null when Writable,
// otherwise the refusal. `current` is synchronous; `recheck` reruns readiness.
export interface WriteGate {
  current(): RuntimeNotWritable | null;
  recheck(): Promise<RuntimeNotWritable | null>;
}

export interface PersistenceDeps {
  readonly indexedDB: IDBFactory;
  readonly ids: IdGenerator;
  readonly writeGate: WriteGate;
  // The release's session-policy identity, recorded in a new Workspace's meta (D4 A38).
  readonly sessionPolicy: SessionPolicyIdentity;
}

// A superseded session never writes, even if a rerun of readiness happens to pass.
const SUPERSEDED: RuntimeNotWritable = {
  kind: 'RuntimeNotWritable',
  runtimeReadiness: 'RecoveryOnly',
  failedChecks: [{ check: 'control', reason: 'SessionSuperseded' }],
  workspaceStatus: 'RecoveryOnly',
  safeActions: [{ action: 'Reload', explanation: 'Updated in another tab: reload when ready.' }],
};

export type RootInspection =
  | { readonly kind: 'NoWorkspace'; readonly deletedOrphans: readonly string[] }
  | { readonly kind: 'Unreadable'; readonly root: 'PossibleRoot' | 'KnownRoot' }
  | {
      readonly kind: 'Invalid';
      readonly databaseName: string;
      readonly reason: 'MissingMeta' | 'UnknownSchemaVersion' | 'UnsupportedNewerSchema';
    }
  // A Workspace at an earlier schema this release migrates from (D2 A30): never read until migrated.
  | { readonly kind: 'OlderSchema'; readonly databaseName: string; readonly schemaVersion: number }
  | {
      readonly kind: 'KnownWorkspace';
      readonly databaseName: string;
      readonly schemaVersion: number;
      readonly deletedOrphans: readonly string[];
    };

// Opaque binding to one full Workspace content revision, naming the database so that no
// binding from before a Restore can match one taken after it (D8 A127).
export interface WorkspaceSnapshotBinding {
  readonly databaseName: string;
  readonly contentRevision: number;
}

export interface DatabaseDescription {
  readonly databaseName: string;
  readonly contentRevision: number;
  readonly counts: Readonly<Record<string, number>>;
}

export interface StoreRecord {
  readonly store: WorkspaceStore;
  readonly value: Record<string, unknown>;
}

// A pure per-record transform from one schema's authoritative record to the next one's.
export type RecordTransform = (record: StoreRecord) => StoreRecord;

export type CreateWorkspaceResult =
  | RuntimeNotWritable
  | { readonly kind: 'Created'; readonly databaseName: string; readonly binding: WorkspaceSnapshotBinding }
  | { readonly kind: 'AlreadyInitialized'; readonly databaseName: string };

export type Write =
  | { readonly op: 'put' | 'add'; readonly store: WorkspaceStore; readonly value: Record<string, unknown> }
  | { readonly op: 'delete'; readonly store: WorkspaceStore; readonly key: IDBValidKey }
  // Adds one to a numeric field of a meta record, read inside the commit transaction.
  | { readonly op: 'increment'; readonly store: 'meta'; readonly key: string; readonly field: string };

// Rechecked inside the commit transaction: `verify` receives the stored record and must
// answer synchronously.
export interface BindingCheck {
  readonly name: string;
  readonly store: WorkspaceStore;
  readonly key: IDBValidKey;
  readonly verify: (current: Record<string, unknown> | undefined) => boolean;
}

// Every record written by a commit carries the content revision it was written at.
export interface RecordRevision {
  readonly store: WorkspaceStore;
  readonly key: IDBValidKey;
  readonly revision: number;
}

export interface WriteSet {
  readonly checks: readonly BindingCheck[];
  readonly writes: readonly Write[];
}

export type CommitResult =
  | RuntimeNotWritable
  | {
      readonly kind: 'Committed';
      readonly binding: WorkspaceSnapshotBinding;
      readonly revisions: readonly RecordRevision[];
    }
  | { readonly kind: 'Conflict'; readonly binding: string }
  | { readonly kind: 'ConstraintViolation'; readonly store: WorkspaceStore }
  // A check that awaits anything but its own transaction's requests would let IndexedDB
  // auto-commit early; it is refused before any write.
  | { readonly kind: 'EarlyAutoCommitGuard'; readonly binding: string };

// Reads available inside one snapshot; only this transaction's own requests may be awaited.
export interface ReadTransaction {
  get(store: WorkspaceStore, key: IDBValidKey): Promise<Record<string, unknown> | undefined>;
  getAll(store: WorkspaceStore): Promise<Record<string, unknown>[]>;
  // `count` bounds the one index request, as a page read needs.
  getAllFromIndex(store: WorkspaceStore, index: string, query: IDBValidKey | IDBKeyRange, count?: number): Promise<Record<string, unknown>[]>;
}

export interface Snapshot<T> {
  readonly value: T;
  readonly binding: WorkspaceSnapshotBinding;
}

export interface Persistence {
  inspectRoot(): Promise<RootInspection>;
  // Creates a Workspace holding the initial records, then makes it visible with one pointer write.
  createWorkspace(initialRecords: readonly StoreRecord[]): Promise<CreateWorkspaceResult>;
  // Names a new candidate Workspace database in the root, then creates it empty at the current
  // schema version. Nothing reads it until activation (D2 A30).
  createCandidate(): Promise<{ readonly databaseName: string }>;
  // Bumps the source database's IndexedDB version, closing every other connection to it, then
  // copies its authoritative stores in one readonly snapshot through `transform` into the
  // candidate. Private stores are never copied: the private rebuild produces them (D2 A30, A139).
  // Returns how many records of each store were copied.
  copySnapshot(source: string, candidate: string, transform: RecordTransform): Promise<{ readonly counts: Readonly<Record<string, number>> }>;
  // The candidate's records, store by store in bounded batches, for the section validators.
  candidateSource(candidate: string): RecordSource;
  // Writes records into the candidate (seed additions, repairs) at its content revision 1.
  putCandidateRecords(candidate: string, records: readonly StoreRecord[]): Promise<void>;
  // Produces the candidate's private fields, stores, and indexes from its authoritative records.
  rebuildCandidate(candidate: string): Promise<void>;
  // In one root transaction: points the root at the candidate, removes its candidate entry, and
  // lists the database it replaces as retired (D2 A30). `inFlip` runs inside that transaction
  // after its writes; a throw aborts it. Aborted: the pointer still names `retired`.
  activateCandidate(candidate: string, retired: string, inFlip?: () => void): Promise<{ readonly kind: 'Activated' | 'Aborted' }>;
  // A database's content revision and record count per store, read without changing it.
  describeDatabase(databaseName: string): Promise<DatabaseDescription>;
  // Deletes every listed candidate and retired database the pointer does not name. Only a holder
  // of the lifecycle lock calls it while the pointer names an older schema, since another tab may
  // be copying into a listed candidate (D2 A30).
  discardAbandoned(): Promise<readonly string[]>;
  // Deletes the candidate and its entry; the database it was copied from and the pointer are
  // untouched.
  discardCandidate(candidate: string): Promise<void>;
  // Applies one semantic command's complete write set atomically, or nothing.
  commit(writeSet: WriteSet): Promise<CommitResult>;
  // Reads several stores in one readonly transaction bound to one content revision.
  readSnapshot<T>(stores: readonly WorkspaceStore[], read: (tx: ReadTransaction) => Promise<T>): Promise<Snapshot<T>>;
  // True once another connection asked to change the Workspace database's version, for
  // example a later release migrating it: this session may no longer write.
  isSuperseded(): boolean;
  // Closes the Workspace connection, as when the page goes away; a later call reopens it.
  close(): void;
}

interface PointerRecord {
  readonly key: typeof POINTER_KEY;
  readonly databaseName: string;
}

// Root records beside the pointer, in the same store (D2 A30): candidates named before they are
// created, and databases retired by an activation and not yet deleted.
const CANDIDATES_KEY = 'candidates';
const RETIRED_KEY = 'retired';

interface NameListRecord {
  readonly key: typeof CANDIDATES_KEY | typeof RETIRED_KEY;
  readonly databaseNames: readonly string[];
}

// Records per batch when a validator reads a candidate (D8 A140).
const CANDIDATE_BATCH_SIZE = 500;

// Meta records owned by persistence, never copied between Workspace databases.
const PERSISTENCE_META_KEYS: ReadonlySet<string> = new Set(['schema', 'content']);

function isAuthoritative(store: string): store is WorkspaceStore {
  return store in WORKSPACE_KEY_PATHS && !PRIVATE_STORES.has(store as WorkspaceStore);
}

// Creates a Workspace database's stores and indexes at the current schema version, at content
// revision 1.
function initializeWorkspace(sessionPolicy: SessionPolicyIdentity) {
  return (db: IDBDatabase, oldVersion: number, tx: IDBTransaction): void => {
    upgradeWorkspace(db, oldVersion);
    const meta = tx.objectStore('meta');
    meta.put({ key: 'schema', schemaVersion: SCHEMA_VERSION });
    meta.put({ key: 'content', contentRevision: 1 });
    // Nested, since a record's own top-level `revision` is the persistence write stamp.
    meta.put({ key: 'sessionPolicy', policy: sessionPolicy });
    meta.put({ key: 'marketDataRevision', marketDataRevision: 0 });
  };
}

interface SchemaRecord {
  readonly key: 'schema';
  readonly schemaVersion: number;
}

interface ContentRecord {
  readonly key: 'content';
  readonly contentRevision: number;
}

export function createPersistence(deps: PersistenceDeps): Persistence {
  let current: string | undefined;
  let connection: Promise<IDBPDatabase> | undefined;
  let superseded = false;

  function workspace(): Promise<IDBPDatabase> {
    if (!current) throw new Error('No Workspace is open');
    connection ??= openDatabase(deps.indexedDB, current, undefined).then((db) => {
      db.addEventListener('versionchange', () => {
        db.close();
        superseded = true;
      });
      return db;
    });
    return connection;
  }

  // Closes this session's own Workspace connection without marking the session superseded.
  async function closeOwnConnection(): Promise<void> {
    const own = connection;
    connection = undefined;
    (await own)?.close();
  }

  // Runs one root readwrite transaction over the pointer store, which also holds the name lists.
  async function inRoot<T>(work: (store: IDBPObjectStore<unknown, ['pointer'], 'pointer', 'readwrite'>) => Promise<T>): Promise<T> {
    const root = await openDatabase(deps.indexedDB, ROOT_DATABASE, ROOT_VERSION, upgradeRoot);
    try {
      const tx = root.transaction('pointer', 'readwrite', { durability: 'strict' });
      let result: T;
      try {
        result = await work(tx.store);
      } catch (error) {
        // Writes already issued must not commit.
        try {
          tx.abort();
        } catch {
          // Already aborted by the failed request.
        }
        await tx.done.catch(() => undefined);
        throw error;
      }
      await tx.done;
      return result;
    } finally {
      root.close();
    }
  }

  async function listed(store: IDBPObjectStore<unknown, ['pointer'], 'pointer', 'readwrite'>, key: NameListRecord['key']) {
    return ((await store.get(key)) as NameListRecord | undefined)?.databaseNames ?? [];
  }

  // Deletes every retired database and every listed candidate the pointer does not name, then
  // removes each from its list, so an interrupted deletion is retried by the next call.
  async function deleteListed(pointer: string): Promise<string[]> {
    const deleted: string[] = [];
    for (const key of [RETIRED_KEY, CANDIDATES_KEY] as const) {
      const names = (await inRoot((store) => listed(store, key))).filter((name) => name !== pointer);
      if (names.length === 0) continue;
      for (const name of names) await deleteDatabase(deps.indexedDB, name);
      await inRoot(async (store) => {
        await store.put({ key, databaseNames: (await listed(store, key)).filter((n) => !names.includes(n)) });
      });
      deleted.push(...names);
    }
    return deleted;
  }

  // Puts records into a database that nothing reads yet, at content revision 1, in one transaction.
  async function putRecords(databaseName: string, records: readonly StoreRecord[]): Promise<void> {
    if (records.length === 0) return;
    const db = await openDatabase(deps.indexedDB, databaseName, undefined);
    try {
      const tx = db.transaction([...new Set(records.map((r) => r.store))], 'readwrite', { durability: 'strict' });
      for (const { store, value } of records) void tx.objectStore(store).put({ ...value, revision: 1 });
      await tx.done;
    } finally {
      db.close();
    }
  }

  return {
    isSuperseded: () => superseded,

    close() {
      const closing = connection;
      connection = undefined;
      void closing?.then((db) => db.close());
    },

    async readSnapshot(stores, read) {
      const db = await workspace();
      const tx = db.transaction([...new Set<WorkspaceStore>(['meta', ...stores])], 'readonly');
      const content = (await tx.objectStore('meta').get('content')) as ContentRecord;
      const value = await read({
        get: async (store, key) => (await tx.objectStore(store).get(key)) as Record<string, unknown> | undefined,
        getAll: async (store) => (await tx.objectStore(store).getAll()) as Record<string, unknown>[],
        getAllFromIndex: async (store, index, query, count) =>
          (await tx.objectStore(store).index(index).getAll(query, count)) as Record<string, unknown>[],
      });
      await tx.done;
      return { value, binding: { databaseName: db.name, contentRevision: content.contentRevision } };
    },

    async commit(writeSet) {
      if (superseded) {
        // A superseded session never writes, and its refusal always says why.
        const refusal = (await deps.writeGate.recheck()) ?? SUPERSEDED;
        return refusal === SUPERSEDED ? refusal : { ...refusal, failedChecks: [...refusal.failedChecks, ...SUPERSEDED.failedChecks] };
      }
      // Outside Writable, refuse before any write transaction is opened.
      const refusal = deps.writeGate.current();
      if (refusal) return refusal;
      const db = await workspace();
      const stores = [
        ...new Set<WorkspaceStore>(['meta', ...writeSet.checks.map((c) => c.store), ...writeSet.writes.map((w) => w.store)]),
      ];
      const tx = db.transaction(stores, 'readwrite', { durability: 'strict' });
      const [content, ...currents] = (await Promise.all([
        tx.objectStore('meta').get('content'),
        ...writeSet.checks.map((c) => tx.objectStore(c.store).get(c.key)),
      ])) as [ContentRecord, ...(Record<string, unknown> | undefined)[]];
      for (const [i, check] of writeSet.checks.entries()) {
        const verdict: unknown = check.verify(currents[i]);
        if (verdict === true) continue;
        tx.abort();
        await tx.done.catch(() => undefined);
        return verdict === false
          ? { kind: 'Conflict', binding: check.name }
          : { kind: 'EarlyAutoCommitGuard', binding: check.name };
      }
      const contentRevision = content.contentRevision + 1;
      let violation: WorkspaceStore | undefined;
      const revisions: RecordRevision[] = [];
      for (const write of writeSet.writes) {
        const store = tx.objectStore(write.store);
        let request: Promise<unknown>;
        if (write.op === 'delete') {
          request = store.delete(write.key);
        } else if (write.op === 'increment') {
          const record = (await store.get(write.key)) as Record<string, number>;
          request = store.put({ ...record, [write.field]: record[write.field]! + 1 });
        } else {
          const value: Record<string, unknown> = { ...write.value, revision: contentRevision };
          request = write.op === 'add' ? store.add(value) : store.put(value);
          revisions.push({ store: write.store, key: keyOf(write.store, value), revision: contentRevision });
        }
        request.catch((error: unknown) => {
          if (error instanceof Error && error.name === 'ConstraintError') violation ??= write.store;
        });
      }
      tx.objectStore('meta').put({ key: 'content', contentRevision }).catch(() => undefined);
      try {
        await tx.done;
      } catch (error) {
        if (violation) return { kind: 'ConstraintViolation', store: violation };
        throw error;
      }
      return { kind: 'Committed', binding: { databaseName: db.name, contentRevision }, revisions };
    },

    async createCandidate() {
      const databaseName = `${WORKSPACE_PREFIX}${deps.ids.next()}`;
      // Listed first, so a candidate interrupted at any later point is known and cleaned up.
      await inRoot(async (store) => {
        await store.put({ key: CANDIDATES_KEY, databaseNames: [...(await listed(store, CANDIDATES_KEY)), databaseName] });
      });
      const candidate = await openDatabase(deps.indexedDB, databaseName, WORKSPACE_VERSION, initializeWorkspace(deps.sessionPolicy));
      candidate.close();
      return { databaseName };
    },

    async activateCandidate(candidate, retired, inFlip) {
      try {
        await inRoot(async (store) => {
          const [candidates, retiredNames] = await Promise.all([listed(store, CANDIDATES_KEY), listed(store, RETIRED_KEY)]);
          await Promise.all([
            store.put({ key: POINTER_KEY, databaseName: candidate }),
            store.put({ key: CANDIDATES_KEY, databaseNames: candidates.filter((n) => n !== candidate) }),
            store.put({ key: RETIRED_KEY, databaseNames: [...retiredNames, retired] }),
          ]);
          inFlip?.();
        });
      } catch {
        return { kind: 'Aborted' };
      }
      await closeOwnConnection();
      current = candidate;
      await deleteListed(candidate);
      return { kind: 'Activated' };
    },

    async discardCandidate(candidate) {
      await deleteDatabase(deps.indexedDB, candidate);
      await inRoot(async (store) => {
        await store.put({ key: CANDIDATES_KEY, databaseNames: (await listed(store, CANDIDATES_KEY)).filter((n) => n !== candidate) });
      });
    },

    async copySnapshot(source, candidate, transform) {
      await closeOwnConnection();
      // Opening at a higher version, with no store changes, makes every other connection close
      // (D1's versionchange handling) before the snapshot is taken (the D1 amendment).
      const probe = await openDatabase(deps.indexedDB, source, undefined);
      const version = probe.version;
      probe.close();
      const bumped = await openDatabase(deps.indexedDB, source, version + 1);
      let records: StoreRecord[];
      try {
        const stores = Array.from(bumped.objectStoreNames).filter(isAuthoritative);
        const tx = bumped.transaction(stores, 'readonly');
        const all = await Promise.all(stores.map((store) => tx.objectStore(store).getAll()));
        await tx.done;
        records = stores.flatMap((store, i) =>
          (all[i] as Record<string, unknown>[])
            .filter((value) => !(store === 'meta' && PERSISTENCE_META_KEYS.has(value['key'] as string)))
            .map((stamped) => {
              // The persistence write stamp is not an authoritative field.
              const value = { ...stamped };
              delete value['revision'];
              return { store, value };
            }),
        );
      } finally {
        bumped.close();
      }
      // The candidate already holds its own schema version and content revision.
      const copied = records.map(transform);
      await putRecords(candidate, copied);
      const counts: Record<string, number> = {};
      for (const { store } of copied) counts[store] = (counts[store] ?? 0) + 1;
      return { counts };
    },

    candidateSource(candidate) {
      return {
        async *batches(store) {
          const db = await openDatabase(deps.indexedDB, candidate, undefined);
          try {
            let after: IDBValidKey | undefined;
            for (;;) {
              const range = after === undefined ? undefined : IDBKeyRange.lowerBound(after, true);
              const batch = (await db.getAll(store, range, CANDIDATE_BATCH_SIZE)) as Record<string, unknown>[];
              if (batch.length === 0) return;
              yield batch;
              after = keyOf(store, batch[batch.length - 1]!);
            }
          } finally {
            db.close();
          }
        },
      };
    },

    putCandidateRecords: (candidate, records) => putRecords(candidate, records),

    async describeDatabase(databaseName) {
      const db = await openDatabase(deps.indexedDB, databaseName, undefined);
      try {
        const stores = Array.from(db.objectStoreNames);
        const tx = db.transaction(stores, 'readonly');
        const [content, ...sizes] = await Promise.all([
          tx.objectStore('meta').get('content') as Promise<ContentRecord>,
          ...stores.map((store) => tx.objectStore(store).count()),
        ]);
        await tx.done;
        return { databaseName, contentRevision: content.contentRevision, counts: Object.fromEntries(stores.map((store, i) => [store, sizes[i]!])) };
      } finally {
        db.close();
      }
    },

    async discardAbandoned() {
      const pointer = (await inRoot((store) => store.get(POINTER_KEY))) as PointerRecord | undefined;
      return deleteListed(pointer?.databaseName ?? '');
    },

    rebuildCandidate: (candidate) => rebuildPrivateState(deps.indexedDB, candidate),

    async createWorkspace(initialRecords) {
      const refusal = deps.writeGate.current();
      if (refusal) return refusal;
      const databaseName = `${WORKSPACE_PREFIX}${deps.ids.next()}`;
      const workspace = await openDatabase(deps.indexedDB, databaseName, WORKSPACE_VERSION, (db, oldVersion, tx) => {
        initializeWorkspace(deps.sessionPolicy)(db, oldVersion, tx);
        for (const { store, value } of initialRecords) tx.objectStore(store).put({ ...value, revision: 1 });
      });
      workspace.close();
      const root = await openDatabase(deps.indexedDB, ROOT_DATABASE, ROOT_VERSION, upgradeRoot);
      try {
        // `add` fails if another initializer already wrote the pointer (D1 A12).
        await root.add('pointer', { key: POINTER_KEY, databaseName });
      } catch (error) {
        if (!(error instanceof Error && error.name === 'ConstraintError')) throw error;
        const existing = (await root.get('pointer', POINTER_KEY)) as PointerRecord;
        root.close();
        await deleteDatabase(deps.indexedDB, databaseName);
        return { kind: 'AlreadyInitialized', databaseName: existing.databaseName };
      }
      root.close();
      current = databaseName;
      return { kind: 'Created', databaseName, binding: { databaseName, contentRevision: 1 } };
    },

    async inspectRoot() {
      let root;
      try {
        root = await openDatabase(deps.indexedDB, ROOT_DATABASE, ROOT_VERSION, upgradeRoot);
      } catch (error) {
        // A root at a newer version may hold a Workspace this release cannot read; never touch it.
        if (error instanceof Error && error.name === 'VersionError') return { kind: 'Unreadable', root: 'PossibleRoot' };
        throw error;
      }
      let pointer: PointerRecord | undefined;
      try {
        pointer = (await root.get('pointer', POINTER_KEY)) as PointerRecord | undefined;
      } finally {
        root.close();
      }
      if (!pointer) return { kind: 'NoWorkspace', deletedOrphans: [] };
      let workspace;
      try {
        // A database that does not exist would be created empty; abort that upgrade instead.
        workspace = await openDatabase(deps.indexedDB, pointer.databaseName, undefined, (_db, oldVersion, tx) => {
          if (oldVersion === 0) tx.abort();
        });
      } catch {
        return { kind: 'Unreadable', root: 'KnownRoot' };
      }
      try {
        let schema: SchemaRecord | undefined;
        try {
          schema = (await workspace.get('meta', 'schema')) as SchemaRecord | undefined;
        } catch {
          schema = undefined;
        }
        if (!schema) return { kind: 'Invalid', databaseName: pointer.databaseName, reason: 'MissingMeta' };
        const version = schema.schemaVersion;
        if (Number.isInteger(version) && version >= 1 && version < SCHEMA_VERSION) {
          return { kind: 'OlderSchema', databaseName: pointer.databaseName, schemaVersion: version };
        }
        if (Number.isInteger(version) && version > SCHEMA_VERSION) {
          return { kind: 'Invalid', databaseName: pointer.databaseName, reason: 'UnsupportedNewerSchema' };
        }
        if (version !== SCHEMA_VERSION) {
          return { kind: 'Invalid', databaseName: pointer.databaseName, reason: 'UnknownSchemaVersion' };
        }
      } finally {
        workspace.close();
      }
      // Only once the pointer names a valid Workspace is any other Workspace-prefixed database
      // known to be an orphan: a leftover candidate, or a concurrent first run that lost.
      const deletedOrphans = await deleteListed(pointer.databaseName);
      for (const { name } of await deps.indexedDB.databases()) {
        if (name?.startsWith(WORKSPACE_PREFIX) && name !== pointer.databaseName) {
          await deleteDatabase(deps.indexedDB, name);
          deletedOrphans.push(name);
        }
      }
      current = pointer.databaseName;
      return {
        kind: 'KnownWorkspace',
        databaseName: pointer.databaseName,
        schemaVersion: SCHEMA_VERSION,
        deletedOrphans,
      };
    },
  };
}
