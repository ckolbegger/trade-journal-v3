import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { Runtime, Store, type HostChecks, type RuntimeHost } from '../../src/infrastructure/storage';
import { Workspace } from '../../src/application/workspace';
const passing: HostChecks = { transaction: true, capacity: true, control: true, inventory: true, protection: 'BestEffort' };
function fixture() {
  let checks = { ...passing };
  const store = new Store(`d1-${crypto.randomUUID()}`);
  const host: RuntimeHost = { check: () => Promise.resolve(checks), requestDurability: () => Promise.resolve(checks.protection) };
  const runtime = new Runtime(store, host);
  return { store, runtime, workspace: new Workspace(runtime), set: (patch: Partial<HostChecks>) => { checks = { ...checks, ...patch }; } };
}
describe('functional Runtime Readiness', () => {
  it('should allow Writable with advisory BestEffort or Unavailable protection', async () => {
    const f = fixture();
    expect(await f.workspace.getStatus()).toMatchObject({ status: 'Writable', protection: 'BestEffort' });
    f.set({ protection: 'Unavailable' });
    expect(await f.workspace.getStatus()).toMatchObject({ status: 'Writable', protection: 'Unavailable' });
    f.store.close();
  });
});
it('should report each failure and simultaneous failures without creating authoritative data', async () => {
  for (const failures of [['transaction'], ['capacity'], ['control'], ['inventory'], ['capacity', 'inventory']]) {
    const f = fixture();
    f.set(Object.fromEntries(failures.map(key => [key, false])));
    expect(await f.workspace.getStatus()).toMatchObject({ status: 'RuntimeNotWritable', runtimeReadiness: 'Unsupported', failedChecks: failures, workspaceStatus: 'None' });
    expect(await f.runtime.mutate(undefined, () => Promise.reject(new Error('Must not run')))).toMatchObject({ status: 'RuntimeNotWritable' });
    expect(await f.store.roots.count()).toBe(0);
    expect(await f.store.versions.count()).toBe(0);
    f.store.close();
  }
});

it('should preserve readable recovery and reject every mutation at persistence', async () => {
  const f = fixture();
  const initialized = await f.workspace.initialize({ openingInstant: '2026-10-18T22:00:00Z', timeZone: 'America/New_York' });
  if (initialized.status !== 'Opened') throw new Error('Workspace required');
  f.set({ inventory: false });
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', workspaceStatus: 'RecoveryOnly', failedChecks: ['inventory'] });
  expect(await f.runtime.mutate(initialized.root.generation, () => Promise.reject(new Error('Must not run')))).toMatchObject({ status: 'RuntimeNotWritable' });
  expect(await f.store.versions.count()).toBe(5);
  f.store.close();
});
it('should block an unreadable possible root even when host checks pass', async () => {
  const f = fixture();
  vi.spyOn(f.store, 'inspect').mockResolvedValue({ status: 'IntegrityBlocked' });
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'RuntimeNotWritable', runtimeReadiness: 'Unsupported', workspaceStatus: 'IntegrityBlocked', failedChecks: ['UnreadableRoot'] });
  expect(await f.runtime.mutate(undefined, () => Promise.reject(new Error('Must not run')))).toMatchObject({ status: 'RuntimeNotWritable' });
  f.store.close();
});
it('should recheck each launch and invalidate the next mutation after a runtime failure', async () => {
  const f = fixture();
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'Writable', epoch: 1 });
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'Writable', epoch: 2 });
  f.set({ transaction: false, control: false });
  f.runtime.invalidate('transaction');
  expect(f.runtime.current()).toMatchObject({ status: 'RuntimeNotWritable', failedChecks: ['transaction'] });
  expect(await f.runtime.mutate(undefined, () => Promise.resolve('unsafe'))).toMatchObject({ status: 'RuntimeNotWritable', failedChecks: ['transaction', 'control'] });
  expect(f.runtime.current()).toMatchObject({ status: 'RuntimeNotWritable' });
  f.set({ transaction: true, control: true });
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'Writable' });
  f.store.close();
});

it('should report explicit durability outcomes without authoritative changes', async () => {
  const f = fixture();
  expect(await f.workspace.requestDurability()).toEqual({ status: 'NotImproved', currentProtection: 'BestEffort' });
  f.set({ protection: 'Protected' });
  expect(await f.workspace.requestDurability()).toEqual({ status: 'AlreadyProtected', currentProtection: 'Protected' });
  f.set({ protection: 'BestEffort' });
  vi.spyOn(f.runtime.host, 'requestDurability').mockResolvedValue('Protected');
  expect(await f.workspace.requestDurability()).toEqual({ status: 'Improved', currentProtection: 'Protected' });
  expect(await f.store.versions.count()).toBe(0);
  f.store.close();
});
