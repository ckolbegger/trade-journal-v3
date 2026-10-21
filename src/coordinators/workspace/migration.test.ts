// Migration in Workspace.initialize (D2 T2.10), from the committed schema-1 fixture.
import { readFileSync } from 'node:fs';
import type { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { loadDump, viewsOf, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { createTradeViews } from '../trade-views/index.ts';
import { createWorkspace, type MigrationStageHooks } from './index.ts';

const V1_DUMP = JSON.parse(readFileSync('tests/fixtures/workspace-v1/dump.json', 'utf8')) as WorkspaceDump;
const V1_DATABASE = 'tj-ws-fx-0003';
const V1_VIEWS: unknown = JSON.parse(readFileSync('tests/fixtures/workspace-v1/expected-views.json', 'utf8'));

type MutableDump = {
  databases: Record<string, { version: number; stores: Record<string, { keyPath: string; autoIncrement: boolean; indexes: unknown[]; records: Record<string, unknown>[] }> }>;
};

// A device holding the v1 fixture, optionally edited before the release opens it.
async function v1Stack(edit?: (dump: MutableDump) => void, migrationHooks?: MigrationStageHooks) {
  const dump = structuredClone(V1_DUMP);
  edit?.(dump as unknown as MutableDump);
  const stack = await testStack(await loadDump(dump), dump.asOf);
  const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, migrationHooks });
  return { ...stack, workspace, views: () => viewsOf({ TradeViewsAndReporting: createTradeViews(stack) }) };
}

// Test code edits a stored record directly, outside the application.
async function rawUpdate(factory: IDBFactory, database: string, store: string, key: string, edit: (value: Record<string, unknown>) => unknown) {
  const db = await new Promise<IDBDatabase>((resolve) => {
    const open = factory.open(database);
    open.onsuccess = () => resolve(open.result);
  });
  await new Promise<void>((resolve) => {
    const tx = db.transaction(store, 'readwrite');
    const get = tx.objectStore(store).get(key);
    get.onsuccess = () => tx.objectStore(store).put(edit(get.result as Record<string, unknown>));
    tx.oncomplete = () => resolve();
  });
  db.close();
}

function v1Records(dump: MutableDump, store: string): Record<string, unknown>[] {
  return dump.databases[V1_DATABASE]!.stores[store]!.records;
}

