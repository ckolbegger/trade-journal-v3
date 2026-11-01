import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, type Persistence } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createJournal, D2_JOURNAL_MANIFEST, isJournalCounterBinding, type AnswerInput } from './index.ts';

// T5R2.11: applyPreparedEffects binds the Journal counter (A174, ADR 0011).
const NOW = '2026-10-13T16:30:00Z';
const MOMENT = '2026-10-12T14:00:00Z';
const MODE = 'prompt.position-change-reflection.decision-mode';
const EMOTION = 'prompt.position-change-reflection.primary-emotion';
const CONFIDENCE = 'prompt.position-change-reflection.decision-confidence';
const NOTE = 'prompt.position-change-reflection.note';
// Seeding manifest v2 on an empty Journal: j-0001 is Plan Reflection's revision, j-0002 this one's.
const DEFINITION = 'j-0002';

const answers: Record<string, AnswerInput> = {
  [MODE]: { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  [EMOTION]: { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  [CONFIDENCE]: { kind: 'Scale', value: 4 },
  [NOTE]: { kind: 'Text', text: 'Filled the first tranche at the open.' },
};

const position = (ref: string, disposition: unknown) =>
  ({
    obligation: 'PositionChangeReflection',
    disposition,
    anchor: { kind: 'Trade', ref: 'trade-1' },
    origin: { kind: 'PositionChange', ref: `candidate:${ref}` },
    momentTime: MOMENT,
  }) as Parameters<ReturnType<typeof createJournal>['prepareEffects']>[0];

async function withDebt() {
  const { persistence } = await emptyWorkspace();
  const journal = createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) });
  await journal.seedDefaults(D2_JOURNAL_MANIFEST);
  const deferred = await journal.prepareEffects(position('pc-1', { kind: 'Defer' }));
  if (deferred.kind !== 'Prepared') throw new Error('expected Prepared');
  const tx = beginSemanticTransaction();
  const staged = journal.applyPreparedEffects(tx, deferred, { 'candidate:pc-1': 'pc-1' });
  expect((await persistence.commit(tx.close())).kind).toBe('Committed');
  return { journal, persistence, debt: staged.debts![0]! };
}

async function counter(persistence: Persistence) {
  const { value } = await persistence.readSnapshot(['meta', 'journalEntries'], async (tx) => ({
    revision: ((await tx.get('meta', 'journal')) as { journalRevision: number }).journalRevision,
    entries: await tx.getAll('journalEntries'),
  }));
  return value;
}

describe('the Journal counter is bound (A174, ADR 0011)', () => {
  it('should fail the commit of a prepared Position Change Reflection, naming journal@n, when a Debt resolution through Journal.save commits between its prepare and its commit, leaving the Journal revision advanced exactly once and the reflection unwritten', async () => {
    const { journal, persistence, debt } = await withDebt();
    const before = await counter(persistence);
    const prepared = await journal.prepareEffects(position('pc-2', { kind: 'Complete', form: { definitionId: DEFINITION, answers } }));
    if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');

    const saved = await journal.save({
      intention: 'ResolveDebt',
      debtId: debt.debtId,
      expectedDebtRevision: debt.revision,
      resolution: { kind: 'Decline' },
    });
    expect(saved.kind).toBe('Saved');

    const tx = beginSemanticTransaction();
    journal.applyPreparedEffects(tx, prepared, { 'candidate:pc-2': 'pc-2' });
    expect(await persistence.commit(tx.close())).toEqual({ kind: 'Conflict', binding: `journal@${before.revision}` });

    const after = await counter(persistence);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.entries).toEqual(before.entries);
  });

  it('should commit a prepared effect when no Journal write landed in between, advancing the Journal revision by one', async () => {
    const { journal, persistence } = await withDebt();
    const before = await counter(persistence);
    const prepared = await journal.prepareEffects(position('pc-2', { kind: 'Complete', form: { definitionId: DEFINITION, answers } }));
    if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');

    const tx = beginSemanticTransaction();
    journal.applyPreparedEffects(tx, prepared, { 'candidate:pc-2': 'pc-2' });
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');

    const after = await counter(persistence);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.entries).toHaveLength(before.entries.length + 1);
  });

  it('should report isJournalCounterBinding true for the counter binding name and false for a Trade, Mark or Debt binding', () => {
    expect(isJournalCounterBinding('journal@3')).toBe(true);
    expect(isJournalCounterBinding('journal@0')).toBe(true);
    expect(isJournalCounterBinding('trade:t-1')).toBe(false);
    expect(isJournalCounterBinding('observation@2026-10-13/XYZ')).toBe(false);
    expect(isJournalCounterBinding('debt@j-0003:rev-1')).toBe(false);
    expect(isJournalCounterBinding('journal@')).toBe(false);
  });
});
