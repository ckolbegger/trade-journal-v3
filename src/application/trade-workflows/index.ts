import type { PositionChangeCommand } from './opening-types';
import { Temporal } from '@js-temporal/polyfill';
import { queryPlanningCatalog } from '../../domain/reference-catalog';
import { RecordIntegrityError, TradeRecord } from '../../domain/trade-record';
import { Journal } from '../../domain/journal';
import { assessPlan, assessChange, derive, type PlanInput } from '../../domain/trade-analysis';
import { addedRecords, type Runtime } from '../../infrastructure/storage';
export interface ConfirmPlanCommand {
  generation: string; expectedCatalogRevision: string; definitionRevision: string;
  accountId: string; strategyId: string; economicTime: string;
  plan: Omit<PlanInput, 'thesis' | 'invalidation'>;
  reflection: { thesis: string; invalidation: string; conviction?: string; emotion?: string };
}
export class TradeWorkflows {
  constructor(readonly runtime: Runtime, readonly saveClock: () => string = () => new Date().toISOString()) {}
  async recordPositionChange(command: PositionChangeCommand) {
    const readiness = await this.runtime.establish();
    if (readiness.status !== 'Writable') return readiness;
    const store = this.runtime.store; const records = new TradeRecord(store); const journal = new Journal(store);
    try {
      const context = await store.transaction('r', [store.roots, store.versions, store.lifecycle], async () => ({ root: await store.roots.get('active'), trade: await records.getRecord(command.tradeId), catalog: await queryPlanningCatalog(store), definition: await journal.getDefinitions('PositionChange') }));
      const { root, trade, catalog, definition } = context;
      if (!root || !trade) return { status: 'Rejected' as const, issues: ['TradeRequired'] };
      const conflicts: string[] = [];
      if (root.generation !== command.generation) conflicts.push('GenerationChanged');
      if (root.revision !== command.expectedWorkspaceRevision) conflicts.push('WorkspaceChanged');
      if (root.catalogRevision !== command.expectedCatalogRevision) conflicts.push('CatalogChanged');
      if (trade.revision !== command.expectedTradeRevision) conflicts.push('TradeChanged');
      if (definition?.revision !== command.definitionRevision) conflicts.push('DefinitionChanged');
      if (conflicts.length) return { status: 'Conflict' as const, issues: conflicts };
      if (!definition || root.schema !== 2) return { status: 'Rejected' as const, issues: ['MigrationRequired'] };
      const issues: string[] = [];
      if (command.kind !== 'InitialStockEntry' || trade.lifecycle !== 'Planned' || trade.opening) issues.push('InitialStockEntryRequiresPlannedTrade');
      if (command.plannedLegId !== trade.plannedLegId) issues.push('PlannedLegIntentMismatch');
      if (!catalog.records.some(record => record.id === trade.accountId && record.kind === 'Account') || !catalog.records.some(record => record.id === trade.strategyId && record.kind === 'Strategy')) issues.push('RetainedReferenceRequired');
      try {
        if (Temporal.Instant.compare(command.economicTime, trade.economicTime) < 0 || command.executions.some(execution => Temporal.Instant.compare(execution.economicTime, trade.economicTime) < 0)) issues.push('EntryBeforePlan');
      } catch { issues.push('InvalidExecutionTime'); }
      const saveTime = this.saveClock();
      const candidate = records.prepareChange({ kind: 'InitialStockEntry', trade, command: { economicTime: command.economicTime, executions: command.executions }, root, saveTime });
      const assessment = assessChange(candidate.candidate);
      const effects = journal.prepareEffects({ kind: 'PositionChange', definition, disposition: command.reflection });
      if (assessment.status === 'Rejected') issues.push(...assessment.issues);
      if (effects.status === 'Rejected') issues.push(...effects.issues);
      if (issues.length || assessment.status !== 'Accepted' || effects.status !== 'Prepared') return { status: 'Rejected' as const, issues: [...new Set(issues)] };
      if (JSON.stringify(assessment.derivation.baseline) !== JSON.stringify(trade.baseline)) return { status: 'IntegrityBlocked' as const, findings: ['PlanBaselineDisagreement'] };
      return await this.runtime.mutate(command.generation, async current => {
        if (!current || current.revision !== root.revision || current.catalogRevision !== command.expectedCatalogRevision) return { status: 'Conflict' as const, issues: ['WorkspaceChanged'] };
        const currentDefinition = await journal.getDefinitions('PositionChange');
        if (JSON.stringify(currentDefinition) !== JSON.stringify(definition)) return { status: 'Conflict' as const, issues: ['DefinitionChanged'] };
        const applied = await records.applyPreparedChange(candidate, assessment.derivation, current, saveTime);
        const journalOutcome = await journal.applyPreparedEffects(effects, { tradeId: trade.tradeId, positionChangeId: applied.positionChange.id, economicTime: command.economicTime, saveTime, sequence: applied.positionChange.sequence }, current);
        const workspaceRevision = crypto.randomUUID();
        await store.roots.put({ ...current, revision: workspaceRevision, recordedSequence: applied.lastSequence, commitOrdinal: current.commitOrdinal + 1, recordCounts: addedRecords(current, applied.addedRecords + journalOutcome.addedRecords) });
        const account = catalog.records.find(record => record.id === trade.accountId);
        return { status: 'Recorded' as const, trade: applied.trade, derivation: applied.derivation, journalOutcome, workspaceRevision, labels: { account: account?.label, institution: catalog.records.find(record => record.id === account?.parentId)?.label, strategy: catalog.records.find(record => record.id === trade.strategyId)?.label }, receipt: { tradeId: trade.tradeId, factRevision: applied.trade.revision, positionChangeId: applied.positionChange.id, executionIds: applied.executions.map(execution => execution.id), lifecycle: 'Open' as const, obligationId: journalOutcome.obligation.id, obligationRevision: journalOutcome.obligation.revision, workspaceRevision } };
      });
    } catch (error) {
      if (error instanceof RecordIntegrityError) return { status: 'IntegrityBlocked' as const, findings: error.findings };
      if (error instanceof Error && (error.message === 'ReconciliationConflict' || error.message === 'ObligationConflict')) return { status: 'Conflict' as const, issues: [error.message] };
      this.runtime.invalidate('transaction');
      return { status: 'StorageFailure' as const };
    }
  }
  async confirmPlan(command: ConfirmPlanCommand) {
    const readiness = await this.runtime.establish();
    if (readiness.status !== 'Writable') return readiness;
    const store = this.runtime.store;
    const root = await store.roots.get('active');
    if (!root) return { status: 'Rejected' as const, issues: ['WorkspaceRequired'] };
    const conflicts: string[] = [];
    if (root.catalogRevision !== command.expectedCatalogRevision) conflicts.push('CatalogChanged');
    if (root.definitionRevision !== command.definitionRevision) conflicts.push('DefinitionChanged');
    if (root.generation !== command.generation) conflicts.push('GenerationChanged');
    if (conflicts.length) return { status: 'Conflict' as const, issues: conflicts };
    const catalog = await queryPlanningCatalog(store);
    const issues: string[] = [];
    if (!catalog.records.some(record => record.id === command.accountId && record.kind === 'Account' && record.active)) issues.push('SelectableAccountRequired');
    if (command.strategyId !== 'long-stock' || !catalog.records.some(record => record.id === command.strategyId && record.kind === 'Strategy' && record.active)) issues.push('SelectableLongStockRequired');
    try { Temporal.Instant.from(command.economicTime); } catch { issues.push('EconomicTimeRequired'); }
    const assessment = assessPlan({ ...command.plan, thesis: command.reflection.thesis, invalidation: command.reflection.invalidation });
    if (assessment.status !== 'Accepted') return { status: 'Rejected' as const, issues: [...issues, ...assessment.issues] };
    if (issues.length) return { status: 'Rejected' as const, issues };
    const journal = new Journal(store);
    const definition = await journal.getDefinitions();
    if (!definition) return { status: 'Rejected' as const, issues: ['DefinitionRequired'] };
    const effects = journal.prepareEffects(definition, command.reflection);
    if (effects.status === 'Rejected') return effects;
    const records = new TradeRecord(store);
    const candidate = records.prepareChange({ accountId: command.accountId, strategyId: command.strategyId, economicTime: command.economicTime, assessment, revision: root.revision });
    const reconciliation = derive(candidate);
    try { return await this.runtime.mutate(command.generation, async current => {
      if (!current || current.revision !== root.revision || current.catalogRevision !== command.expectedCatalogRevision || current.definitionRevision !== command.definitionRevision) return { status: 'Conflict' as const, issues: ['WorkspaceChanged'] };
      const trade = await records.applyPreparedChange(candidate, reconciliation, current, this.saveClock());
      const entry = await journal.applyPreparedEffects(effects, trade, current);
      const next = { ...current, revision: crypto.randomUUID(), recordedSequence: trade.sequence, recordCounts: addedRecords(current, 2, 1), commitOrdinal: current.commitOrdinal + 1 };
      await store.roots.put(next);
      const account = catalog.records.find(record => record.id === command.accountId);
      return { status: 'Confirmed' as const, labels: { account: account?.label, institution: catalog.records.find(record => record.id === account?.parentId)?.label, strategy: catalog.records.find(record => record.id === command.strategyId)?.label }, trade, entry, assessment, workspaceRevision: next.revision, reconciliation, receipt: { tradeId: trade.tradeId, factRevision: trade.revision, factId: trade.planFactId, factVersionId: trade.planVersionId, entryId: entry.id, entryVersion: entry.version, lifecycle: trade.lifecycle, workspaceRevision: next.revision } };
    }); } catch (error) {
      if (error instanceof Error && error.message === 'ReconciliationConflict') return { status: 'Conflict' as const, issues: ['ReconciliationChanged'] };
      this.runtime.invalidate('transaction');
      return { status: 'StorageFailure' as const };
    }
  }
}
