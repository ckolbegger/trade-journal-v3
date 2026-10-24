import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { Store, Runtime, type RuntimeHost } from '../../src/infrastructure/storage';
import { Workspace } from '../../src/application/workspace';
import { TradeRecord } from '../../src/domain/trade-record';
import { Journal } from '../../src/domain/journal';
import { ReferenceCatalog } from '../../src/domain/reference-catalog';
import { TradeWorkflows } from '../../src/application/trade-workflows';
const path = '../../.cache/d1-fixture/d1-fixture.mjs';
const old = await import(path) as { Store: typeof Store; Runtime: typeof Runtime; Workspace: typeof Workspace; ReferenceCatalog: typeof ReferenceCatalog; TradeWorkflows: typeof TradeWorkflows; TradeRecord: typeof TradeRecord; Journal: typeof Journal };
const host: RuntimeHost = { check: async store => ({ transaction: await store.diagnosticTransaction(), capacity: true, control: true, inventory: true, protection: 'BestEffort' }), migrationCapacity: () => Promise.resolve(true), requestDurability: () => Promise.resolve('BestEffort') };
const instant = '2026-10-17T20:00:00Z';
async function d1() {
  const name = `d2-migration-${crypto.randomUUID()}`;
  const store = new old.Store(name); const runtime = new old.Runtime(store, host);
  const opened = await new old.Workspace(runtime).initialize({ openingInstant: instant, timeZone: 'America/New_York' });
  if (opened.status !== 'Opened') throw new Error('D1 initialization');
  const catalog = new old.ReferenceCatalog(store, runtime);
  const institution = await catalog.save({ kind: 'Institution', label: 'Real broker', generation: opened.root.generation, expectedCatalogRevision: opened.root.catalogRevision });
  if (institution.status !== 'Saved') throw new Error('D1 Institution');
  const account = await catalog.save({ kind: 'Account', label: 'Trading', parentId: institution.record.id, generation: opened.root.generation, expectedCatalogRevision: institution.catalogRevision });
  if (account.status !== 'Saved') throw new Error('D1 Account');
  const plan = await new old.TradeWorkflows(runtime, () => '2026-10-18T20:00:00Z').confirmPlan({ generation: opened.root.generation, expectedCatalogRevision: account.catalogRevision, definitionRevision: 'plan-reflection-v1', accountId: account.record.id, strategyId: 'long-stock', economicTime: instant, plan: { instrument: { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, quantity: '100', entry: '50', stop: '45', target: '60' }, reflection: { thesis: 'Thesis', invalidation: 'Invalidation' } });
  if (plan.status !== 'Confirmed') throw new Error('D1 confirmation');
  const before = await store.versions.toArray(); const root = await store.roots.get('active'); store.close();
  return { name, before, root, plan };
}
it('migrates actual historical command-created D1 data without changing any domain value or identity', async () => {
  const f = await d1(); const store = new Store(f.name); const runtime = new Runtime(store, host); const workspace = new Workspace(runtime);
  const opened = await workspace.initialize({ openingInstant: instant });
  expect(opened).toMatchObject({ status: 'Opened', root: { schema: 2 }, receipt: { migration: { from: 1, to: 2, sourceRows: 7, candidateRows: 9 } } });
  expect(await new TradeRecord(store).getRecord(f.plan.trade.tradeId)).toEqual(f.plan.trade);
  expect(await new Journal(store).query(f.plan.trade.tradeId)).toEqual([f.plan.entry]);
  expect(await store.versions.bulkGet(f.before.map(row => row.version))).toEqual(f.before);
  expect(await runtime.mutate(f.root?.generation, () => Promise.reject(new Error('stale apply')))).toEqual({ status: 'Conflict', reason: 'GenerationChanged' });
  expect(await workspace.getStatus()).toMatchObject({ status: 'Writable', workspaceStatus: 'Ready' });
  store.close();
});
it('preserves the complete D1 root/history on migration storage failure and retries safely', async () => {
  const f = await d1(); const store = new Store(f.name); const runtime = new Runtime(store, host); const workspace = new Workspace(runtime);
  const fail = () => { throw new Error('Injected candidate storage failure'); };
  store.versions.hook('creating', fail);
  expect(await workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'MigrationBlocked', reason: 'StorageFailure' });
  expect(await store.roots.get('active')).toEqual(f.root);
  expect(await store.versions.bulkGet(f.before.map(row => row.version))).toEqual(f.before);
  store.versions.hook('creating').unsubscribe(fail);
  expect(await workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'Opened', root: { schema: 2 } });
  store.close();
});

