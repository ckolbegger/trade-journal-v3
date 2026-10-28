// Migration in Workspace.initialize (D2 T2.10), from the committed schema-1 fixture.
import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { dumpAll, testStack } from '../../../tests/support/stack.ts';
import { compareSnapshot } from '../../../tools/fixtures/snapshot-compare.ts';
import { loadDump, viewsOf, type WorkspaceDump } from '../../../tools/fixtures/workspace-fixture.ts';
import { createTradeViews } from '../trade-views/index.ts';
import { createMarketData } from '../../modules/market-data/index.ts';
import type { Persistence } from '../../persistence/index.ts';
import { createWorkspace, type MigrationStageHooks } from './index.ts';
import { createSessionPolicy, nyseSessionPolicy, type SessionPolicy } from '../../domain/session-policy/index.ts';
import { NYSE_TABLE } from '../../domain/session-policy/table.ts';

const V1_DUMP = JSON.parse(readFileSync('tests/fixtures/workspace-v1/dump.json', 'utf8')) as WorkspaceDump;
const V1_DATABASE = 'tj-ws-fx-0003';
const V2_DUMP = JSON.parse(readFileSync('tests/fixtures/workspace-v2/dump.json', 'utf8')) as WorkspaceDump;
const V2_DATABASE = 'tj-ws-fx-0004';
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
  return { ...stack, workspace, views: () => viewsOf({ TradeViewsAndReporting: createTradeViews(stack) }, V1_DUMP.schemaVersion) };
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
      status: expect.objectContaining({ kind: 'Ready', schemaVersion: 3 }) as unknown,
      receipt: {
        fresh: false,
        readiness: expect.objectContaining({ outcome: 'Writable' }) as unknown,
        seeds: {
          catalog: { manifestVersion: 1, additions: [] },
          journal: {
            manifestVersion: 3,
            additions: ['entry-type.position-change-reflection', 'entry-type.daily-trade-review', 'source.position-change', 'source.daily-review'],
          },
        },
        sessionPolicy: { recorded: nyseSessionPolicy.identity, findings: [] },
        migration: {
          fromVersion: 1,
          toVersion: 3,
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
    expect(migrated['meta']).toEqual(expect.arrayContaining([{ key: 'schema', schemaVersion: 3 }]));
    expect(migrated['trades']).toEqual(expect.arrayContaining([expect.objectContaining({ tradeId: 'fx-0009', lifecycle: 'Planned' })]));
    expect(migrated['journalTypes']).toHaveLength(6);
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
    // Field by field over the snapshot's fields: the fields T2.58 adds (summary, netCost) are allowed.
    expect(compareSnapshot(await views(), V1_VIEWS)).toEqual([]);
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
      toVersion: 3,
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
        receipt: expect.objectContaining({ migration: expect.objectContaining({ fromVersion: 1, toVersion: 3 }) as unknown }) as unknown,
      }),
    );
    expect(await workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'Ready', schemaVersion: 3 }));
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
      toVersion: 3,
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
      schema['schemaVersion'] = 4;
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

// A device holding the v2 fixture, optionally edited before the release opens it.
async function v2Stack(edit?: (dump: MutableDump) => void, migrationHooks?: MigrationStageHooks) {
  const dump = structuredClone(V2_DUMP);
  edit?.(dump as unknown as MutableDump);
  const stack = await testStack(await loadDump(dump), dump.asOf);
  const workspace = createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId, migrationHooks });
  return { ...stack, workspace, views: () => viewsOf({ TradeViewsAndReporting: createTradeViews(stack) }, V2_DUMP.schemaVersion) };
}

