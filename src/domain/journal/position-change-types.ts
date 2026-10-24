export const positionChangeDefinition = {
  id: 'position-change-reflection', revision: 'position-change-reflection-v1', label: 'Position Change Reflection',
  prompts: [
    { id: 'decision-mode', wording: 'Decision mode', kind: 'SingleSelect', required: true, options: ['As Planned', 'Deliberate Adjustment', 'Reactive', 'Externally Imposed'].map(label => ({ id: label.toLowerCase().replaceAll(' ', '-'), label })) },
    { id: 'emotion', wording: 'Primary emotion', kind: 'SingleSelect', required: true, options: ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other'].map(label => ({ id: label.toLowerCase(), label })) },
    { id: 'confidence', wording: 'Decision confidence', kind: 'Scale', required: true, minimum: 1, maximum: 5 },
    { id: 'note', wording: 'Note', kind: 'Text', required: false },
  ],
};
export interface PositionReflectionAnswers { 'decision-mode': string; emotion: string; confidence: string; note?: string }
export type ReflectionDisposition = { kind: 'Complete'; answers: PositionReflectionAnswers } | { kind: 'Defer' } | { kind: 'Decline'; reason?: string };
export interface JournalObligation {
  id: string; revision: string; key: string; status: 'Outstanding' | 'Completed' | 'Declined';
  definition: typeof positionChangeDefinition;
  anchor: { kind: 'Trade'; tradeId: string }; origin: { kind: 'PositionChange'; factId: string };
  source: { id: 'position-change'; label: 'Position Change' };
  dueTime: string; momentTime: string; saveTime: string;
  route: { kind: 'Journal' } | { kind: 'TradeWorkflow'; tradeId: string; operation: string };
  debtId?: string; entryId?: string; declineId?: string;
}
export interface JournalDecline {
  id: string; version: string; obligationKey: string; debtId?: string; reason?: string;
  anchor: JournalObligation['anchor']; origin: JournalObligation['origin'];
  definition: typeof positionChangeDefinition; source: JournalObligation['source']; momentTime: string; saveTime: string;
}
export interface ResolveDebtCommand {
  kind: 'ResolveDebt'; generation: string; expectedWorkspaceRevision: string;
  obligationId: string; expectedRevision: string; disposition: Exclude<ReflectionDisposition, { kind: 'Defer' }>;
}
