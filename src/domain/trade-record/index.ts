import Dexie from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
import { derive, type Assessment, type Baseline, type PlanInput, type PlannedCandidate } from '../trade-analysis';
import type { Root, Store } from '../../infrastructure/storage';
export interface TradeSnapshot {
  tradeId: string; revision: string; planFactId: string; planVersionId: string;
  plannedLegId: string; stopId: string; targetId: string;
  accountId: string; strategyId: string; lifecycle: 'Planned';
  plan: PlanInput; baseline: Baseline;
  economicTime: string; saveTime: string; sequence: number;
}
export interface PreparedPlan extends PlannedCandidate { accountId: string; strategyId: string; economicTime: string; assessment: Extract<Assessment, { status: 'Accepted' }> }
export class TradeRecord {
  constructor(readonly store: Store) {}
  async resolveAnchors(anchors: { kind: 'Trade'; tradeId: string }[]) {
    if (anchors.length > 50) return { status: 'Rejected' as const, issues: ['AnchorBatchTooLarge'] };
    return this.store.transaction('r', [this.store.roots, this.store.lifecycle], async () => {
      const root = await this.store.roots.get('active');
      const rows = root ? await this.store.lifecycle.bulkGet(anchors.map(anchor => `${root.generation}:${anchor.tradeId}`)) : [];
      return { status: 'Ready' as const, workspaceRevision: root?.revision, resolutions: anchors.map((anchor, index) => rows[index]?.tradeId === anchor.tradeId ? { anchor, status: 'Effective' as const, owningTradeId: anchor.tradeId } : { anchor, status: 'Unknown' as const }) };
    });
  }
  async getRecord(tradeId: string): Promise<TradeSnapshot | undefined> {
    return this.store.transaction('r', [this.store.roots, this.store.lifecycle, this.store.versions], async () => {
      const root = await this.store.roots.get('active');
      if (!root) return undefined;
      const row = await this.store.lifecycle.get(`${root.generation}:${tradeId}`);
      if (!row) return undefined;
      return (await this.store.versions.get(row.version))?.value as TradeSnapshot | undefined;
    });
  }
  async history(tradeId: string): Promise<TradeSnapshot[]> {
    return this.store.transaction('r', [this.store.roots, this.store.versions], async () => {
      const root = await this.store.roots.get('active');
      if (!root) return [];
      const rows = await this.store.versions.where('[generation+tradeId]').equals([root.generation, tradeId]).filter(row => row.kind === 'Plan').toArray();
      return rows.sort((a, b) => a.commitOrdinal - b.commitOrdinal).map(row => row.value as TradeSnapshot);
    });
  }
  async queryRecords(request: { after?: { time: string; sequence: number }; accountIds?: string[]; symbols?: string[] } = {}) {
    const root = await this.store.roots.get('active');
    if (!root) return { trades: [], next: undefined };
    const rows = await this.store.lifecycle.where('[generation+lifecycle+economicOrder+sequence]').between([root.generation, 'Planned', '', 0], [root.generation, 'Planned', request.after?.time ?? '\uffff', request.after?.sequence ?? Number.MAX_SAFE_INTEGER], true, !request.after).reverse().filter(row => (!request.accountIds?.length || request.accountIds.includes(row.accountId)) && (!request.symbols?.length || request.symbols.includes(row.symbol))).limit(51).toArray();
    const more = rows.length > 50;
    if (more) rows.pop();
    const versions = await this.store.versions.bulkGet(rows.map(row => row.version));
    const last = rows.at(-1);
    return { trades: versions.map(row => row?.value as TradeSnapshot), next: more && last ? { time: last.economicOrder, sequence: last.sequence } : undefined };
  }
  prepareChange(input: { accountId: string; strategyId: string; economicTime: string; assessment: Extract<Assessment, { status: 'Accepted' }>; revision: string }): PreparedPlan {
    const digest = JSON.stringify({ accountId: input.accountId, strategyId: input.strategyId, economicTime: input.economicTime, assessment: input.assessment, revision: input.revision });
    return { candidateId: digest, digest, plan: input.assessment.plan, storedLifecycle: 'Planned', exposureFacts: [], ...input };
  }
  async applyPreparedChange(candidate: PreparedPlan, reconciliation: ReturnType<typeof derive>, root: Root, saveTime: string) {
    if (JSON.stringify(candidate.plan) !== JSON.stringify(candidate.assessment.plan) || candidate.digest !== JSON.stringify({ accountId: candidate.accountId, strategyId: candidate.strategyId, economicTime: candidate.economicTime, assessment: candidate.assessment, revision: candidate.revision })) throw new Error('ReconciliationConflict');
    if (!Dexie.currentTransaction) throw new Error('SemanticTransactionRequired');
    if (reconciliation.status !== 'Derived' || reconciliation.reconciliation.candidateId !== candidate.candidateId || reconciliation.reconciliation.digest !== candidate.digest || reconciliation.reconciliation.revision !== root.revision || candidate.revision !== root.revision) throw new Error('ReconciliationConflict');
    if (JSON.stringify(candidate.assessment.baseline) !== JSON.stringify(reconciliation.baseline)) throw new Error('ReconciliationConflict');
    const trade: TradeSnapshot = { tradeId: crypto.randomUUID(), revision: crypto.randomUUID(), planFactId: crypto.randomUUID(), planVersionId: crypto.randomUUID(), plannedLegId: crypto.randomUUID(), stopId: crypto.randomUUID(), targetId: crypto.randomUUID(), accountId: candidate.accountId, strategyId: candidate.strategyId, lifecycle: 'Planned', plan: structuredClone(candidate.plan), baseline: structuredClone(candidate.assessment.baseline), economicTime: candidate.economicTime, saveTime, sequence: root.recordedSequence + 1 };
    await this.store.versions.add({ version: trade.planVersionId, id: trade.planFactId, generation: root.generation, kind: 'Plan', tradeId: trade.tradeId, economicTime: trade.economicTime, saveTime, sequence: trade.sequence, commitOrdinal: root.commitOrdinal + 1, value: trade });
    await this.store.lifecycle.add({ key: `${root.generation}:${trade.tradeId}`, generation: root.generation, tradeId: trade.tradeId, lifecycle: reconciliation.reconciliation.expectedLifecycle, accountId: trade.accountId, symbol: trade.plan.instrument?.symbol ?? '', economicTime: trade.economicTime, economicOrder: (Temporal.Instant.from(trade.economicTime).epochNanoseconds + 8640000000000000000000n).toString().padStart(23, '0'), sequence: trade.sequence, version: trade.planVersionId, revision: trade.revision });
    return trade;
  }
}
