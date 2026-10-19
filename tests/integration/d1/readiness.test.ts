import { describe, expect, it } from 'vitest';
import type { ReadinessCheckName } from '../../../src/delivery/runtime-not-writable.ts';
import { device, dumpAll, launch, onboarded, planCommand, restart, type Device } from './support.ts';

function rawOpen(d: Device, name: string, version: number, upgrade: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = d.factory.open(name, version);
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('open failed'));
  });
}

function rawPut(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
  });
}

async function databaseVersions(d: Device): Promise<Record<string, number | undefined>> {
  const databases: IDBDatabaseInfo[] = await d.factory.databases();
  return Object.fromEntries(databases.map((db) => [db.name ?? '', db.version] as const));
}

const notWritable = (check: ReadinessCheckName): unknown =>
  expect.objectContaining({
    kind: 'RuntimeNotWritable',
    runtimeReadiness: 'RecoveryOnly',
    failedChecks: expect.arrayContaining([expect.objectContaining({ check })]) as unknown,
    safeActions: expect.arrayContaining([expect.anything()]) as unknown,
  });

describe('I1.6 write gate at both boundaries', () => {
  it('should refuse initialize, both Catalog creates, confirmPlan, and a direct Persistence.commit with RuntimeNotWritable while the inventory check fails, changing nothing', async () => {
    const d = await device();
    const { app, institution } = await onboarded(d);
    const command = await planCommand(app);
    d.testHost.fail(['inventory']);
    const recovery = await restart(app, d);
    const before = await dumpAll(d.factory);

    expect(await recovery.Workspace.initialize({ timeZone: 'America/New_York' })).toEqual(notWritable('inventory'));
    expect(await recovery.ReferenceCatalog.save({ kind: 'CreateInstitution', label: 'Schwab' })).toEqual(notWritable('inventory'));
    expect(await recovery.ReferenceCatalog.save({ kind: 'CreateAccount', institutionId: institution.record.id, label: 'Taxable' })).toEqual(
      notWritable('inventory'),
    );
    expect(await recovery.TradeWorkflows.confirmPlan(command)).toEqual(notWritable('inventory'));
    expect(
      await recovery.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 'direct' } }] }),
    ).toEqual(notWritable('inventory'));
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});

describe('I1.7 readiness failures before a Workspace exists', () => {
  const sets: ReadinessCheckName[][] = [['diagnostic'], ['capacity'], ['control'], ['inventory'], ['diagnostic', 'capacity'], ['control', 'inventory']];
  for (const failing of sets) {
    it(`should report Unsupported naming exactly ${failing.join(' and ')}, refuse initialize, and create no Workspace`, async () => {
      const d = await device();
      d.testHost.fail(failing);
      const app = await launch(d);
      const status = await app.Workspace.getStatus();
      expect(status.kind).toBe('Unsupported');
      expect(status.kind === 'Unsupported' && status.failedChecks.map((f) => f.check).sort()).toEqual([...failing].sort());
      expect((await app.Workspace.initialize({ timeZone: 'America/New_York' })).kind).toBe('RuntimeNotWritable');
      const dump = await dumpAll(d.factory);
      expect(Object.keys(dump).filter((n) => n.startsWith('tj-ws-'))).toEqual([]);
      expect(dump['tj-root']?.['diagnostics'] ?? []).toEqual([]);
    });
  }
});

describe('I1.8 Integrity Blocked', () => {
  it('should block a root at a newer version without creating a Workspace or touching the root', async () => {
    const d = await device();
    const root = await rawOpen(d, 'tj-root', 99, (db) => db.createObjectStore('future', { keyPath: 'id' }));
    await rawPut(root, 'future', { id: 'kept' });
    root.close();
    const before = { dump: await dumpAll(d.factory), versions: await databaseVersions(d) };

    const app = await launch(d);
    const status = await app.Workspace.getStatus();
    expect([status.kind, status.readiness.outcome]).toEqual(['IntegrityBlocked', 'Unsupported']);
    expect((await app.Workspace.initialize({ timeZone: 'America/New_York' })).kind).not.toBe('Opened');
    expect({ dump: await dumpAll(d.factory), versions: await databaseVersions(d) }).toEqual(before);
  });

  it('should block a pointer naming a missing Workspace database without creating one or touching the root', async () => {
    const d = await device();
    const root = await rawOpen(d, 'tj-root', 1, (db) => {
      db.createObjectStore('pointer', { keyPath: 'key' });
      db.createObjectStore('diagnostics', { keyPath: 'id' });
    });
    await rawPut(root, 'pointer', { key: 'current', databaseName: 'tj-ws-missing' });
    root.close();
    const before = { dump: await dumpAll(d.factory), versions: await databaseVersions(d) };

    const app = await launch(d);
    const status = await app.Workspace.getStatus();
    expect([status.kind, status.readiness.outcome]).toEqual(['IntegrityBlocked', 'Unsupported']);
    expect((await app.Workspace.initialize({ timeZone: 'America/New_York' })).kind).not.toBe('Opened');
    expect({ dump: await dumpAll(d.factory), versions: await databaseVersions(d) }).toEqual(before);
  });

  it('should keep readiness Writable and return IntegrityBlocked with recovery actions for a Workspace of an unknown schema version', async () => {
    const d = await device();
    const root = await rawOpen(d, 'tj-root', 1, (db) => {
      db.createObjectStore('pointer', { keyPath: 'key' });
      db.createObjectStore('diagnostics', { keyPath: 'id' });
    });
    await rawPut(root, 'pointer', { key: 'current', databaseName: 'tj-ws-future' });
    root.close();
    const workspace = await rawOpen(d, 'tj-ws-future', 1, (db) => db.createObjectStore('meta', { keyPath: 'key' }));
    await rawPut(workspace, 'meta', { key: 'schema', schemaVersion: 99 });
    workspace.close();
    const before = await dumpAll(d.factory);

    const app = await launch(d);
    expect((await app.Workspace.getStatus()).readiness.outcome).toBe('Writable');
    const result = await app.Workspace.initialize({ timeZone: 'America/New_York' });
    expect(result).toEqual(
      expect.objectContaining({ kind: 'IntegrityBlocked', reason: 'UnknownSchemaVersion', recoveryActions: expect.arrayContaining([expect.anything()]) as unknown }),
    );
    expect(await dumpAll(d.factory)).toEqual(before);
  });
});

describe('I1.10 mid-session failure', () => {
  it('should refuse confirmPlan once the inventory check starts failing, move to RecoveryOnly, change nothing, and keep reads Ready', async () => {
    const d = await device();
    const { app } = await onboarded(d);
    const first = await app.TradeWorkflows.confirmPlan(await planCommand(app));
    if (first.kind !== 'Confirmed') throw new Error(`confirmPlan: ${first.kind}`);
    const command = await planCommand(app, { underlying: 'ABC' });
    const before = await dumpAll(d.factory);

    d.testHost.fail(['inventory']);
    expect(await app.TradeWorkflows.confirmPlan(command)).toEqual(notWritable('inventory'));
    expect((await app.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    expect(await dumpAll(d.factory)).toEqual(before);
    expect((await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Planned' })).kind).toBe('Ready');
    expect((await app.TradeViewsAndReporting.getTradeDetail({ tradeId: first.receipt.tradeId })).kind).toBe('Ready');
  });
});
