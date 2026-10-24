import { Workspace } from '../src/application/workspace';
import { Store, Runtime } from '../src/infrastructure/storage';
import { BrowserHost } from '../src/infrastructure/browser-host';
import { TradeWorkflows } from '../src/application/trade-workflows';
import { TradeViewsAndReporting } from '../src/application/trade-views-and-reporting';
import { Journal } from '../src/domain/journal';
async function openDataset(count: number) {
  const store = new Store('trade-journal-v3'); const runtime = new Runtime(store, new BrowserHost());
  try {
    const views = new TradeViewsAndReporting(store); const openingInstant = new Date().toISOString(); const workflows = new TradeWorkflows(runtime, () => openingInstant); const journal = new Journal(store, runtime);
    const selected: string[] = []; let cursor: string | undefined;
    do { const page = await views.browseTrades({ cursor }); if (page.status !== 'Ready') throw new Error(`Plan selection ${page.status}`); selected.push(...page.items.map(item => item.trade.tradeId)); cursor = page.nextCursor; } while (selected.length < count && cursor);
    const receipts: unknown[] = [];
    for (const [index, id] of selected.slice(0, count).entries()) {
      const detail = await views.getTradeDetail(id); if (detail.status !== 'Ready') throw new Error(`Plan detail ${detail.status}`);
      const root = await store.roots.get('active'); if (!root) throw new Error('Workspace required');
      const kind = (['Complete', 'Defer', 'Decline'] as const)[index % 3] ?? 'Complete';
      const result = await workflows.recordPositionChange({ kind: 'InitialStockEntry', generation: root.generation, expectedWorkspaceRevision: root.revision, expectedCatalogRevision: root.catalogRevision, tradeId: id, expectedTradeRevision: detail.trade.revision, plannedLegId: detail.trade.plannedLegId, definitionRevision: 'position-change-reflection-v1', economicTime: openingInstant, executions: [{ quantity: '40', price: '49', fee: '1' }, { quantity: '60', price: '51', fee: '2' }].map(execution => ({ ...execution, instrument: detail.trade.plan.instrument ?? { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, action: 'Buy', plannedLegId: detail.trade.plannedLegId, economicTime: openingInstant })), reflection: kind === 'Complete' ? { kind, answers: { 'decision-mode': 'as-planned', emotion: 'calm', confidence: '4' } } : { kind } });
      if (result.status !== 'Recorded') throw new Error(`Opening ${index} ${JSON.stringify(result)}`);
      receipts.push(result.receipt);
      if (kind === 'Defer' && index % 6 === 1) {
        const settlement = await journal.save({ kind: 'ResolveDebt', generation: root.generation, expectedWorkspaceRevision: result.workspaceRevision, obligationId: result.journalOutcome.obligation.id, expectedRevision: result.journalOutcome.obligation.revision, disposition: { kind: 'Complete', answers: { 'decision-mode': 'as-planned', emotion: 'calm', confidence: '5' } } });
        if (settlement.status !== 'Saved') throw new Error(`Debt ${index} ${settlement.status}`);
      }
    }
    return { count: selected.slice(0, count).length, receipts, counts: await counts(store) };
  } finally { store.close(); }
}
async function counts(store: Store) {
  const root = await store.roots.get('active'); if (!root) throw new Error('Workspace required');
  const kinds = ['Plan', 'Execution', 'PositionChange', 'Agreement', 'TradeState', 'JournalEntry', 'JournalDecline', 'JournalObligation'];
  return Object.fromEntries(await Promise.all(kinds.map(async kind => [kind, await store.versions.where('[generation+kind]').equals([root.generation, kind]).count()] as const)));
}
async function inspectOpen() {
  const store = new Store('trade-journal-v3');
  try {
    const views = new TradeViewsAndReporting(store); const items: unknown[] = []; let cursor: string | undefined;
    do {
      const page = await views.browseTrades({ lifecycle: 'Open', cursor });
      if (page.status !== 'Ready' && page.status !== 'Empty') throw new Error(`Open read ${page.status}`);
      for (const item of page.items) {
        if (item.status !== 'Derived' || !('quantity' in item) || item.quantity !== '100' || item.grossBasis !== '5020' || item.openingFees !== '3' || item.entryQuality.risk !== '523' || item.trade.lifecycle !== 'Open') throw new Error('Open correctness disagreement');
        items.push(item);
      }
      cursor = page.nextCursor;
    } while (cursor);
    const debt = await new Journal(store).query({ scope: 'Outstanding' });
    return { items, debt: debt.obligations, counts: await counts(store) };
  } finally { store.close(); }
}
async function d1Digest() {
  const store = new Store('trade-journal-v3');
  try {
    const snapshot = await store.transaction('r', [store.roots, store.versions, store.lifecycle], async () => {
      const root = await store.roots.get('active'); if (!root) throw new Error('Workspace required');
      const rows = (await Promise.all(['Plan', 'JournalEntry', 'Institution', 'Account', 'Strategy', 'Definition', 'Source'].map(kind => store.versions.where('[generation+kind]').equals([root.generation, kind]).toArray()))).flat().filter(row => !['position-change-reflection', 'position-change'].includes(row.id));
      rows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.kind.localeCompare(b.kind));
      const membership = await store.lifecycle.where('[generation+tradeId]').between([root.generation, ''], [root.generation, '\uffff']).toArray();
      return { root, rows: rows.map(({ id, kind, tradeId, economicTime, saveTime, sequence, commitOrdinal, value }) => ({ id, kind, tradeId, economicTime, saveTime, sequence, commitOrdinal, value })), membership: membership.map(({ tradeId, lifecycle, accountId, symbol, economicTime, economicOrder, sequence, revision }) => ({ tradeId, lifecycle, accountId, symbol, economicTime, economicOrder, sequence, revision })) };
    });
    const bytes = new TextEncoder().encode(JSON.stringify({ rows: snapshot.rows, membership: snapshot.membership }));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
    return { digest, serializedBytes: bytes.length, count: snapshot.rows.length, membership: snapshot.membership.length, root: snapshot.root, storage: await navigator.storage.estimate() };
  } finally { store.close(); }
}
async function oldD1Digest() {
  // Raw read-only evidence reader for a physical D1 database: opening a D2 Store
  // would itself request a physical upgrade before the update flow under test.
  return new Promise<{ root: unknown; rows: unknown[]; membership: unknown[] }>((resolve, reject) => {
    const request = indexedDB.open('trade-journal-v3'); request.onerror = () => reject(request.error ?? new Error('D1 read failed'));
    request.onsuccess = () => { const db = request.result; const tx = db.transaction(['roots', 'versions', 'lifecycle']); const roots = tx.objectStore('roots').get('active'); const versions = tx.objectStore('versions').getAll(); const membership = tx.objectStore('lifecycle').getAll(); tx.oncomplete = () => { resolve({ root: roots.result as unknown, rows: versions.result as unknown[], membership: membership.result as unknown[] }); db.close(); }; };
  });
}
async function migrateDatabase(name: string) {
  const store = new Store(name);
  try { return await new Workspace(new Runtime(store, new BrowserHost())).initialize({ openingInstant: '2026-10-21T20:00:00Z' }); } finally { store.close(); }
}
declare global { interface Window { d2Evidence: { releaseId: string; migrateDatabase: typeof migrateDatabase; openDataset: typeof openDataset; inspectOpen: typeof inspectOpen; d1Digest: typeof d1Digest; oldD1Digest: typeof oldD1Digest } } }
window.d2Evidence = { releaseId: __RELEASE_ID__, migrateDatabase, openDataset, inspectOpen, d1Digest, oldD1Digest };
