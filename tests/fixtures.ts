import { Store, Runtime, type Root } from '../src/infrastructure/storage';
import { Workspace } from '../src/application/workspace';
import { ReferenceCatalog } from '../src/domain/reference-catalog';
import { TradeWorkflows, type ConfirmPlanCommand } from '../src/application/trade-workflows';
export const economicTime = '2026-10-17T20:00:00Z';
export const saveTime = '2026-10-18T23:00:00Z';
export async function workspaceFixture() {
  const store = new Store(`d1-${crypto.randomUUID()}`);
  const runtime = new Runtime(store, { check: () => Promise.resolve({ transaction: true, capacity: true, control: true, inventory: true, protection: 'BestEffort' }), requestDurability: () => Promise.resolve('BestEffort') });
  const workspace = new Workspace(runtime);
  await workspace.initialize({ openingInstant: saveTime, timeZone: 'America/New_York' });
  const catalog = new ReferenceCatalog(store, runtime);
  const root = (await store.roots.get('active')) as Root;
  const institution = await catalog.save({ kind: 'Institution', label: 'Broker', generation: root.generation, expectedCatalogRevision: root.catalogRevision });
  if (institution.status !== 'Saved') throw new Error('Institution fixture failed');
  const account = await catalog.save({ kind: 'Account', label: 'Trading', parentId: institution.record.id, generation: root.generation, expectedCatalogRevision: institution.catalogRevision });
  if (account.status !== 'Saved') throw new Error('Account fixture failed');
  const command: ConfirmPlanCommand = { generation: root.generation, expectedCatalogRevision: account.catalogRevision, definitionRevision: root.definitionRevision, accountId: account.record.id, strategyId: 'long-stock', economicTime, plan: { instrument: { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, quantity: '100', entry: '50', stop: '45', target: '60' }, reflection: { thesis: 'Improving earnings', invalidation: 'Thesis fails' } };
  return { store, runtime, workspace, catalog, command, workflows: new TradeWorkflows(runtime, () => saveTime) };
}
