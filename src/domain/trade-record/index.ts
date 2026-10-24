import { prepareOpening, applyOpening, type OpeningPreparation, type PreparedOpening, type TradeHead } from './opening';
import type { OpeningInput } from '../trade-analysis';
import Dexie from 'dexie';
import { Temporal } from '@js-temporal/polyfill';
import { derive, type Assessment, type Baseline, type PlanInput, type PlannedCandidate } from '../trade-analysis';
import type { Envelope, Root, Store } from '../../infrastructure/storage';
export interface TradeSnapshot {
  tradeId: string; revision: string; planFactId: string; planVersionId: string;
  plannedLegId: string; stopId: string; targetId: string;
  accountId: string; strategyId: string; lifecycle: 'Planned' | 'Open';
  opening?: OpeningInput; stateVersionId?: string;
  plan: PlanInput; baseline: Baseline;
  economicTime: string; saveTime: string; sequence: number;
}
export interface PreparedPlan extends PlannedCandidate { accountId: string; strategyId: string; economicTime: string; assessment: Extract<Assessment, { status: 'Accepted' }> }
export class TradeRecord {
  constructor(readonly store: Store) {}
  async resolveAnchors(anchors: ({ kind: 'Trade'; tradeId: string } | { kind: 'Execution'; executionId: string })[]) {
    if (anchors.length > 50) return { status: 'Rejected' as const, issues: ['AnchorBatchTooLarge'] };
    return this.store.transaction('r', [this.store.roots, this.store.lifecycle, this.store.versions], async () => {
      const root = await this.store.roots.get('active');
      const tradeIds = anchors.flatMap(anchor => anchor.kind === 'Trade' ? [anchor.tradeId] : []);
      const executionIds = anchors.flatMap(anchor => anchor.kind === 'Execution' ? [anchor.executionId] : []);
      const rows = root ? await this.store.lifecycle.bulkGet(tradeIds.map(id => `${root.generation}:${id}`)) : [];
      const executions = root && executionIds.length ? await this.store.versions.where('[generation+id]').anyOf(executionIds.map(id => [root.generation, id])).filter(row => row.kind === 'Execution').toArray() : [];
      const trades = new Map(rows.filter(row => !!row).map(row => [row.tradeId, row.tradeId]));
      const owners = new Map(executions.map(row => [row.id, row.tradeId]));
      return { status: 'Ready' as const, workspaceRevision: root?.revision, resolutions: anchors.map(anchor => {
        const owningTradeId = anchor.kind === 'Trade' ? trades.get(anchor.tradeId) : owners.get(anchor.executionId);
        return owningTradeId ? { anchor, status: 'Effective' as const, owningTradeId } : { anchor, status: 'Unknown' as const };
      }) };
    });
  }
  async getRecord(tradeId: string): Promise<TradeSnapshot | undefined> {
    return this.store.transaction('r', [this.store.roots, this.store.lifecycle, this.store.versions], async () => {
      const root = await this.store.roots.get('active');
      if (!root) return undefined;
      const row = await this.store.lifecycle.get(`${root.generation}:${tradeId}`);
      if (!row) return undefined;
      const head = await this.store.versions.get(row.version);
      if (!head) throw new RecordIntegrityError(['MissingTradeHead']);
      const trade = (await this.assemble([head], root.generation))[0];
      if (trade?.revision !== row.revision) throw new RecordIntegrityError(['FactRevisionDisagreement']);
      return trade;
    });
  }
  async history(tradeId: string): Promise<TradeSnapshot[]> {
    return this.store.transaction('r', [this.store.roots, this.store.versions], async () => {
      const root = await this.store.roots.get('active');
      if (!root) return [];
      const rows = await this.store.versions.where('[generation+tradeId]').equals([root.generation, tradeId]).filter(row => row.kind === 'Plan' || row.kind === 'TradeState').toArray();
      return this.assemble(rows.sort((a, b) => a.commitOrdinal - b.commitOrdinal), root.generation);
    });
  }
  async queryRecords(request: { after?: { time: string; sequence: number }; accountIds?: string[]; symbols?: string[]; lifecycle?: 'Planned' | 'Open' } = {}) {
    const root = await this.store.roots.get('active');
    if (!root) return { trades: [], next: undefined };
    const rows = await this.store.lifecycle.where('[generation+lifecycle+economicOrder+sequence]').between([root.generation, request.lifecycle ?? 'Planned', '', 0], [root.generation, request.lifecycle ?? 'Planned', request.after?.time ?? '\uffff', request.after?.sequence ?? Number.MAX_SAFE_INTEGER], true, !request.after).reverse().filter(row => (!request.accountIds?.length || request.accountIds.includes(row.accountId)) && (!request.symbols?.length || request.symbols.includes(row.symbol))).limit(51).toArray();
    const more = rows.length > 50;
    if (more) rows.pop();
    const versions = await this.store.versions.bulkGet(rows.map(row => row.version));
    const last = rows.at(-1);
    if (versions.some(row => !row)) throw new RecordIntegrityError(['MissingTradeHead']);
    const trades = await this.assemble(versions as Envelope[], root.generation);
    if (trades.some((trade, index) => trade.lifecycle !== rows[index]?.lifecycle)) throw new RecordIntegrityError(['LifecycleDisagreement']);
    if (trades.some((trade, index) => trade.revision !== rows[index]?.revision)) throw new RecordIntegrityError(['FactRevisionDisagreement']);
    return { trades, next: more && last ? { time: last.economicOrder, sequence: last.sequence } : undefined };
  }
  private async assemble(heads: Envelope[], generation: string): Promise<TradeSnapshot[]> {
    const references = heads.filter(row => row.kind === 'TradeState').flatMap(row => { const head = row.value as TradeHead; return [head.planEnvelopeVersion, head.positionChangeVersion, ...head.executionVersions, head.agreementVersion]; });
    const facts = new Map((await this.store.versions.bulkGet([...new Set(references)])).filter((row): row is Envelope => !!row).map(row => [row.version, row]));
    return heads.map(row => {
      if (row.generation !== generation) throw new RecordIntegrityError(['GenerationDisagreement']);
      if (row.kind === 'Plan') return row.value as TradeSnapshot;
      if (row.kind !== 'TradeState') throw new RecordIntegrityError(['InvalidTradeHead']);
      const head = row.value as TradeHead;
      const resolve = (version: string, kind: string) => {
        const fact = facts.get(version);
        if (!fact || fact.kind !== kind || fact.generation !== generation || fact.tradeId !== head.tradeId) throw new RecordIntegrityError(['OpeningFactDisagreement']);
        return fact.value;
      };
      const plan = resolve(head.planEnvelopeVersion, 'Plan') as TradeSnapshot;
      return { ...plan, revision: head.revision, lifecycle: head.lifecycle, stateVersionId: row.domainVersion ?? row.version, opening: { plannedLegId: plan.plannedLegId, positionChange: resolve(head.positionChangeVersion, 'PositionChange') as NonNullable<OpeningInput>['positionChange'], executions: head.executionVersions.map(version => resolve(version, 'Execution') as NonNullable<OpeningInput>['executions'][number]), recordedAgreement: resolve(head.agreementVersion, 'Agreement') as NonNullable<OpeningInput>['recordedAgreement'] } };
    });
  }
  prepareChange(input: OpeningPreparation): PreparedOpening;
  prepareChange(input: PlanPreparation): PreparedPlan;
  prepareChange(input: OpeningPreparation | PlanPreparation): PreparedOpening | PreparedPlan {
    if ('kind' in input) return prepareOpening(input);
    return this.preparePlan(input);
  }
  private preparePlan(input: { accountId: string; strategyId: string; economicTime: string; assessment: Extract<Assessment, { status: 'Accepted' }>; revision: string }): PreparedPlan {
    const digest = JSON.stringify({ accountId: input.accountId, strategyId: input.strategyId, economicTime: input.economicTime, assessment: input.assessment, revision: input.revision });
    return { candidateId: digest, digest, plan: input.assessment.plan, storedLifecycle: 'Planned', exposureFacts: [], ...input };
  }
  applyPreparedChange(candidate: PreparedOpening, reconciliation: ReturnType<typeof derive>, root: Root, saveTime: string): ReturnType<typeof applyOpening>;
  applyPreparedChange(candidate: PreparedPlan, reconciliation: ReturnType<typeof derive>, root: Root, saveTime: string): Promise<TradeSnapshot>;
  async applyPreparedChange(candidate: PreparedPlan | PreparedOpening, reconciliation: ReturnType<typeof derive>, root: Root, saveTime: string) {
    if ('kind' in candidate) return applyOpening(this.store, candidate, reconciliation, root);
    return this.applyPlan(candidate, reconciliation, root, saveTime);
  }
  private async applyPlan(candidate: PreparedPlan, reconciliation: ReturnType<typeof derive>, root: Root, saveTime: string) {
    if (JSON.stringify(candidate.plan) !== JSON.stringify(candidate.assessment.plan) || candidate.digest !== JSON.stringify({ accountId: candidate.accountId, strategyId: candidate.strategyId, economicTime: candidate.economicTime, assessment: candidate.assessment, revision: candidate.revision })) throw new Error('ReconciliationConflict');
    if (!Dexie.currentTransaction) throw new Error('SemanticTransactionRequired');
    if (reconciliation.status !== 'Derived' || reconciliation.reconciliation.expectedLifecycle !== 'Planned' || reconciliation.reconciliation.candidateId !== candidate.candidateId || reconciliation.reconciliation.digest !== candidate.digest || reconciliation.reconciliation.revision !== root.revision || candidate.revision !== root.revision) throw new Error('ReconciliationConflict');
    if (JSON.stringify(candidate.assessment.baseline) !== JSON.stringify(reconciliation.baseline)) throw new Error('ReconciliationConflict');
    const trade: TradeSnapshot = { tradeId: crypto.randomUUID(), revision: crypto.randomUUID(), planFactId: crypto.randomUUID(), planVersionId: crypto.randomUUID(), plannedLegId: crypto.randomUUID(), stopId: crypto.randomUUID(), targetId: crypto.randomUUID(), accountId: candidate.accountId, strategyId: candidate.strategyId, lifecycle: 'Planned', plan: structuredClone(candidate.plan), baseline: structuredClone(candidate.assessment.baseline), economicTime: candidate.economicTime, saveTime, sequence: root.recordedSequence + 1 };
    await this.store.versions.add({ version: trade.planVersionId, id: trade.planFactId, generation: root.generation, kind: 'Plan', tradeId: trade.tradeId, economicTime: trade.economicTime, saveTime, sequence: trade.sequence, commitOrdinal: root.commitOrdinal + 1, value: trade });
    await this.store.lifecycle.add({ key: `${root.generation}:${trade.tradeId}`, generation: root.generation, tradeId: trade.tradeId, lifecycle: reconciliation.reconciliation.expectedLifecycle, accountId: trade.accountId, symbol: trade.plan.instrument?.symbol ?? '', economicTime: trade.economicTime, economicOrder: (Temporal.Instant.from(trade.economicTime).epochNanoseconds + 8640000000000000000000n).toString().padStart(23, '0'), sequence: trade.sequence, version: trade.planVersionId, revision: trade.revision });
    return trade;
  }
}

interface PlanPreparation { accountId: string; strategyId: string; economicTime: string; assessment: Extract<Assessment, { status: 'Accepted' }>; revision: string }

export class RecordIntegrityError extends Error { constructor(readonly findings: string[]) { super(findings.join(', ')); } }