describe('migration from schema 1', () => {
  it('should migrate a v1 Workspace to v2 and return Opened with a receipt naming from and to versions, per-store record counts, seed additions Position Change Reflection and Position Change Source, repairs, and private rebuilds', async () => {
    // One Trade's stored lifecycle disagrees with its coherent facts: migration repairs it (P7).
    // An earlier interrupted attempt left a listed candidate behind: it is deleted (A30).
    const { workspace, factory } = await v1Stack((dump) => {
      v1Records(dump, 'trades')[0]!['lifecycle'] = 'Open';
      dump.databases['tj-root']!.stores['pointer']!.records.push({ key: 'candidates', databaseNames: ['tj-ws-abandoned'] });
      dump.databases['tj-ws-abandoned'] = { version: 1, stores: { meta: { keyPath: 'key', autoIncrement: false, indexes: [], records: [] } } };
    });
    const result = await workspace.initialize({});
    expect(result).toEqual({
      kind: 'Opened',
      status: expect.objectContaining({ kind: 'Ready', schemaVersion: 2 }) as unknown,
      receipt: {
        fresh: false,
        readiness: expect.objectContaining({ outcome: 'Writable' }) as unknown,
        seeds: {
          catalog: { manifestVersion: 1, additions: [] },
          journal: { manifestVersion: 2, additions: ['entry-type.position-change-reflection', 'source.position-change'] },
        },
        migration: {
          fromVersion: 1,
          toVersion: 2,
          sourceDatabase: V1_DATABASE,
          databaseName: expect.stringMatching(/^tj-ws-/) as string,
          counts: { catalog: 6, journalDefinitions: 1, journalEntries: 5, journalTypes: 2, meta: 3, trades: 5 },
          repairs: [{ tradeId: 'fx-0009', findings: [{ kind: 'LifecycleDisagreement', stored: 'Open', expected: 'Planned' }] }],
          privateRebuilds: ['trades.activityDesc', 'journalObligations', 'indexes'],
        },
      },
    });
    if (result.kind !== 'Opened' || !result.receipt.migration) throw new Error('expected a migration receipt');
    const dump = await dumpAll(factory);
    const migrated = dump[result.receipt.migration.databaseName]!;
    expect(dump['tj-root']!['pointer']).toEqual(
      expect.arrayContaining([{ key: 'current', databaseName: result.receipt.migration.databaseName }]),
    );
    expect(migrated['meta']).toEqual(expect.arrayContaining([{ key: 'schema', schemaVersion: 2 }]));
    expect(migrated['trades']).toEqual(expect.arrayContaining([expect.objectContaining({ tradeId: 'fx-0009', lifecycle: 'Planned' })]));
    expect(migrated['journalTypes']).toHaveLength(4);
    expect(migrated['journalObligations']).toHaveLength(5);
    // The old database is retired and deleted, and no candidate remains.
    expect(Object.keys(dump).sort()).toEqual(['tj-root', result.receipt.migration.databaseName]);
    expect(dump['tj-root']!['pointer']).toEqual(
      expect.arrayContaining([{ key: 'candidates', databaseNames: [] }, { key: 'retired', databaseNames: [] }]),
    );
  });

  it('should leave the Planned list and every Trade Detail equal, apart from opaque revision tokens, to the v1 views', async () => {
    const { workspace, views } = await v1Stack();
    expect((await workspace.initialize({})).kind).toBe('Opened');
    expect(await views()).toEqual(V1_VIEWS);
  });

  it('should return Opened existing with no migration on the next launch', async () => {
    const first = await v1Stack();
    const migrated = await first.workspace.initialize({});
    if (migrated.kind !== 'Opened') throw new Error('expected Opened');
    first.persistence.close();
    const before = await dumpAll(first.factory);
    const restarted = await testStack(first.factory, V1_DUMP.asOf);
    const workspace = createWorkspace({ ...restarted, host: restarted.testHost.host, releaseId: restarted.testHost.releaseId });
    const result = await workspace.initialize({});
    expect(result).toEqual(
      expect.objectContaining({
        kind: 'Opened',
        status: expect.objectContaining({ kind: 'Ready', binding: migrated.status.binding }) as unknown,
        receipt: expect.objectContaining({ fresh: false }) as unknown,
      }),
    );
    expect(result.kind === 'Opened' && result.receipt.migration).toBeUndefined();
    expect(await dumpAll(first.factory)).toEqual(before);
  });
});

describe('migration failure AC-REST-004', () => {
  it('should return MigrationBlocked with the failed stage, issues, and unchanged-data evidence database name, content revision, per-store counts when validation fails, leaving the old stores equal and no candidate', async () => {
    const { workspace, factory } = await v1Stack((dump) => {
      v1Records(dump, 'trades')[0]!['accountId'] = 'fx-unknown';
    });
    const before = (await dumpAll(factory))[V1_DATABASE];
    expect(await workspace.initialize({})).toEqual({
      kind: 'MigrationBlocked',
      stage: 'Validate',
      issues: [{ code: 'UnknownAccount', tradeId: 'fx-0009', accountId: 'fx-unknown' }],
      fromVersion: 1,
      toVersion: 2,
      unchangedData: {
        databaseName: V1_DATABASE,
        contentRevision: 11,
        counts: { catalog: 6, journalDefinitions: 1, journalEntries: 5, journalTypes: 2, meta: 5, trades: 5 },
      },
      recoveryActions: [{ action: 'Retry', explanation: expect.any(String) as string }],
    });
    const after = await dumpAll(factory);
    expect(after[V1_DATABASE]).toEqual(before);
    expect(Object.keys(after).sort()).toEqual(['tj-root', V1_DATABASE]);
    expect(after['tj-root']!['pointer']).toEqual(
      expect.arrayContaining([{ key: 'current', databaseName: V1_DATABASE }, { key: 'candidates', databaseNames: [] }]),
    );
  });

  it('should never report Ready while blocked, and getStatus should report MigrationBlocked', async () => {
    const { workspace } = await v1Stack((dump) => {
      v1Records(dump, 'trades')[0]!['accountId'] = 'fx-unknown';
    });
    const blocked = await workspace.initialize({});
    if (blocked.kind !== 'MigrationBlocked') throw new Error('expected MigrationBlocked');
    const expected: unknown = expect.objectContaining({
      kind: 'MigrationBlocked',
      stage: 'Validate',
      issues: blocked.issues,
      unchangedData: blocked.unchangedData,
      readiness: expect.objectContaining({ outcome: 'Writable' }) as unknown,
    });
    expect(await workspace.getStatus()).toEqual(expected);
    // Retrying before the cause is removed blocks again; nothing is ever Ready.
    expect((await workspace.initialize({})).kind).toBe('MigrationBlocked');
    expect(await workspace.getStatus()).toEqual(expected);
  });

  it('should migrate and return Opened when Retry runs after the cause is removed', async () => {
    const { workspace, factory } = await v1Stack((dump) => {
      v1Records(dump, 'trades')[0]!['accountId'] = 'fx-unknown';
    });
    expect((await workspace.initialize({})).kind).toBe('MigrationBlocked');
    await rawUpdate(factory, V1_DATABASE, 'trades', 'fx-0009', (trade) => ({ ...trade, accountId: 'fx-0006' }));
    const retried = await workspace.initialize({});
    expect(retried).toEqual(
      expect.objectContaining({
        kind: 'Opened',
        receipt: expect.objectContaining({ migration: expect.objectContaining({ fromVersion: 1, toVersion: 2 }) as unknown }) as unknown,
      }),
    );
    expect(await workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'Ready', schemaVersion: 2 }));
  });
});

