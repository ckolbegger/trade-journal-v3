import type { IDBPDatabase } from 'idb';
import type { RuntimeNotWritable } from '../delivery/runtime-not-writable.ts';
import { deleteDatabase, openDatabase } from './idb.ts';
import {
  POINTER_KEY,
  WORKSPACE_KEY_PATHS,
  ROOT_DATABASE,
  ROOT_VERSION,
  SCHEMA_VERSION,
  upgradeRoot,
  upgradeWorkspace,
  WORKSPACE_PREFIX,
  WORKSPACE_VERSION,
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
      readonly reason: 'MissingMeta' | 'UnknownSchemaVersion';
    }
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

export interface StoreRecord {
  readonly store: WorkspaceStore;
  readonly value: Record<string, unknown>;
}

export type CreateWorkspaceResult =
  | RuntimeNotWritable
  | { readonly kind: 'Created'; readonly databaseName: string; readonly binding: WorkspaceSnapshotBinding }
  | { readonly kind: 'AlreadyInitialized'; readonly databaseName: string };

export type Write =
  | { readonly op: 'put' | 'add'; readonly store: WorkspaceStore; readonly value: Record<string, unknown> }
  | { readonly op: 'delete'; readonly store: WorkspaceStore; readonly key: IDBValidKey };

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
}

export interface Snapshot<T> {
  readonly value: T;
  readonly binding: WorkspaceSnapshotBinding;
}

export interface Persistence {
  inspectRoot(): Promise<RootInspection>;
  // Creates a Workspace holding the initial records, then makes it visible with one pointer write.
  createWorkspace(initialRecords: readonly StoreRecord[]): Promise<CreateWorkspaceResult>;
  // Applies one semantic command's complete write set atomically, or nothing.
  commit(writeSet: WriteSet): Promise<CommitResult>;
  // Reads several stores in one readonly transaction bound to one content revision.
  readSnapshot<T>(stores: readonly WorkspaceStore[], read: (tx: ReadTransaction) => Promise<T>): Promise<Snapshot<T>>;
  // True once another connection asked to change the Workspace database's version, for
  // example a later release migrating it: this session may no longer write.
  isSuperseded(): boolean;
}

interface PointerRecord {
  readonly key: typeof POINTER_KEY;
  readonly databaseName: string;
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

  return {
    isSuperseded: () => superseded,

    async readSnapshot(stores, read) {
      const db = await workspace();
      const tx = db.transaction([...new Set<WorkspaceStore>(['meta', ...stores])], 'readonly');
      const content = (await tx.objectStore('meta').get('content')) as ContentRecord;
      const value = await read({
        get: async (store, key) => (await tx.objectStore(store).get(key)) as Record<string, unknown> | undefined,
        getAll: async (store) => (await tx.objectStore(store).getAll()) as Record<string, unknown>[],
      });
      await tx.done;
      return { value, binding: { databaseName: db.name, contentRevision: content.contentRevision } };
    },

    async commit(writeSet) {
      if (superseded) return (await deps.writeGate.recheck()) ?? SUPERSEDED;
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
        } else {
          const value: Record<string, unknown> = { ...write.value, revision: contentRevision };
          request = write.op === 'add' ? store.add(value) : store.put(value);
          revisions.push({ store: write.store, key: value[WORKSPACE_KEY_PATHS[write.store]] as IDBValidKey, revision: contentRevision });
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

    async createWorkspace(initialRecords) {
      const refusal = deps.writeGate.current();
      if (refusal) return refusal;
      const databaseName = `${WORKSPACE_PREFIX}${deps.ids.next()}`;
      const workspace = await openDatabase(deps.indexedDB, databaseName, WORKSPACE_VERSION, (db, oldVersion, tx) => {
        upgradeWorkspace(db, oldVersion);
        tx.objectStore('meta').put({ key: 'schema', schemaVersion: SCHEMA_VERSION });
        tx.objectStore('meta').put({ key: 'content', contentRevision: 1 });
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
        if (schema.schemaVersion !== SCHEMA_VERSION) {
          return { kind: 'Invalid', databaseName: pointer.databaseName, reason: 'UnknownSchemaVersion' };
        }
      } finally {
        workspace.close();
      }
      // Only once the pointer names a valid Workspace is any other Workspace-prefixed database
      // known to be an orphan: a leftover candidate, or a concurrent first run that lost.
      const deletedOrphans: string[] = [];
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