it('leaves D1 active after activation abort, cleans orphan staging on retry and preserves stable Catalog versions', async () => {
  const f = await d1(); const store = new Store(f.name); const runtime = new Runtime(store, host); const workspace = new Workspace(runtime);
  const fail = () => { throw new Error('Injected activation abort'); };
  store.roots.hook('updating', fail);
  expect(await workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'MigrationBlocked' });
  expect(await store.roots.get('active')).toEqual(f.root);
  expect(await new TradeRecord(store).getRecord(f.plan.trade.tradeId)).toEqual(f.plan.trade);
  store.roots.hook('updating').unsubscribe(fail);
  const before = await new ReferenceCatalog(store).query({ family: 'Account' });
  expect(await workspace.initialize({ openingInstant: instant })).toMatchObject({ status: 'Opened' });
  const after = await new ReferenceCatalog(store).query({ family: 'Account' });
  expect(after.records).toEqual(before.records);
  expect(await store.projections.where('key').startsWith('migration-staging:').count()).toBe(0);
  store.close();
});
it('rejects invalid populated source and missing migration headroom without touching old authority', async () => {
  const f = await d1(); const store = new Store(f.name);
  const runtime = new Runtime(store, { ...host, migrationCapacity: () => Promise.resolve(false) });
  expect(await new Workspace(runtime).initialize({ openingInstant: instant })).toMatchObject({ status: 'MigrationBlocked', reason: 'MigrationCapacity' });
  expect(await store.roots.get('active')).toEqual(f.root);
  expect(await store.versions.toArray()).toEqual(f.before);
  // Controlled invalid-history fixture; this is not normal domain creation.
  await store.lifecycle.update(`${f.root?.generation}:${f.plan.trade.tradeId}`, { lifecycle: 'Open' });
  const before = await store.versions.toArray();
  expect(await new Workspace(new Runtime(store, host)).initialize({ openingInstant: instant })).toMatchObject({ status: 'MigrationBlocked', reason: 'InvalidSource' });
  expect(await store.versions.toArray()).toEqual(before);
  expect(await store.roots.get('active')).toEqual(f.root);
  store.close();
});
it('rejects every ordinary mutation against an unmigrated D1 generation while preserving readable history', async () => {
  const f = await d1(); const store = new Store(f.name);
  const runtime = new Runtime(store, { ...host, migrationCapacity: () => Promise.resolve(false) });
  expect(await new Workspace(runtime).initialize({ openingInstant: instant })).toMatchObject({ status: 'MigrationBlocked' });
  const before = await store.roots.get('active');
  expect(await runtime.mutate(f.root?.generation, () => Promise.resolve({ status: 'WronglyAccepted' }))).toMatchObject({ status: 'RuntimeNotWritable', runtimeReadiness: 'RecoveryOnly', failedChecks: ['MigrationRequired'] });
  expect(await store.roots.get('active')).toEqual(before);
  expect(await new TradeRecord(store).history(f.plan.trade.tradeId)).toEqual([f.plan.trade]);
  store.close();
});
it('rejects contradictory retained Journal semantics rather than sealing an invalid source candidate', async () => {
  const f = await d1(); const store = new Store(f.name); const entry = f.plan.entry;
  await store.versions.update(entry.version, { value: { ...entry, responses: { ...entry.responses, thesis: { kind: 'Text', value: 'Contradicts the frozen Plan' } } } });
  const before = await store.versions.toArray();
  expect(await new Workspace(new Runtime(store, host)).initialize({ openingInstant: instant })).toMatchObject({ status: 'MigrationBlocked', reason: 'InvalidSource' });
  expect(await store.roots.get('active')).toEqual(f.root); expect(await store.versions.toArray()).toEqual(before);
  store.close();
});
it('returns a bounded no-write result when a real old connection blocks physical upgrade', async () => {
  const f = await d1();
  const held = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(f.name); request.onerror = () => reject(request.error ?? new Error('Held open failed')); request.onsuccess = () => resolve(request.result); });
  held.onversionchange = () => {};
  const store = new Store(f.name); const workspace = new Workspace(new Runtime(store, host));
  const pending = workspace.initialize({ openingInstant: instant });
  const result = await Promise.race([pending, new Promise<{ status: 'BlockedTimeout' }>(resolve => setTimeout(() => resolve({ status: 'BlockedTimeout' }), 250))]);
  held.close();
  await pending;
  expect(result).toMatchObject({ status: 'RuntimeNotWritable', workspaceStatus: 'IntegrityBlocked' });
  store.close();
});
