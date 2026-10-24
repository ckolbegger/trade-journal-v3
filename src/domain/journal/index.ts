import Dexie from 'dexie';
import { positionChangeDefinition, type ReflectionDisposition, type JournalObligation, type JournalDecline, type ResolveDebtCommand } from './position-change-types';
import type { TradeSnapshot } from '../trade-record';
import { Runtime, addedRecords, type Store, type Envelope, type Root } from '../../infrastructure/storage';
export const planDefinition = {
  id: 'plan-reflection', revision: 'plan-reflection-v1', label: 'Plan Reflection',
  prompts: [
    { id: 'thesis', wording: 'Why this trade, why now?', kind: 'Text', required: true, role: 'Thesis' },
    { id: 'invalidation', wording: 'What would invalidate the thesis?', kind: 'Text', required: true, role: 'Invalidation' },
    { id: 'conviction', wording: 'Conviction', kind: 'Scale', required: false, minimum: 1, maximum: 5 },
    { id: 'emotion', wording: 'Primary emotion', kind: 'SingleSelect', required: false, options: ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other'].map(label => ({ id: label.toLowerCase(), label })) },
  ],
};
export interface ReflectionAnswers { thesis: string; invalidation: string; conviction?: string; emotion?: string }
export interface JournalEntry {
  id: string; version: string; definition: typeof planDefinition | typeof positionChangeDefinition;
  anchor: { kind: 'Trade'; tradeId: string }; origin: { kind: 'Plan' | 'PositionChange'; factId: string };
  source: { id: 'plan-confirmation' | 'position-change'; label: string };
  obligationKey?: string; settledDebtId?: string;
  momentTime: string; firstAuthoredTime: string; saveTime: string;
  responses: Record<string, { kind: 'Text' | 'Scale' | 'SingleSelect'; value: string } | { kind: 'Unanswered' }>;
}
interface PositionRequest { kind: 'PositionChange'; definition: typeof positionChangeDefinition; disposition: ReflectionDisposition }
interface PreparedPosition extends PositionRequest { status: 'Prepared' }
interface PreparedPlan { status: 'Prepared'; definition: typeof planDefinition; answers: ReflectionAnswers }
export interface PositionTrigger { tradeId: string; positionChangeId: string; economicTime: string; saveTime: string; sequence: number }
export interface PositionEffects { obligation: JournalObligation; entry?: JournalEntry; decline?: JournalDecline; addedRecords: number }
export interface JournalQuery { status: 'Ready'; generation?: string; workspaceRevision?: string; obligations: JournalObligation[]; obligationHistory: JournalObligation[]; entries: JournalEntry[]; declines: JournalDecline[] }
export class Journal {
  constructor(readonly store: Store, readonly runtime?: Runtime) {}
  async query(tradeId: string): Promise<JournalEntry[]>;
  async query(request: { tradeId?: string; obligationId?: string; scope?: 'Outstanding' | 'History' }): Promise<JournalQuery>;
  async query(request: string | { tradeId?: string; obligationId?: string; scope?: 'Outstanding' | 'History' }): Promise<JournalEntry[] | JournalQuery> {
    return this.store.transaction('r', [this.store.roots, this.store.versions], async () => {
      const root = await this.store.roots.get('active');
      const tradeId = typeof request === 'string' ? request : request.tradeId;
      const obligationId = typeof request === 'string' ? undefined : request.obligationId;
      const rows = !root ? [] : obligationId ? await this.store.versions.where('[generation+id]').equals([root.generation, obligationId]).filter(row => row.kind === 'JournalObligation').toArray() : tradeId ? await this.store.versions.where('[generation+tradeId]').equals([root.generation, tradeId]).toArray() : (await Promise.all((typeof request !== 'string' && request.scope === 'Outstanding' ? ['JournalObligation'] : ['JournalEntry', 'JournalDecline', 'JournalObligation']).map(kind => this.store.versions.where('[generation+kind]').equals([root.generation, kind]).toArray()))).flat();
      rows.sort((a, b) => a.commitOrdinal - b.commitOrdinal || a.sequence - b.sequence);
      const entries = rows.filter(row => row.kind === 'JournalEntry').map(row => row.value as JournalEntry);
      if (typeof request === 'string') return entries;
      const obligationHistory = rows.filter(row => row.kind === 'JournalObligation').map(row => row.value as JournalObligation);
      const current = new Map(obligationHistory.map(obligation => [obligation.id, obligation]));
      return { status: 'Ready', generation: root?.generation, workspaceRevision: root?.revision, obligations: [...current.values()].filter(obligation => request.scope !== 'Outstanding' || obligation.status === 'Outstanding'), obligationHistory, entries, declines: rows.filter(row => row.kind === 'JournalDecline').map(row => row.value as JournalDecline) };
    });
  }
  async getDefinitions(): Promise<typeof planDefinition | undefined>;
  async getDefinitions(kind: 'PositionChange'): Promise<typeof positionChangeDefinition | undefined>;
  async getDefinitions(kind?: 'PositionChange'): Promise<typeof planDefinition | typeof positionChangeDefinition | undefined> {
    const root = await this.store.roots.get('active');
    if (!root) return undefined;
    const revision = kind === 'PositionChange' ? positionChangeDefinition.revision : root.definitionRevision;
    const row = await this.store.versions.get(`${root.generation}:${revision}`);
    return row?.value as typeof planDefinition | typeof positionChangeDefinition | undefined;
  }
  async save(command: ResolveDebtCommand) {
    if (!this.runtime) throw new Error('Coordinator runtime required');
    try { return await this.runtime.mutate(command.generation, async root => {
      if (!root) return { status: 'NotFound' as const };
      if (root.revision !== command.expectedWorkspaceRevision) return { status: 'Conflict' as const, reason: 'WorkspaceChanged' };
      const rows = await this.store.versions.where('[generation+id]').equals([root.generation, command.obligationId]).filter(row => row.kind === 'JournalObligation').toArray();
      rows.sort((a, b) => a.commitOrdinal - b.commitOrdinal);
      const original = rows.at(-1)?.value as JournalObligation | undefined;
      if (!original) return { status: 'NotFound' as const };
      if (original.revision !== command.expectedRevision || original.status !== 'Outstanding') return { status: 'Conflict' as const, reason: 'ObligationChanged' };
      if (original.route.kind === 'TradeWorkflow') return { status: 'NeedsTradeWorkflow' as const, route: structuredClone(original.route) };
      const prepared = this.prepareEffects({ kind: 'PositionChange', definition: original.definition, disposition: command.disposition });
      if (prepared.status === 'Rejected') return prepared;
      const saveTime = new Date().toISOString();
      const result = await this.completeObligation({ ...original, saveTime }, command.disposition, root, root.recordedSequence);
      const workspaceRevision = crypto.randomUUID();
      await this.store.roots.put({ ...root, revision: workspaceRevision, recordCounts: addedRecords(root, result.addedRecords), commitOrdinal: root.commitOrdinal + 1 });
      return { status: 'Saved' as const, ...result, debt: result.obligation, workspaceRevision, receipt: { generation: root.generation, workspaceRevision, commitOrdinal: root.commitOrdinal + 1, saveTime } };
    }); } catch {
      this.runtime.invalidate('transaction');
      return { status: 'StorageFailure' as const };
    }
  }
  prepareEffects(request: PositionRequest): PreparedPosition | { status: 'Rejected'; issues: string[] };
  prepareEffects(definition: typeof planDefinition, answers: ReflectionAnswers): PreparedPlan | { status: 'Rejected'; issues: string[] };
  prepareEffects(definition: typeof planDefinition | PositionRequest, answers?: ReflectionAnswers): PreparedPlan | PreparedPosition | { status: 'Rejected'; issues: string[] } {
    if ('kind' in definition) {
      const issues: string[] = [];
      if (definition.disposition.kind === 'Complete') {
        const responses = definition.disposition.answers;
        for (const prompt of definition.definition.prompts) {
          const value = responses[prompt.id as keyof typeof responses];
          if (prompt.required && !value?.trim()) issues.push(`${prompt.id}:Required`);
          else if (value && prompt.kind === 'SingleSelect' && !prompt.options?.some(option => option.id === value)) issues.push(`${prompt.id}:UnknownOption`);
          else if (value && prompt.kind === 'Scale' && !/^[1-5]$/.test(value)) issues.push(`${prompt.id}:InvalidScale`);
        }
      }
      return issues.length ? { status: 'Rejected', issues } : { ...structuredClone(definition), status: 'Prepared' };
    }
    if (!answers) return { status: 'Rejected', issues: ['AnswersRequired'] };
    const issues: string[] = [];
    if (answers.conviction && !/^[1-5]$/.test(answers.conviction)) issues.push('InvalidConviction');
    if (answers.emotion && !definition.prompts.some(prompt => prompt.id === 'emotion' && prompt.options?.some(option => option.id === answers.emotion))) issues.push('UnknownEmotion');
    if (issues.length) return { status: 'Rejected' as const, issues };
    return { status: 'Prepared' as const, definition: structuredClone(definition), answers: structuredClone(answers) };
  }
  async applyPreparedEffects(prepared: PreparedPosition, trade: PositionTrigger, root: Root): Promise<PositionEffects>;
  async applyPreparedEffects(prepared: PreparedPlan, trade: TradeSnapshot, root: Root): Promise<JournalEntry>;
  async applyPreparedEffects(prepared: PreparedPlan | PreparedPosition, trade: TradeSnapshot | PositionTrigger, root: Root): Promise<JournalEntry | PositionEffects> {
    if ('kind' in prepared) {
      if (!Dexie.currentTransaction) throw new Error('SemanticTransactionRequired');
      if (!('positionChangeId' in trade)) throw new Error('PositionChangeRequired');
      const key = `${trade.positionChangeId}:position-change-reflection`;
      const existing = await this.store.versions.where('[generation+id]').equals([root.generation, key]).toArray();
      if (existing.length) throw new Error('ObligationAlreadyExists');
      const obligation: JournalObligation = { id: key, revision: crypto.randomUUID(), key, status: 'Outstanding', definition: structuredClone(prepared.definition), anchor: { kind: 'Trade', tradeId: trade.tradeId }, origin: { kind: 'PositionChange', factId: trade.positionChangeId }, source: { id: 'position-change', label: 'Position Change' }, dueTime: trade.economicTime, momentTime: trade.economicTime, saveTime: trade.saveTime, route: { kind: 'Journal' }, debtId: crypto.randomUUID() };
      if (prepared.disposition.kind !== 'Defer') {
        delete obligation.debtId;
        return this.completeObligation(obligation, prepared.disposition, root, trade.sequence);
      }
      await this.writeObligation(obligation, root, trade.sequence);
      return { obligation, addedRecords: 1 };
    }
    if (!('planFactId' in trade)) throw new Error('PlanRequired');
    if (!Dexie.currentTransaction) throw new Error('SemanticTransactionRequired');
    const entry: JournalEntry = { id: crypto.randomUUID(), version: crypto.randomUUID(), definition: structuredClone(prepared.definition), anchor: { kind: 'Trade', tradeId: trade.tradeId }, origin: { kind: 'Plan', factId: trade.planFactId }, source: { id: 'plan-confirmation', label: 'Plan Confirmation' }, momentTime: trade.economicTime, firstAuthoredTime: trade.saveTime, saveTime: trade.saveTime, responses: { thesis: { kind: 'Text', value: prepared.answers.thesis }, invalidation: { kind: 'Text', value: prepared.answers.invalidation }, conviction: prepared.answers.conviction ? { kind: 'Scale', value: prepared.answers.conviction } : { kind: 'Unanswered' }, emotion: prepared.answers.emotion ? { kind: 'SingleSelect', value: prepared.answers.emotion } : { kind: 'Unanswered' } } };
    await this.store.versions.add({ version: entry.version, id: entry.id, generation: root.generation, kind: 'JournalEntry', tradeId: trade.tradeId, economicTime: trade.economicTime, saveTime: trade.saveTime, sequence: trade.sequence, commitOrdinal: root.commitOrdinal + 1, value: entry });
    return entry;
  }
  private async completeObligation(original: JournalObligation, disposition: Exclude<ReflectionDisposition, { kind: 'Defer' }>, root: Root, sequence: number): Promise<PositionEffects> {
    const obligation: JournalObligation = { ...structuredClone(original), revision: crypto.randomUUID(), status: disposition.kind === 'Complete' ? 'Completed' : 'Declined' };
    let entry: JournalEntry | undefined;
    let decline: JournalDecline | undefined;
    if (disposition.kind === 'Complete') {
      const responses: JournalEntry['responses'] = {};
      for (const prompt of original.definition.prompts) {
        const value = disposition.answers[prompt.id as keyof typeof disposition.answers];
        responses[prompt.id] = value ? { kind: prompt.kind as 'Text' | 'Scale' | 'SingleSelect', value } : { kind: 'Unanswered' };
      }
      entry = { id: crypto.randomUUID(), version: crypto.randomUUID(), definition: structuredClone(original.definition), anchor: original.anchor, origin: original.origin, source: original.source, obligationKey: original.key, ...(original.debtId ? { settledDebtId: original.debtId } : {}), momentTime: original.momentTime, firstAuthoredTime: obligation.saveTime, saveTime: obligation.saveTime, responses };
      obligation.entryId = entry.id;
    } else {
      decline = { id: crypto.randomUUID(), version: crypto.randomUUID(), obligationKey: original.key, ...(original.debtId ? { debtId: original.debtId } : {}), ...(disposition.reason ? { reason: disposition.reason } : {}), anchor: original.anchor, origin: original.origin, definition: original.definition, source: original.source, momentTime: original.momentTime, saveTime: obligation.saveTime };
      obligation.declineId = decline.id;
    }
    const fact = entry ?? decline;
    if (!fact) throw new Error('OutcomeRequired');
    await this.store.versions.add({ version: fact.version, id: fact.id, generation: root.generation, kind: entry ? 'JournalEntry' : 'JournalDecline', tradeId: original.anchor.tradeId, economicTime: original.momentTime, saveTime: obligation.saveTime, sequence, commitOrdinal: root.commitOrdinal + 1, value: fact });
    await this.writeObligation(obligation, root, sequence);
    return { obligation, ...(entry ? { entry } : {}), ...(decline ? { decline } : {}), addedRecords: 2 };
  }
  private async writeObligation(obligation: JournalObligation, root: Root, sequence: number) {
    await this.store.versions.add({ version: obligation.revision, id: obligation.id, generation: root.generation, kind: 'JournalObligation', tradeId: obligation.anchor.tradeId, economicTime: obligation.momentTime, saveTime: obligation.saveTime, sequence, commitOrdinal: root.commitOrdinal + 1, value: obligation });
  }
  async seedDefaults(root: Root, saveTime: string) {
    const seeds = [
      { id: 'plan-reflection', version: planDefinition.revision, kind: 'Definition', value: planDefinition },
      { id: 'plan-confirmation', version: 'plan-confirmation-v1', kind: 'Source', value: { id: 'plan-confirmation', label: 'Plan Confirmation' } },
      ...(root.schema === 2 ? [
        { id: 'position-change-reflection', version: positionChangeDefinition.revision, kind: 'Definition', value: positionChangeDefinition },
        { id: 'position-change', version: 'position-change-v1', kind: 'Source', value: { id: 'position-change', label: 'Position Change' } },
      ] : []),
    ];
    for (const seed of seeds) {
      const existing = await this.store.versions.get(`${root.generation}:${seed.version}`);
      if (existing) { if (JSON.stringify(existing.value) !== JSON.stringify(seed.value)) throw new Error('SeedConflict'); continue; }
      const row: Envelope = { ...seed, version: `${root.generation}:${seed.version}`, generation: root.generation, tradeId: '', economicTime: saveTime, saveTime, sequence: 0, commitOrdinal: root.commitOrdinal };
      await this.store.versions.add(row);
    }
  }
}