describe('migration to schema 3', () => {
  it('should migrate a v2 Workspace and return Opened with a receipt naming 2 → 3, per-store counts, seed additions Daily Trade Review and Daily Review Source, and the recorded session-policy identity', async () => {
    const { workspace } = await v2Stack();
    expect(await workspace.initialize({})).toEqual({
      kind: 'Opened',
      status: expect.objectContaining({ kind: 'Ready', schemaVersion: 3 }) as unknown,
      receipt: {
        fresh: false,
        readiness: expect.objectContaining({ outcome: 'Writable' }) as unknown,
        seeds: {
          catalog: { manifestVersion: 1, additions: [] },
          journal: { manifestVersion: 3, additions: ['entry-type.daily-trade-review', 'source.daily-review'] },
        },
        sessionPolicy: { recorded: nyseSessionPolicy.identity, findings: [] },
        migration: {
          fromVersion: 2,
          toVersion: 3,
          sourceDatabase: V2_DATABASE,
          databaseName: expect.stringMatching(/^tj-ws-/) as string,
          counts: { catalog: 6, journalDeclines: 3, journalDefinitions: 2, journalEntries: 11, journalTypes: 4, meta: 4, trades: 8 },
          repairs: [],
          privateRebuilds: ['trades.activityDesc', 'journalObligations', 'indexes'],
        },
      },
    });
  });

  it('should migrate a v1 Workspace to schema 3 in one candidate', async () => {
    const { workspace, factory } = await v1Stack();
    const opened = new Set<string>();
    const open = factory.open.bind(factory);
    vi.spyOn(factory, 'open').mockImplementation((name: string, version?: number) => {
      opened.add(name);
      return open(name, version);
    });
    const result = await workspace.initialize({});
    if (result.kind !== 'Opened' || !result.receipt.migration) throw new Error('expected a migration receipt');
    // Exactly one candidate database was ever opened beside the root and the source, even one deleted afterwards.
    expect([...opened].filter((name) => name !== 'tj-root' && name !== V1_DATABASE)).toEqual([result.receipt.migration.databaseName]);
    expect(result.receipt.migration).toMatchObject({ fromVersion: 1, toVersion: 3, sourceDatabase: V1_DATABASE });
    expect(result.receipt.seeds.journal).toEqual({
      manifestVersion: 3,
      additions: ['entry-type.position-change-reflection', 'entry-type.daily-trade-review', 'source.position-change', 'source.daily-review'],
    });
    const dump = await dumpAll(factory);
    // One candidate carried the whole v1 to v3 chain, so no intermediate Workspace remains.
    expect(Object.keys(dump).sort()).toEqual(['tj-root', result.receipt.migration.databaseName]);
    const migrated = dump[result.receipt.migration.databaseName]!;
    expect(migrated['meta']).toEqual(
      expect.arrayContaining([{ key: 'schema', schemaVersion: 3 }, expect.objectContaining({ key: 'sessionPolicy', policy: nyseSessionPolicy.identity })]),
    );
    expect(migrated['journalTypes']).toHaveLength(6);
    expect(migrated['observations']).toEqual([]);
  });

  // The current figures of an Open Trade (Unavailable MarkMissing, A51) arrive with T4.18's views;
  // until then the snapshot comparison covers every field the pre-migration views contain.
  it('should keep every earlier field of the Planned and Open lists and Details equal to the pre-migration views', async () => {
    const v1 = await v1Stack();
    const v2 = await v2Stack();
    expect((await v1.workspace.initialize({})).kind).toBe('Opened');
    expect((await v2.workspace.initialize({})).kind).toBe('Opened');
    const v2Views: unknown = JSON.parse(readFileSync('tests/fixtures/workspace-v2/expected-views.json', 'utf8'));
    expect(compareSnapshot(await v1.views(), V1_VIEWS)).toEqual([]);
    expect(compareSnapshot(await v2.views(), v2Views)).toEqual([]);
    // The comparison is not vacuous: the v2 snapshot holds Open Trades.
    expect((v2Views as { open: unknown[] }).open.length).toBeGreaterThan(0);
  });

  it('should return MigrationBlocked with the old stores unchanged when candidate validation fails, and Opened after Retry once the cause is removed', async () => {
    const { workspace, factory } = await v2Stack((dump) => {
      dump.databases[V2_DATABASE]!.stores['trades']!.records[0]!['accountId'] = 'fx-unknown';
    });
    const before = (await dumpAll(factory))[V2_DATABASE];
    const blocked = await workspace.initialize({});
    expect(blocked).toEqual(
      expect.objectContaining({
        kind: 'MigrationBlocked',
        stage: 'Validate',
        issues: [{ code: 'UnknownAccount', tradeId: 'fx-0010', accountId: 'fx-unknown' }],
        fromVersion: 2,
        toVersion: 3,
      }),
    );
    const after = await dumpAll(factory);
    expect(after[V2_DATABASE]).toEqual(before);
    expect(Object.keys(after).sort()).toEqual(['tj-root', V2_DATABASE]);
    expect(await workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'MigrationBlocked', stage: 'Validate' }));
    await rawUpdate(factory, V2_DATABASE, 'trades', 'fx-0010', (trade) => ({ ...trade, accountId: 'fx-0007' }));
    expect(await workspace.initialize({})).toEqual(
      expect.objectContaining({
        kind: 'Opened',
        receipt: expect.objectContaining({ migration: expect.objectContaining({ fromVersion: 2, toVersion: 3 }) as unknown }) as unknown,
      }),
    );
    expect(await workspace.getStatus()).toEqual(expect.objectContaining({ kind: 'Ready', schemaVersion: 3 }));
  });
});

