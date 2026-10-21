import { Temporal } from '@js-temporal/polyfill';
import { queryPlanningCatalog } from '../../domain/reference-catalog';
import { TradeRecord } from '../../domain/trade-record';
import { Journal } from '../../domain/journal';
import { assessPlan, derive, type PlanInput } from '../../domain/trade-analysis';
import type { Runtime } from '../../infrastructure/storage';
export interface ConfirmPlanCommand {
  generation: string; expectedCatalogRevision: string; definitionRevision: string;
  accountId: string; strategyId: string; economicTime: string;
  plan: Omit<PlanInput, 'thesis' | 'invalidation'>;
  reflection: { thesis: string; invalidation: string; conviction?: string; emotion?: string };
}
export class TradeWorkflows {
  constructor(readonly runtime: Runtime, readonly saveClock: () => string = () => new Date().toISOString()) {}
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
      const next = { ...current, revision: crypto.randomUUID(), recordedSequence: trade.sequence, commitOrdinal: current.commitOrdinal + 1 };
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
