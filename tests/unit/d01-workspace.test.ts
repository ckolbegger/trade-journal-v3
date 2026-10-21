import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { Runtime, Store, type RuntimeHost } from '../../src/infrastructure/storage';
import { Workspace } from '../../src/application/workspace';
const host: RuntimeHost = { check: () => Promise.resolve({ transaction: true, capacity: true, control: true, inventory: true, protection: 'BestEffort' }), requestDurability: () => Promise.resolve('BestEffort') };
const instant = '2026-10-18T22:00:00Z';
function fixture() {
  const store = new Store(`d1-${crypto.randomUUID()}`);
  return { store, workspace: new Workspace(new Runtime(store, host)) };
}
describe('atomic initialized Workspace', () => {
  it('should initialize only D1 seeds and return onboarding from the committed result', async () => {
    const f = fixture();
    const result = await f.workspace.initialize({ openingInstant: instant, timeZone: 'America/New_York' });
    expect(result).toMatchObject({ status: 'Opened', onboarding: 'NeedsInstitutionAndAccount', root: { timeZone: 'America/New_York', schema: 1 }, receipt: { fresh: true, seeds: ['long-stock', 'plan-reflection', 'plan-confirmation'] } });
    expect((await f.store.versions.toArray()).map(row => row.kind).sort()).toEqual(['Definition', 'Source', 'Strategy']);
    f.store.close();
  });
});
it('should require a rules-based time zone and preserve explicit instants', async () => {
  const f = fixture();
  expect(await f.workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'TimeZoneSelectionRequired' });
  expect(await f.workspace.initialize({ openingInstant: instant, timeZone: '-05:00' })).toMatchObject({ status: 'TimeZoneSelectionRequired' });
  expect(await f.workspace.initialize({ openingInstant: instant, timeZone: 'Invalid/Zone' })).toMatchObject({ status: 'TimeZoneSelectionRequired' });
  expect(await f.store.roots.count()).toBe(0);
  const saved = await f.workspace.initialize({ openingInstant: instant, timeZone: 'America/Los_Angeles' });
  expect(saved).toMatchObject({ status: 'Opened', root: { timeZone: 'America/Los_Angeles' } });
  expect((await f.store.versions.toArray()).every(row => row.saveTime === instant)).toBe(true);
  f.store.close();
});
it('should reopen idempotently with stable seeds and unchanged metadata', async () => {
  const f = fixture();
  const first = await f.workspace.initialize({ openingInstant: instant, timeZone: 'America/New_York' });
  const before = await f.store.versions.toArray();
  const second = await f.workspace.initialize({ openingInstant: '2026-10-19T01:00:00Z', timeZone: 'UTC' });
  expect(second).toMatchObject({ ...first, receipt: { fresh: false, seeds: [] } });
  expect(await f.store.versions.toArray()).toEqual(before);
  f.store.close();
});

