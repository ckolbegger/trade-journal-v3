import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { Runtime, Store, type Root } from '../../src/infrastructure/storage';
import { Workspace } from '../../src/application/workspace';
import { ReferenceCatalog } from '../../src/domain/reference-catalog';
async function fixture() {
  const store = new Store(`d1-${crypto.randomUUID()}`);
  const runtime = new Runtime(store, { check: () => Promise.resolve({ transaction: true, capacity: true, control: true, inventory: true, protection: 'BestEffort' }), requestDurability: () => Promise.resolve('BestEffort') });
  const workspace = new Workspace(runtime);
  await workspace.initialize({ openingInstant: '2026-10-18T22:00:00Z', timeZone: 'UTC' });
  return { store, runtime, workspace, catalog: new ReferenceCatalog(store, runtime), root: (await store.roots.get('active')) as Root };
}
describe('real brokerage onboarding references', () => {
  it('should create Institution and Account with complete returned identities and onboarding', async () => {
    const f = await fixture();
    const institution = await f.catalog.save({ kind: 'Institution', label: 'Fidelity', generation: f.root.generation, expectedCatalogRevision: f.root.catalogRevision });
    expect(institution).toMatchObject({ status: 'Saved', record: { kind: 'Institution', label: 'Fidelity', active: true, origin: 'Trader' } });
    if (institution.status !== 'Saved') throw new Error('Institution failed');
    const account = await f.catalog.save({ kind: 'Account', label: 'Taxable', parentId: institution.record.id, generation: f.root.generation, expectedCatalogRevision: institution.catalogRevision });
    expect(account).toMatchObject({ status: 'Saved', record: { kind: 'Account', parentId: institution.record.id, label: 'Taxable' }, onboarding: 'ReadyForTradePlanning' });
    const queried = await f.catalog.query({ family: 'Institution' });
    expect(queried.status).toBe('Ready');
    expect(queried.records).toContainEqual(institution.record);
    f.store.close();
  });
});
it('should reject normalized duplicates, wrong or inactive parents and stale catalog without writes', async () => {
  const f = await fixture();
  const institution = await f.catalog.save({ kind: 'Institution', label: '  Élite   Broker ', generation: f.root.generation, expectedCatalogRevision: f.root.catalogRevision });
  if (institution.status !== 'Saved') throw new Error('Institution failed');
  const base = { generation: f.root.generation, expectedCatalogRevision: institution.catalogRevision };
  const before = await f.store.versions.toArray();
  expect(await f.catalog.save({ ...base, kind: 'Institution', label: 'e\u0301lite broker' })).toMatchObject({ status: 'Rejected', issues: ['DuplicateLabel'] });
  expect(await f.catalog.save({ ...base, kind: 'Account', label: 'Taxable', parentId: 'long-stock' })).toMatchObject({ status: 'Rejected', issues: ['SelectableInstitutionRequired'] });
  expect(await f.catalog.save({ ...base, kind: 'Institution', label: 'New', expectedCatalogRevision: 'stale' })).toMatchObject({ status: 'Conflict' });
  expect(await f.store.versions.toArray()).toEqual(before);
  expect(institution.record.label).toBe('  Élite   Broker ');
  f.store.close();
});
it('should resolve stable Account and Strategy under one snapshot and reject changed selection', async () => {
  const f = await fixture();
  const institution = await f.catalog.save({ kind: 'Institution', label: 'Broker', generation: f.root.generation, expectedCatalogRevision: f.root.catalogRevision });
  if (institution.status !== 'Saved') throw new Error('Institution failed');
  const account = await f.catalog.save({ kind: 'Account', label: 'Trading', parentId: institution.record.id, generation: f.root.generation, expectedCatalogRevision: institution.catalogRevision });
  if (account.status !== 'Saved') throw new Error('Account failed');
  expect(await f.catalog.resolve({ ids: [account.record.id, 'long-stock'], expectedCatalogRevision: account.catalogRevision, use: 'NewSelection' })).toMatchObject({ status: 'Resolved', records: [account.record, { id: 'long-stock', label: 'Long Stock' }], catalogRevision: account.catalogRevision });
  expect(await f.catalog.resolve({ ids: [account.record.id], expectedCatalogRevision: institution.catalogRevision, use: 'NewSelection' })).toMatchObject({ status: 'Conflict' });
  f.store.close();
});
it('should query one requested Catalog family under a bound snapshot', async () => {
  const f = await fixture();
  const institution = await f.catalog.save({ kind: 'Institution', label: 'Broker', generation: f.root.generation, expectedCatalogRevision: f.root.catalogRevision });
  if (institution.status !== 'Saved') throw new Error('Institution required');
  const result = await f.catalog.query({ family: 'Institution' });
  expect(result.records).toEqual([institution.record]);
  expect(result).toMatchObject({ catalogRevision: institution.catalogRevision, generation: f.root.generation });
  f.store.close();
});
it('should return StorageFailure and invalidate readiness after an aborted reference save', async () => {
  const f = await fixture();
  const before = await f.store.versions.toArray();
  const root = await f.store.roots.get('active');
  f.store.versions.hook('creating', (_key, value) => { if (value.kind === 'Institution') throw new DOMException('Injected reference abort', 'QuotaExceededError'); });
  expect(await f.catalog.save({ kind: 'Institution', label: 'Broker', generation: f.root.generation, expectedCatalogRevision: f.root.catalogRevision })).toMatchObject({ status: 'StorageFailure' });
  expect(f.runtime.current()).toMatchObject({ status: 'RuntimeNotWritable', failedChecks: ['transaction'] });
  expect(await f.store.roots.get('active')).toEqual(root);
  expect(await f.store.versions.toArray()).toEqual(before);
  f.store.close();
});
