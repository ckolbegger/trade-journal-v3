import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPersistence, type WriteGate } from './index.ts';
import { TEST_SESSION_POLICY } from '../../tests/support/session-policy.ts';
import type { RuntimeNotWritable } from '../delivery/runtime-not-writable.ts';

// T8.7: Restore candidates and activation without a Workspace (D8 A135, A138).

let factory: IDBFactory;
beforeEach(() => {
  factory = new IDBFactory();
});
afterEach(() => {
  vi.restoreAllMocks();
});

const writable: WriteGate = { current: () => null, recheck: () => Promise.resolve(null) };

function persistence(prefix: string, writeGate: WriteGate = writable) {
  let n = 0;
  return createPersistence({
    indexedDB: factory,
    ids: { next: () => `${prefix}-${String(++n).padStart(4, '0')}` },
    writeGate,
    sessionPolicy: TEST_SESSION_POLICY,
  });
}

function rawGet(database: string, store: string, key: IDBValidKey): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const open = factory.open(database);
    open.onerror = () => reject(open.error ?? new Error('open failed'));
    open.onsuccess = () => {
      const db = open.result;
      const request = db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
    };
  });
}

async function databaseNames(): Promise<string[]> {
  return (await factory.databases()).map((d) => d.name ?? '').sort();
}

interface RestoreEntry {
  readonly databaseName: string;
  readonly purpose: string;
  readonly session: string;
}

async function restoreEntries(): Promise<readonly RestoreEntry[]> {
  const record = (await rawGet('tj-root', 'pointer', 'candidates')) as { restoreCandidates?: readonly RestoreEntry[] };
  return record.restoreCandidates ?? [];
}

describe('Restore candidates (A138)', () => {
  it('should list a Restore candidate with purpose Restore and this instance session identity before creating it, and delete this session earlier Restore candidate when a new one is listed', async () => {
    const p = persistence('r');
    const created = await p.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');

    // Creation is interrupted after the entry is listed: the entry must already be there.
    const open = factory.open.bind(factory);
    vi.spyOn(factory, 'open').mockImplementation((name: string, version?: number) => {
      if (name === 'tj-ws-r-0002') throw new Error('candidate creation interrupted');
      return open(name, version);
    });
    await expect(p.createRestoreCandidate()).rejects.toThrow('candidate creation interrupted');
    vi.restoreAllMocks();
    const [interrupted] = await restoreEntries();
    expect(interrupted).toEqual({ databaseName: 'tj-ws-r-0002', purpose: 'Restore', session: interrupted?.session });
    expect(interrupted?.session).toMatch(/^.+$/);

    // A new Restore candidate from the same instance replaces the earlier one.
    const first = await p.createRestoreCandidate();
    if (first.kind === 'RuntimeNotWritable') throw new Error('not writable');
    expect(first.databaseName).toBe('tj-ws-r-0003');
    expect(await restoreEntries()).toEqual([{ databaseName: 'tj-ws-r-0003', purpose: 'Restore', session: interrupted?.session }]);
    expect(await databaseNames()).toEqual(['tj-root', created.databaseName, 'tj-ws-r-0003']);
    expect(await rawGet('tj-root', 'pointer', 'candidates')).toEqual(
      expect.objectContaining({ databaseNames: ['tj-ws-r-0003'] }),
    );

    // Another application instance has its own identity, and its candidate is left alone.
    const other = persistence('o');
    const otherCandidate = await other.createRestoreCandidate();
    if (otherCandidate.kind === 'RuntimeNotWritable') throw new Error('not writable');
    const entries = await restoreEntries();
    expect(entries.map((e) => e.databaseName)).toEqual(['tj-ws-r-0003', otherCandidate.databaseName]);
    expect(entries[1]?.session).not.toBe(entries[0]?.session);
    expect(await databaseNames()).toEqual(['tj-root', created.databaseName, 'tj-ws-r-0003', otherCandidate.databaseName].sort());
  });

  it('should refuse to create a candidate outside Writable with RuntimeNotWritable, creating no database', async () => {
    const refusal: RuntimeNotWritable = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [{ action: 'Reload', explanation: 'Reload.' }],
    };
    const p = persistence('g', { current: () => refusal, recheck: () => Promise.resolve(refusal) });

    expect(await p.createRestoreCandidate()).toEqual(refusal);

    expect(await databaseNames()).toEqual([]);
  });
});

describe('activation without a Workspace (A135)', () => {
  it('should activate a candidate by adding the pointer when none exists, and fail with AlreadyInitialized, deleting the candidate, when a pointer was added meanwhile', async () => {
    const restoring = persistence('r');
    const candidate = await restoring.createRestoreCandidate();
    if (candidate.kind === 'RuntimeNotWritable') throw new Error('not writable');

    const activated = await restoring.activateFirstCandidate(candidate.databaseName);

    expect(activated).toEqual({ kind: 'Activated' });
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual({ key: 'current', databaseName: candidate.databaseName });
    expect(await restoreEntries()).toEqual([]);
    expect((await restoring.readSnapshot([], () => Promise.resolve(null))).binding.databaseName).toBe(candidate.databaseName);

    // A second origin state: a pointer appears while another candidate waits.
    factory = new IDBFactory();
    const racing = persistence('x');
    const waiting = await racing.createRestoreCandidate();
    if (waiting.kind === 'RuntimeNotWritable') throw new Error('not writable');
    const initializer = persistence('i');
    const created = await initializer.createWorkspace([]);
    if (created.kind !== 'Created') throw new Error('workspace not created');

    const lost = await racing.activateFirstCandidate(waiting.databaseName);

    expect(lost).toEqual({ kind: 'AlreadyInitialized', databaseName: created.databaseName });
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual({ key: 'current', databaseName: created.databaseName });
    expect(await databaseNames()).toEqual(['tj-root', created.databaseName]);
    expect(await restoreEntries()).toEqual([]);
    expect(await rawGet('tj-root', 'pointer', 'candidates')).toEqual(expect.objectContaining({ databaseNames: [] }));
  });

  it('should not delete the candidate when the pointer already names it', async () => {
    const restoring = persistence('r');
    const candidate = await restoring.createRestoreCandidate();
    if (candidate.kind === 'RuntimeNotWritable') throw new Error('not writable');
    expect(await restoring.activateFirstCandidate(candidate.databaseName)).toEqual({ kind: 'Activated' });

    const repeated = await restoring.activateFirstCandidate(candidate.databaseName);

    expect(repeated).toEqual({ kind: 'Activated' });
    expect(await rawGet('tj-root', 'pointer', 'current')).toEqual({ key: 'current', databaseName: candidate.databaseName });
    expect(await databaseNames()).toEqual(['tj-root', candidate.databaseName]);
    expect((await restoring.readSnapshot([], () => Promise.resolve(null))).binding.databaseName).toBe(candidate.databaseName);
  });
});