describe('activation failure', () => {
  it('should return MigrationBlocked at the Activate stage with unchanged-data evidence, leaving the old stores equal and no candidate, when the root flip transaction aborts', async () => {
    // The hook throws inside the real root flip transaction, which aborts it.
    let abort = true;
    const { workspace, factory } = await v1Stack(undefined, {
      activating() {
        if (abort) throw new Error('flip aborted');
      },
    });
    const before = (await dumpAll(factory))[V1_DATABASE];
    const blocked = await workspace.initialize({});
    expect(blocked).toEqual({
      kind: 'MigrationBlocked',
      stage: 'Activate',
      issues: [{ code: 'ActivationFailed' }],
      fromVersion: 1,
      toVersion: 2,
      unchangedData: {
        databaseName: V1_DATABASE,
        contentRevision: 11,
        counts: { catalog: 6, journalDefinitions: 1, journalEntries: 5, journalTypes: 2, meta: 5, trades: 5 },
      },
      recoveryActions: [{ action: 'Retry', explanation: expect.any(String) as string }],
    });
    const after = await dumpAll(factory);
    expect(after[V1_DATABASE]).toEqual(before);
    expect(Object.keys(after).sort()).toEqual(['tj-root', V1_DATABASE]);
    expect(after['tj-root']!['pointer']).toEqual(
      expect.arrayContaining([{ key: 'current', databaseName: V1_DATABASE }, { key: 'candidates', databaseNames: [] }]),
    );
    expect(await workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'MigrationBlocked', stage: 'Activate' }));
    // Retry once the flip can commit migrates as usual.
    abort = false;
    expect((await workspace.initialize({})).kind).toBe('Opened');
  });
});

describe('not Writable before migration P6', () => {
  it('should return RuntimeNotWritable with Workspace status IntegrityBlocked AwaitingMigration, not migrate, and leave the old database unchanged when readiness fails and the stored schema is older', async () => {
    const { workspace, factory, testHost } = await v1Stack();
    testHost.fail(['inventory']);
    const before = await dumpAll(factory);
    expect(await workspace.initialize({})).toEqual({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'Unsupported',
      failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
      workspaceStatus: 'IntegrityBlocked',
      safeActions: expect.any(Array) as unknown,
    });
    expect(await workspace.getStatus()).toEqual(
      expect.objectContaining({
        kind: 'IntegrityBlocked',
        reason: 'AwaitingMigration',
        failedChecks: [{ check: 'inventory', reason: 'InventoryMissing' }],
      }),
    );
    expect(await dumpAll(factory)).toEqual(before);
    // Not even its IndexedDB version was raised: no migration began.
    expect((await factory.databases()).find((d) => d.name === V1_DATABASE)?.version).toBe(1);
  });
});

describe('unsupported versions', () => {
  it('should return IntegrityBlocked UnsupportedNewerSchema and write nothing when the stored schema is newer than the release', async () => {
    const { workspace, factory } = await v1Stack((dump) => {
      const schema = v1Records(dump, 'meta').find((record) => record['key'] === 'schema')!;
      schema['schemaVersion'] = 3;
    });
    const before = await dumpAll(factory);
    expect(await workspace.initialize({})).toEqual({
      kind: 'IntegrityBlocked',
      reason: 'UnsupportedNewerSchema',
      recoveryActions: [{ action: 'Retry', explanation: expect.any(String) as string }],
    });
    expect(await workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'IntegrityBlocked', reason: 'UnsupportedNewerSchema' }));
    expect(await dumpAll(factory)).toEqual(before);
  });
});
