import './d02-browser-generator';
import { Store, Runtime } from '../src/infrastructure/storage';
import { BrowserHost } from '../src/infrastructure/browser-host';
import { Workspace } from '../src/application/workspace';
import { TradeWorkflows } from '../src/application/trade-workflows';
import { TradeViewsAndReporting } from '../src/application/trade-views-and-reporting';
import { ReferenceCatalog } from '../src/domain/reference-catalog';
interface DatasetReceipt { count: number; serializedBytes: number; elapsedMs: number; samples: string[]; storage: StorageEstimate; readiness: Awaited<ReturnType<Workspace['getStatus']>>; counts: Record<string, number> }
async function generate(count: number): Promise<DatasetReceipt> {
  const store = new Store('trade-journal-v3');
  const runtime = new Runtime(store, new BrowserHost());
  const opened = await new Workspace(runtime).initialize({ openingInstant: '2026-10-18T22:00:00Z', timeZone: 'America/New_York' });
  if (opened.status !== 'Opened') throw new Error(`Dataset initialization: ${opened.status}`);
  const catalog = await new ReferenceCatalog(store).query({ family: 'Account' });
  const account = catalog.records.find(record => record.kind === 'Account' && record.active);
  if (!account || catalog.status !== 'Ready') throw new Error('Command-created Account required');
  const workflows = new TradeWorkflows(runtime, () => '2026-10-18T23:00:00Z');
  const start = performance.now(); let serializedBytes = 0; const samples: string[] = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(Date.UTC(2021, 0, 4 + Math.floor(i / 20) * 7 / 5));
    const result = await workflows.confirmPlan({ generation: opened.root.generation, expectedCatalogRevision: catalog.catalogRevision, definitionRevision: opened.root.definitionRevision, accountId: account.id, strategyId: 'long-stock', economicTime: date.toISOString(), plan: { instrument: { kind: 'Stock', currency: 'USD', symbol: ['XYZ', 'ABC', 'DEF'][i % 3] ?? 'XYZ' }, quantity: '100', entry: '50', stop: '45', target: '60' }, reflection: { thesis: `Deterministic D1 Plan ${i}: earnings thesis`, invalidation: `Earnings evidence reverses for Plan ${i}`, conviction: String(1 + i % 5), emotion: 'calm' } });
    if (result.status !== 'Confirmed') throw new Error(`Dataset command ${i}: ${result.status}`);
    serializedBytes += new TextEncoder().encode(JSON.stringify(result.trade) + JSON.stringify(result.entry)).byteLength;
    if (i === 0 || i === Math.floor(count / 2) || i === count - 1) samples.push(result.trade.tradeId);
    if ((i + 1) % 1000 === 0) console.log(`D1 command-created Plans: ${i + 1}; elapsed ${Math.round(performance.now() - start)} ms`);
  }
  const storage = await navigator.storage.estimate();
  const readiness = await new Workspace(runtime).getStatus();
  const counts = { plans: await store.versions.where('[generation+kind]').equals([opened.root.generation, 'Plan']).count(), entries: await store.versions.where('[generation+kind]').equals([opened.root.generation, 'JournalEntry']).count(), lifecycle: await store.lifecycle.count(), versions: await store.versions.count() };
  store.close();
  return { count, serializedBytes, elapsedMs: performance.now() - start, samples, storage, readiness, counts };
}
async function inspect() {
  const store = new Store('trade-journal-v3');
  const views = new TradeViewsAndReporting(store);
  let count = 0; let cursor: string | undefined; let first: string | undefined;
  do {
    const page = await views.browseTrades({ cursor });
    if (page.status !== 'Ready' && page.status !== 'Empty') throw new Error(`Dataset read: ${page.status}`);
    if (!first) first = page.items[0]?.trade.tradeId;
    for (const item of page.items) if (item.trade.baseline.oneR !== '500' || item.entryReadiness !== 'Unfilled') throw new Error('Dataset correctness mismatch');
    count += page.items.length; cursor = page.nextCursor;
  } while (cursor);
  const detail = first ? await views.getTradeDetail(first) : undefined;
  store.close();
  return { count, first, detail };
}
async function measure() {
  const store = new Store('trade-journal-v3');
  try { return await new Workspace(new Runtime(store, new BrowserHost())).getStatus(); }
  finally { store.close(); }
}
async function discardPrivateReceipts() {
  const store = new Store('trade-journal-v3');
  try { await store.projections.clear(); } finally { store.close(); }
}
declare global { interface Window { d1Evidence: { generate: typeof generate; inspect: typeof inspect; measure: typeof measure; discardPrivateReceipts: typeof discardPrivateReceipts } } }
window.d1Evidence = { generate, inspect, measure, discardPrivateReceipts };
