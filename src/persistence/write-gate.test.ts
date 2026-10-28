import { IDBDatabase as FakeIDBDatabase, IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReadinessSession, type ReadinessEvaluation } from '../delivery/readiness.ts';
import { readinessWriteGate } from '../delivery/write-gate.ts';
import { createPersistence } from './index.ts';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';

const passed = { passed: true } as const;
const writable: ReadinessEvaluation = {
  outcome: 'Writable',
  failures: [],
  protection: 'BestEffort',
  checks: { diagnostic: passed, capacity: passed, control: passed, inventory: passed },
};
const recoveryOnly: ReadinessEvaluation = {
  outcome: 'RecoveryOnly',
  workspaceStatus: 'RecoveryOnly',
  failures: [{ check: 'inventory', reason: 'InventoryInvalid' }],
  protection: 'BestEffort',
  checks: { ...writable.checks, inventory: { passed: false, reason: 'InventoryInvalid' } },
};

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});
afterEach(() => {
  vi.restoreAllMocks();
});

// Every database, store, and record, read with the raw API.
async function dump(): Promise<Record<string, Record<string, unknown[]>>> {
  const out: Record<string, Record<string, unknown[]>> = {};
  for (const { name } of await factory.databases()) {
    if (!name) continue;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(name);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error ?? new Error('open failed'));
    });
    out[name] = {};
    for (const store of Array.from(db.objectStoreNames)) {
      out[name][store] = await new Promise((resolve) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result);
      });
    }
    db.close();
  }
  return out;
}

// A Workspace created while Writable, whose session then re-evaluates to `next`.
async function workspaceThen(next: ReadinessEvaluation) {
  const states = [writable, next];
  const session = await createReadinessSession(() => Promise.resolve(states.shift() ?? next));
  let n = 0;
  const persistence = createPersistence({
    indexedDB: factory,
    ids: { next: () => `id-${++n}` },
    writeGate: readinessWriteGate(session),
    sessionPolicy: TEST_SESSION_POLICY,
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  await session.recheck();
  return { persistence, session, databaseName: created.databaseName };
}

describe('persistence-level gate', () => {
  it('should return RuntimeNotWritable before opening any write transaction when the session is RecoveryOnly, carrying readiness, every failed check, Workspace status RecoveryOnly, and safe actions', async () => {
    const { persistence } = await workspaceThen(recoveryOnly);
    const transactions = vi.spyOn(FakeIDBDatabase.prototype, 'transaction');
    const result = await persistence.commit({ checks: [], writes: [{ op: 'put', store: 'trades', value: { tradeId: 't' } }] });
    expect(result).toEqual({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [
        { action: 'ReadOnly', explanation: expect.any(String) as string },
        { action: 'Retry', explanation: expect.any(String) as string },
      ],
    });
    expect(transactions.mock.calls.filter(([, mode]) => mode === 'readwrite')).toHaveLength(0);
  });

  it('should return RuntimeNotWritable with Workspace status IntegrityBlocked or None when the session is Unsupported', async () => {
    const unsupported = (workspaceStatus: 'None' | 'IntegrityBlocked'): ReadinessEvaluation => ({
      outcome: 'Unsupported',
      workspaceStatus,
      failures: [
        { check: 'capacity', reason: 'InsufficientQuota' },
        { check: 'control', reason: 'NoController' },
      ],
      protection: 'Unavailable',
      checks: writable.checks,
    });
    const none = await workspaceThen(unsupported('None'));
    expect(await none.persistence.commit({ checks: [], writes: [] })).toEqual({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'Unsupported',
      failedChecks: unsupported('None').failures,
      workspaceStatus: 'None',
      safeActions: [
        { action: 'Retry', explanation: expect.any(String) as string },
        { action: 'TryAnotherBrowser', explanation: expect.any(String) as string },
      ],
    });
    factory = new IDBFactory();
    const blocked = await workspaceThen(unsupported('IntegrityBlocked'));
    expect(await blocked.persistence.commit({ checks: [], writes: [] })).toEqual({
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'Unsupported',
      failedChecks: unsupported('IntegrityBlocked').failures,
      workspaceStatus: 'IntegrityBlocked',
      safeActions: [{ action: 'Retry', explanation: expect.any(String) as string }],
    });
  });

  it('should leave the content revision and every store unchanged on the RuntimeNotWritable path', async () => {
    const { persistence } = await workspaceThen(recoveryOnly);
    const before = await dump();
    await persistence.commit({ checks: [], writes: [{ op: 'put', store: 'catalog', value: { id: 'x' } }] });
    expect(await dump()).toEqual(before);

    // Creating a Workspace is a write too: outside Writable it must not happen.
    factory = new IDBFactory();
    const session = await createReadinessSession(() => Promise.resolve(recoveryOnly));
    const fresh = createPersistence({ indexedDB: factory, ids: { next: () => 'new' }, writeGate: readinessWriteGate(session), sessionPolicy: TEST_SESSION_POLICY });
    await fresh.inspectRoot();
    const empty = await dump();
    expect(await fresh.createWorkspace([])).toEqual(expect.objectContaining({ kind: 'RuntimeNotWritable' }));
    expect(await dump()).toEqual(empty);
  });
});