// A later release's policy: the same table with another revision and a longer coverage.
const POLICY_REVISION_2 = createSessionPolicy({ id: 'nyse', revision: 2, coverage: { first: '2024-01-01', last: '2029-12-31' }, table: NYSE_TABLE });

// One launch of a release shipping `sessionPolicy` on the device held by `factory`.
async function launch(factory: IDBFactory, sessionPolicy: SessionPolicy, now = '2026-10-16T21:00:00Z') {
  const stack = await testStack(factory, now, sessionPolicy);
  return { ...stack, workspace: createWorkspace({ ...stack, host: stack.testHost.host, releaseId: stack.testHost.releaseId }) };
}

describe('session-policy compatibility (A40)', () => {
  it('should record a newer policy revision that only extends coverage, with no findings', async () => {
    const first = await launch(new IDBFactory(), nyseSessionPolicy);
    expect((await first.workspace.initialize({ timeZone: 'America/New_York' })).kind).toBe('Opened');
    first.persistence.close();

    const second = await launch(first.factory, POLICY_REVISION_2);
    const result = await second.workspace.initialize({});
    if (result.kind !== 'Opened') throw new Error('expected Opened');
    expect(result.receipt.sessionPolicy).toEqual({ previous: nyseSessionPolicy.identity, recorded: POLICY_REVISION_2.identity, findings: [] });
    const stored = Object.values(await dumpAll(first.factory)).flatMap((stores) => stores['meta'] ?? []);
    expect(stored).toContainEqual(expect.objectContaining({ key: 'sessionPolicy', policy: POLICY_REVISION_2.identity }));
    second.persistence.close();

    // The identity is recorded once: the next launch of the same release has nothing to record.
    const third = await launch(first.factory, POLICY_REVISION_2);
    const again = await third.workspace.initialize({});
    expect(again.kind === 'Opened' && again.receipt.sessionPolicy).toBeUndefined();
  });

  it('should read no observations when the stored session-policy identity matches the release\'s', async () => {
    const first = await launch(new IDBFactory(), nyseSessionPolicy);
    expect((await first.workspace.initialize({ timeZone: 'America/New_York' })).kind).toBe('Opened');
    first.persistence.close();

    const second = await launch(first.factory, nyseSessionPolicy);
    // Every store read inside a snapshot is noted.
    const reads: string[] = [];
    const observing: Persistence = {
      ...second.persistence,
      readSnapshot: (stores, read) =>
        second.persistence.readSnapshot(stores, (tx) =>
          read({
            ...tx,
            get: (store, key) => (reads.push(store), tx.get(store, key)),
            getAll: (store) => (reads.push(store), tx.getAll(store)),
            getAllInRange: (store, range) => (reads.push(store), tx.getAllInRange(store, range)),
            getAllFromIndex: (store, index, query, count) => (reads.push(store), tx.getAllFromIndex(store, index, query, count)),
          }),
        ),
    };
    const workspace = createWorkspace({ ...second, persistence: observing, host: second.testHost.host, releaseId: second.testHost.releaseId });
    const result = await workspace.initialize({});
    expect(result.kind === 'Opened' && result.receipt.sessionPolicy).toBeUndefined();
    expect(reads).toContain('meta');
    expect(reads).not.toContain('observations');
  });

  it('should record nothing more when another launch records the identity between its scan and its commit', async () => {
    const first = await launch(new IDBFactory(), nyseSessionPolicy);
    expect((await first.workspace.initialize({ timeZone: 'America/New_York' })).kind).toBe('Opened');
    first.persistence.close();

    const second = await launch(first.factory, POLICY_REVISION_2);
    // Just before this launch records the identity, another launch of the same release does.
    const racing: Persistence = {
      ...second.persistence,
      async commit(writeSet) {
        const records = writeSet.writes.some((w) => w.op === 'put' && w.store === 'meta' && w.value['key'] === 'sessionPolicy');
        if (records) await second.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'meta', value: { key: 'sessionPolicy', policy: POLICY_REVISION_2.identity } }] });
        return second.persistence.commit(writeSet);
      },
    };
    const workspace = createWorkspace({ ...second, persistence: racing, host: second.testHost.host, releaseId: second.testHost.releaseId });
    const result = await workspace.initialize({});
    if (result.kind !== 'Opened') throw new Error('expected Opened');
    expect(result.receipt.sessionPolicy).toBeUndefined();
    const stored = Object.values(await dumpAll(first.factory)).flatMap((stores) => stores['meta'] ?? []);
    expect(stored).toContainEqual(expect.objectContaining({ key: 'sessionPolicy', policy: POLICY_REVISION_2.identity }));
  });

  it('should revalidate and record findings when another launch records a different identity between the scan and the commit', async () => {
    const closure = { date: '2026-10-14', kind: 'Closure', name: 'Test closure', source: { name: 'Test', url: 'https://example.test/closure' } } as const;
    const withClosure = createSessionPolicy({ id: 'nyse', revision: 2, coverage: { first: '2024-01-01', last: '2029-12-31' }, table: [...NYSE_TABLE, closure] });
    const first = await launch(new IDBFactory(), nyseSessionPolicy);
    expect((await first.workspace.initialize({ timeZone: 'America/New_York' })).kind).toBe('Opened');
    first.persistence.close();

    const second = await launch(first.factory, withClosure);
    const third = { id: 'nyse', revision: 3, digest: 'another-release' };
    let moved = false;
    // Before this launch's first identity commit, another launch records a third identity and an observation on a date this release closes.
    const racing: Persistence = {
      ...second.persistence,
      async commit(writeSet) {
        const records = writeSet.writes.some((w) => w.op === 'put' && w.store === 'meta' && w.value['key'] === 'sessionPolicy');
        if (records && !moved) {
          moved = true;
          const marketData = createMarketData({ persistence: second.persistence, ids: second.ids, clock: second.clock, sessionPolicy: nyseSessionPolicy });
          const saved = await marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'XYZ', tradingDate: '2026-10-14', price: '52', expectedResolutionRevision: 'None' });
          expect(saved.kind).toBe('Saved');
          await second.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'meta', value: { key: 'sessionPolicy', policy: third } }] });
        }
        return second.persistence.commit(writeSet);
      },
    };
    const workspace = createWorkspace({ ...second, persistence: racing, host: second.testHost.host, releaseId: second.testHost.releaseId });
    const result = await workspace.initialize({});
    if (result.kind !== 'Opened') throw new Error('expected Opened');
    expect(result.receipt.sessionPolicy).toEqual({
      previous: third,
      recorded: withClosure.identity,
      findings: [{ code: 'NotASession', instrumentKey: 'XYZ', tradingDate: '2026-10-14' }],
    });
    const stored = Object.values(await dumpAll(first.factory)).flatMap((stores) => stores['meta'] ?? []);
    expect(stored).toContainEqual(expect.objectContaining({ key: 'sessionPolicy', policy: withClosure.identity }));
  });

  it('should record nothing and report no session policy when the identity keeps changing on every attempt', async () => {
    const first = await launch(new IDBFactory(), nyseSessionPolicy);
    expect((await first.workspace.initialize({ timeZone: 'America/New_York' })).kind).toBe('Opened');
    first.persistence.close();

    const second = await launch(first.factory, POLICY_REVISION_2);
    let attempts = 0;
    // Before each of this launch's identity commits, another launch moves the identity to one more release's.
    const racing: Persistence = {
      ...second.persistence,
      async commit(writeSet) {
        const records = writeSet.writes.some((w) => w.op === 'put' && w.store === 'meta' && w.value['key'] === 'sessionPolicy');
        if (records) {
          attempts += 1;
          await second.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'meta', value: { key: 'sessionPolicy', policy: { id: 'nyse', revision: 10 + attempts, digest: 'moving' } } }] });
        }
        return second.persistence.commit(writeSet);
      },
    };
    const workspace = createWorkspace({ ...second, persistence: racing, host: second.testHost.host, releaseId: second.testHost.releaseId });
    const result = await workspace.initialize({});
    if (result.kind !== 'Opened') throw new Error('expected Opened');
    expect(result.receipt.sessionPolicy).toBeUndefined();
    expect(attempts).toBe(3);
    const stored = Object.values(await dumpAll(first.factory)).flatMap((stores) => stores['meta'] ?? []);
    // The identity left is the last racing one the wrapper wrote, never this release's.
    expect(stored.filter((r) => (r as { key: string }).key === 'sessionPolicy')).toEqual([expect.objectContaining({ policy: { id: 'nyse', revision: 10 + attempts, digest: 'moving' } })]);
  });

  it('should keep an observation record whose date the newer policy turns into a closure, list it as a finding in the receipt, and leave it out of every frame', async () => {
    const closure = { date: '2026-10-14', kind: 'Closure', name: 'Test closure', source: { name: 'Test', url: 'https://example.test/closure' } } as const;
    const withClosure = createSessionPolicy({
      id: 'nyse',
      revision: 2,
      coverage: { first: '2024-01-01', last: '2029-12-31' },
      table: [...NYSE_TABLE, closure],
    });
    const first = await launch(new IDBFactory(), nyseSessionPolicy);
    expect((await first.workspace.initialize({ timeZone: 'America/New_York' })).kind).toBe('Opened');
    // Tuesday's Mark stays a session's; Wednesday's date becomes a closure in the next release.
    const marketData = createMarketData({ persistence: first.persistence, ids: first.ids, clock: first.clock, sessionPolicy: nyseSessionPolicy });
    for (const tradingDate of ['2026-10-13', '2026-10-14']) {
      const saved = await marketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'XYZ', tradingDate, price: '52', expectedResolutionRevision: 'None' });
      expect(saved.kind).toBe('Saved');
    }
    first.persistence.close();

    const second = await launch(first.factory, withClosure);
    const result = await second.workspace.initialize({});
    if (result.kind !== 'Opened') throw new Error('expected Opened');
    expect(result.receipt.sessionPolicy).toEqual({
      previous: nyseSessionPolicy.identity,
      recorded: withClosure.identity,
      findings: [{ code: 'NotASession', instrumentKey: 'XYZ', tradingDate: '2026-10-14' }],
    });
    // The record is kept, never deleted.
    const kept = Object.values(await dumpAll(first.factory)).flatMap((stores) => stores['observations'] ?? []);
    expect(kept).toContainEqual(expect.objectContaining({ instrumentKey: 'XYZ', tradingDate: '2026-10-14' }));

    // No frame names it: the closure is not a session, and Stale context comes from the last session with a Mark.
    const later = createMarketData({ persistence: second.persistence, ids: second.ids, clock: second.clock, sessionPolicy: withClosure });
    expect(await later.query({ kind: 'ResolveFrames', context: { kind: 'Historical', tradingDate: '2026-10-14' }, instruments: ['XYZ'] })).toEqual({
      kind: 'Rejected',
      issues: [{ field: 'tradingDate', code: 'NotASession' }],
    });
    const friday = await later.query({ kind: 'ResolveFrames', context: { kind: 'Current', asOf: '2026-10-16T21:00:00Z' }, instruments: ['XYZ'] });
    if (friday.kind !== 'Frames') throw new Error('expected frames');
    expect(friday.frames.map((frame) => [frame.tradingDate, frame.resolution])).toEqual([
      ['2026-10-16', { kind: 'Missing', stale: expect.objectContaining({ tradingDate: '2026-10-13' }) as unknown }],
    ]);
  });
});
