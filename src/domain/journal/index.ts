import Dexie from 'dexie';
import type { TradeSnapshot } from '../trade-record';
import type { Store, Envelope, Root } from '../../infrastructure/storage';
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
  id: string; version: string; definition: typeof planDefinition;
  anchor: { kind: 'Trade'; tradeId: string }; origin: { kind: 'Plan'; factId: string };
  source: { id: 'plan-confirmation'; label: 'Plan Confirmation' };
  momentTime: string; firstAuthoredTime: string; saveTime: string;
  responses: Record<string, { kind: 'Text' | 'Scale' | 'SingleSelect'; value: string } | { kind: 'Unanswered' }>;
}
export class Journal {
  constructor(readonly store: Store) {}
  async query(tradeId: string) {
    const root = await this.store.roots.get('active');
    if (!root) return [];
    const rows = await this.store.versions.where('[generation+tradeId]').equals([root.generation, tradeId]).filter(row => row.kind === 'JournalEntry').toArray();
    return rows.sort((a, b) => a.sequence - b.sequence).map(row => row.value as JournalEntry);
  }
  async getDefinitions() {
    const root = await this.store.roots.get('active');
    if (!root) return undefined;
    const row = await this.store.versions.get(`${root.generation}:${root.definitionRevision}`);
    return row?.value as typeof planDefinition | undefined;
  }
  prepareEffects(definition: typeof planDefinition, answers: ReflectionAnswers) {
    const issues: string[] = [];
    if (answers.conviction && !/^[1-5]$/.test(answers.conviction)) issues.push('InvalidConviction');
    if (answers.emotion && !definition.prompts.some(prompt => prompt.id === 'emotion' && prompt.options?.some(option => option.id === answers.emotion))) issues.push('UnknownEmotion');
    if (issues.length) return { status: 'Rejected' as const, issues };
    return { status: 'Prepared' as const, definition: structuredClone(definition), answers: structuredClone(answers) };
  }
  async applyPreparedEffects(prepared: Extract<ReturnType<Journal['prepareEffects']>, { status: 'Prepared' }>, trade: TradeSnapshot, root: Root): Promise<JournalEntry> {
    if (!Dexie.currentTransaction) throw new Error('SemanticTransactionRequired');
    const entry: JournalEntry = { id: crypto.randomUUID(), version: crypto.randomUUID(), definition: structuredClone(prepared.definition), anchor: { kind: 'Trade', tradeId: trade.tradeId }, origin: { kind: 'Plan', factId: trade.planFactId }, source: { id: 'plan-confirmation', label: 'Plan Confirmation' }, momentTime: trade.economicTime, firstAuthoredTime: trade.saveTime, saveTime: trade.saveTime, responses: { thesis: { kind: 'Text', value: prepared.answers.thesis }, invalidation: { kind: 'Text', value: prepared.answers.invalidation }, conviction: prepared.answers.conviction ? { kind: 'Scale', value: prepared.answers.conviction } : { kind: 'Unanswered' }, emotion: prepared.answers.emotion ? { kind: 'SingleSelect', value: prepared.answers.emotion } : { kind: 'Unanswered' } } };
    await this.store.versions.add({ version: entry.version, id: entry.id, generation: root.generation, kind: 'JournalEntry', tradeId: trade.tradeId, economicTime: trade.economicTime, saveTime: trade.saveTime, sequence: trade.sequence, commitOrdinal: root.commitOrdinal + 1, value: entry });
    return entry;
  }
  async seedDefaults(root: Root, saveTime: string) {
    const seeds = [
      { id: 'plan-reflection', version: planDefinition.revision, kind: 'Definition', value: planDefinition },
      { id: 'plan-confirmation', version: 'plan-confirmation-v1', kind: 'Source', value: { id: 'plan-confirmation', label: 'Plan Confirmation' } },
    ];
    for (const seed of seeds) {
      const existing = await this.store.versions.get(`${root.generation}:${seed.version}`);
      if (existing) { if (JSON.stringify(existing.value) !== JSON.stringify(seed.value)) throw new Error('SeedConflict'); continue; }
      const row: Envelope = { ...seed, version: `${root.generation}:${seed.version}`, generation: root.generation, tradeId: '', economicTime: saveTime, saveTime, sequence: 0, commitOrdinal: root.commitOrdinal };
      await this.store.versions.add(row);
    }
  }
}