it('should roll back metadata and both seeds after storage failure and return SeedConflict', async () => {
  const f = fixture();
  const original = f.store.versions.add.bind(f.store.versions);
  let calls = 0;
  vi.spyOn(f.store.versions, 'add').mockImplementation((...args) => { if (++calls === 2) return Promise.reject(new Error('SeedConflict')) as ReturnType<typeof original>; return original(...args); });
  expect(await f.workspace.initialize({ openingInstant: instant, timeZone: 'UTC' })).toMatchObject({ status: 'SeedConflict' });
  expect(await f.store.roots.count()).toBe(0);
  expect(await f.store.versions.count()).toBe(0);
  f.store.close();
});
it('should reject unknown newer and integrity-invalid roots unchanged', async () => {
  const f = fixture();
  await f.workspace.initialize({ openingInstant: instant, timeZone: 'UTC' });
  // Controlled integrity fixture: change only the declared schema compatibility byte.
  await f.store.roots.update('active', { schema: 999 });
  const before = await f.store.roots.get('active');
  expect(await f.workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'RuntimeNotWritable', workspaceStatus: 'IntegrityBlocked', failedChecks: ['UnsupportedSchema'] });
  expect(await f.store.roots.get('active')).toEqual(before);
  await f.store.roots.update('active', { schema: 1, timeZone: 'Invalid/Zone' });
  expect(await f.workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'RuntimeNotWritable', workspaceStatus: 'IntegrityBlocked', failedChecks: ['InvalidRoot'] });
  f.store.close();
});
it('should publish complete generation and reject a stale generation before mutation', async () => {
  const f = fixture();
  const opened = await f.workspace.initialize({ openingInstant: instant, timeZone: 'UTC' });
  expect(opened).toMatchObject({ status: 'Opened', receipt: { candidateSealed: true, authoritativeCount: 3 } });
  const before = await f.store.versions.toArray();
  expect(await f.workspace.runtime.mutate('retired-generation', () => Promise.reject(new Error('Must not run')))).toEqual({ status: 'Conflict', reason: 'GenerationChanged' });
  expect(await f.store.versions.toArray()).toEqual(before);
  f.store.close();
});
it('should block reopening incomplete authoritative data without publishing Ready or repairing it', async () => {
  const f = fixture();
  const opened = await f.workspace.initialize({ openingInstant: instant, timeZone: 'UTC' });
  if (opened.status !== 'Opened') throw new Error('Workspace required');
  await f.store.versions.delete(`${opened.root.generation}:plan-reflection-v1`);
  const before = await f.store.versions.toArray();
  expect(await f.workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'IntegrityBlocked' });
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'RuntimeNotWritable', workspaceStatus: 'IntegrityBlocked', failedChecks: ['InvalidRoot'] });
  expect(await f.store.versions.toArray()).toEqual(before);
  f.store.close();
});
it('should retain a bounded measured size receipt and safely disregard a deleted private receipt', async () => {
  const f = fixture();
  await f.workspace.initialize({ openingInstant: instant, timeZone: 'UTC' });
  const status = await f.workspace.getStatus();
  expect(status).toMatchObject({ status: 'Writable', storageMeasurement: { method: 'SerializedActiveLowerBound' } });
  if (!('storageMeasurement' in status)) throw new Error('Measurement required');
  expect(status.storageMeasurement.activeSerializedBytes).toBeGreaterThan(1000);
  const root = await f.store.roots.get('active');
  await f.store.projections.clear();
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'Writable', storageMeasurement: { activeSerializedBytes: 0, method: 'UnmeasuredConservative' } });
  expect(await f.store.roots.get('active')).toEqual(root);
  f.store.close();
});
it('should bind an existing initialization receipt to the complete retained authoritative count', async () => {
  const { workspaceFixture } = await import('../fixtures');
  const f = await workspaceFixture();
  await f.workflows.confirmPlan(f.command);
  expect(await f.workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'Opened', receipt: { fresh: false, authoritativeCount: 7 }, root: { recordedSequence: 1 } });
  f.store.close();
});
it('should report integrity failure together with failed readiness instead of opening invalid recovery data', async () => {
  const { workspaceFixture } = await import('../fixtures');
  const f = await workspaceFixture();
  await f.store.roots.update('active', { timeZone: 'Invalid/Zone' });
  const before = await f.store.roots.get('active');
  vi.spyOn(f.runtime.host, 'check').mockResolvedValue({ transaction: true, capacity: true, control: true, inventory: false, protection: 'BestEffort' });
  expect(await f.workspace.getStatus()).toMatchObject({ status: 'RuntimeNotWritable', workspaceStatus: 'IntegrityBlocked', failedChecks: ['inventory', 'InvalidRoot'] });
  expect(await f.store.roots.get('active')).toEqual(before);
  f.store.close();
});
it('should preserve complete RuntimeNotWritable context from initialization when root validation fails', async () => {
  const f = fixture();
  await f.workspace.initialize({ openingInstant: instant, timeZone: 'UTC' });
  await f.store.roots.update('active', { timeZone: 'Invalid/Zone' });
  expect(await f.workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'RuntimeNotWritable', runtimeReadiness: 'Unsupported', workspaceStatus: 'IntegrityBlocked', failedChecks: ['InvalidRoot'], safeActions: ['Retry', 'Try another browser; its storage is separate'] });
  f.store.close();
});
