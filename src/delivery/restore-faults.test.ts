// The backup and Restore fault stages of the faults build (D8 T8.15), driven by `?faults=`.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInProcessExportPort } from '../coordinators/workspace/backup-export.ts';
import { targetWorkspace, workspaceOf } from '../coordinators/workspace/restore-test-support.ts';
import { IDBFactory } from 'fake-indexeddb';
import { testStack } from '../../tests/support/stack.ts';

// Each case is a fresh launch: the faults module reads the query on first use, so it is reloaded.
async function launch(query: string) {
  vi.resetModules();
  const stub = { location: { search: query } } as unknown as Window & typeof globalThis;
  vi.stubGlobal('window', stub);
  return { faults: await import('./faults.ts'), window: stub };
}

// Clears every store of the journal database except `meta`, leaving the schema and content records in place.
async function emptyEveryStore(factory: IDBFactory) {
  const names = (await factory.databases()).map((info) => info.name!).filter((name) => name !== 'tj-root');
  for (const name of names) {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(name);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('open failed'));
    });
    const stores = Array.from(db.objectStoreNames).filter((store) => store !== 'meta');
    const tx = db.transaction(stores, 'readwrite');
    for (const store of stores) tx.objectStore(store).clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('clear failed'));
    });
    db.close();
  }
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => vi.unstubAllGlobals());

describe('restore and backup fault stages (T8.15)', () => {
  it('should name the faulted store only for its own module when restore:apply:store is active', async () => {
    const { faults } = await launch('?faults=restore:apply:journalEntries');

    const hooks = faults.restoreFaults();

    expect(hooks.recheck?.(['journalTypes', 'journalEntries'])).toBe('journalEntries');
    expect(hooks.recheck?.(['trades'])).toBeUndefined();
  });

  it('should abort the activation only when restore:activate is active', async () => {
    const active = (await launch('?faults=restore:activate')).faults.restoreFaults();
    const idle = (await launch('?faults=')).faults.restoreFaults();

    expect(() => active.activating?.()).toThrow('injected fault: restore:activate');
    expect(() => idle.activating?.()).not.toThrow();
  });

  it('should hold preparation until release when restore:hold-prepare is active, and not hold apply', async () => {
    const { faults, window } = await launch('?faults=restore:hold-prepare');
    const hooks = faults.restoreFaults();
    let prepared = false;
    let activated = false;
    void hooks.staged?.().then(() => (prepared = true));
    void hooks.activated?.().then(() => (activated = true));

    await settled();
    expect([prepared, activated]).toEqual([false, true]);
    window.__tjFaults?.release();
    await settled();

    expect(prepared).toBe(true);
  });

  it('should hold apply after the pointer switch until release when restore:hold-activated is active', async () => {
    const { faults, window } = await launch('?faults=restore:hold-activated');
    const hooks = faults.restoreFaults();
    let activated = false;
    void hooks.activated?.().then(() => (activated = true));

    await settled();
    expect(activated).toBe(false);
    window.__tjFaults?.release();
    await settled();

    expect(activated).toBe(true);
  });

  it('should fail the export snapshot read at its first batch when backup:read is active, offering nothing', async () => {
    const { faults } = await launch('?faults=backup:read');
    const target = await targetWorkspace();
    const port = faults.faultyExportPort(createInProcessExportPort(target.persistence), target.factory);
    const workspace = workspaceOf(target, { backup: { download: target.testHost.downloads.port, export: port } });

    const result = await workspace.exportBackup({});

    expect(result).toMatchObject({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', detail: { stage: 'Read', message: 'injected fault: backup:read' } });
    expect(target.testHost.downloads.offered).toHaveLength(0);
  });

  it('should fail the export read when every store is empty under backup:read', async () => {
    const { faults } = await launch('?faults=backup:read');
    const empty = await testStack(new IDBFactory());
    const initialized = await workspaceOf(empty).initialize({ timeZone: 'America/Chicago' });
    if (initialized.kind !== 'Opened') throw new Error(`expected Opened, got ${initialized.kind}`);
    await emptyEveryStore(empty.factory);
    const port = faults.faultyExportPort(createInProcessExportPort(empty.persistence), empty.factory);
    const workspace = workspaceOf(empty, { backup: { download: empty.testHost.downloads.port, export: port } });

    const result = await workspace.exportBackup({});

    expect(result).toMatchObject({ kind: 'NotCompleted', stage: 'Read', reason: 'ReadFailed', detail: { message: 'injected fault: backup:read' } });
    expect(empty.testHost.downloads.offered).toHaveLength(0);
  });

  it('should pass the export through unchanged when backup:read is not active', async () => {
    const { faults } = await launch('?faults=');
    const target = await targetWorkspace();
    const port = faults.faultyExportPort(createInProcessExportPort(target.persistence), target.factory);
    const workspace = workspaceOf(target, { backup: { download: target.testHost.downloads.port, export: port } });

    expect((await workspace.exportBackup({})).kind).toBe('Downloaded');
  });
});
