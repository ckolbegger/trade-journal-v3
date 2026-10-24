import { RecordIntegrityError, TradeRecord, type TradeSnapshot } from '../../domain/trade-record';
import { Journal } from '../../domain/journal';
import { queryPlanningCatalog } from '../../domain/reference-catalog';
import { derive } from '../../domain/trade-analysis';
import type { Store } from '../../infrastructure/storage';
function analyze(trade: TradeSnapshot) {
  return derive({ candidateId: trade.opening ? trade.tradeId : trade.planFactId, digest: JSON.stringify(trade.plan), revision: trade.revision, plan: trade.plan, storedLifecycle: trade.lifecycle, exposureFacts: [], opening: trade.opening });
}
export class TradeViewsAndReporting {
  constructor(readonly store: Store) {}
  async browseTrades(request: { cursor?: string; accountIds?: string[]; symbols?: string[]; lifecycle?: 'Planned' | 'Open' } = {}) {
    try { return await this.store.transaction('r', [this.store.roots, this.store.versions, this.store.lifecycle], async () => {
      const root = await this.store.roots.get('active');
      const query = JSON.stringify({ lifecycle: request.lifecycle ?? 'Planned', accountIds: [...(request.accountIds ?? [])].sort(), symbols: [...(request.symbols ?? [])].sort() });
      const cursor = request.cursor ? JSON.parse(request.cursor) as { revision: string; query: string; after: { time: string; sequence: number } } : undefined;
      if (cursor && (cursor.revision !== root?.revision || cursor.query !== query)) return { status: 'ChangedDuringAssembly' as const };
      const page = await new TradeRecord(this.store).queryRecords({ ...request, after: cursor?.after });
      const trades = page.trades;
      return { status: trades.length ? 'Ready' as const : 'Empty' as const, items: trades.map(trade => ({ trade, ...analyze(trade) })), totalInPage: trades.length, nextCursor: page.next ? JSON.stringify({ revision: root?.revision, query, after: page.next }) : undefined, binding: { workspaceRevision: root?.revision } };
    }); } catch (error) { if (error instanceof RecordIntegrityError) return { status: 'IntegrityBlocked' as const, findings: error.findings }; return { status: 'Error' as const, reason: 'StorageReadFailed' }; }
  }
  async getTradeDetail(tradeId: string, expectedWorkspaceRevision?: string) {
    try { return await this.store.transaction('r', [this.store.roots, this.store.versions, this.store.lifecycle], async () => {
      if (expectedWorkspaceRevision && (await this.store.roots.get('active'))?.revision !== expectedWorkspaceRevision) return { status: 'ChangedDuringAssembly' as const };
      const records = new TradeRecord(this.store);
      const trade = await records.getRecord(tradeId);
      if (!trade) return { status: 'NotFound' as const };
      const root = await this.store.roots.get('active');
      const lifecycle = root ? await this.store.lifecycle.get(`${root.generation}:${tradeId}`) : undefined;
      const derived = derive({ candidateId: trade.opening ? trade.tradeId : trade.planFactId, digest: JSON.stringify(trade.plan), revision: trade.revision, plan: trade.plan, storedLifecycle: lifecycle?.lifecycle ?? 'Missing', exposureFacts: [], opening: trade.opening });
      if (derived.status === 'IntegrityBlocked') return derived;
      const journalModule = new Journal(this.store);
      const journal = await journalModule.query({ tradeId, scope: 'History' });
      const entries = journal.entries;
      const anchorResolutions = await records.resolveAnchors(entries.map(entry => entry.anchor));
      const history = await records.history(tradeId);
      const catalog = await queryPlanningCatalog(this.store);
      const account = catalog.records.find(record => record.id === trade.accountId);
      return { ...derived, status: 'Ready' as const, trade, entries, history, journal, anchorResolutions, binding: { generation: root?.generation, workspaceRevision: root?.revision, catalogRevision: root?.catalogRevision }, openingDefinition: await journalModule.getDefinitions('PositionChange'), labels: { account: account?.label, institution: catalog.records.find(record => record.id === account?.parentId)?.label, strategy: catalog.records.find(record => record.id === trade.strategyId)?.label } };
    }); } catch (error) { if (error instanceof RecordIntegrityError) return { status: 'IntegrityBlocked' as const, findings: error.findings }; return { status: 'Error' as const, reason: 'StorageReadFailed' }; }
  }
}
