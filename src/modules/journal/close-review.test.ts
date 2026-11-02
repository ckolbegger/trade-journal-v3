import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, type Persistence } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import {
  createJournal,
  D1_JOURNAL_MANIFEST,
  D2_JOURNAL_MANIFEST,
  D3_JOURNAL_MANIFEST,
  D4_JOURNAL_MANIFEST,
  D5_JOURNAL_MANIFEST,
  type CloseReviewRequest,
} from './index.ts';

// T6.8: the Close Review (D6 A86). The terminal Position Change is PC2 of the reference Trade,
// the closing Sell at 10:00 New York on Monday 2026-10-19; the clock is Monday 11:05 New York.
const NOW = '2026-10-19T15:05:00Z';
const TERMINAL_TIME = '2026-10-19T14:00:00Z';
const TAKE_AGAIN = 'prompt.close-review.take-again';
const WORKED = 'prompt.close-review.what-worked';
const LESSON = 'prompt.close-review.key-lesson';
const AS_PLANNED = 'option.close-review.take-again.yes-as-planned';
// Seeding manifests v1 to v5 on an empty Journal: the Close Review is the fourth definition.
const DEFINITION = 'j-0004';

async function stored(persistence: Persistence) {
  const { value } = await persistence.readSnapshot(
    ['journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalDebts', 'journalObligations', 'meta'],
    async (tx) => ({
      types: await tx.getAll('journalTypes'),
      definitions: await tx.getAll('journalDefinitions'),
      entries: await tx.getAll('journalEntries'),
      declines: await tx.getAll('journalDeclines'),
      debts: await tx.getAll('journalDebts'),
      obligations: await tx.getAll('journalObligations'),
      meta: await tx.get('meta', 'journal'),
    }),
  );
  return value;
}

async function journalAt(manifests: Parameters<ReturnType<typeof createJournal>['seedDefaults']>[0][]) {
  const { persistence } = await emptyWorkspace();
  const journal = createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) });
  for (const manifest of manifests) await journal.seedDefaults(manifest);
  return { journal, persistence };
}

const seeded = () => journalAt([D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST, D4_JOURNAL_MANIFEST, D5_JOURNAL_MANIFEST]);

describe('seedDefaults: manifest v5', () => {
  it('should add the Close Review Entry Type, its definition revision 1, and the Trade Close Source, and nothing else, to a v4-seeded Journal, and add nothing when run again', async () => {
    const { journal: j, persistence } = await journalAt([D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST, D4_JOURNAL_MANIFEST]);
    const before = await stored(persistence);

    const result = await j.seedDefaults(D5_JOURNAL_MANIFEST);

    expect(D5_JOURNAL_MANIFEST.version).toBe(5);
    const revision = (before.meta!['journalRevision'] as number) + 1;
    expect(result).toEqual({ kind: 'Seeded', additions: ['entry-type.close-review', 'source.trade-close'], snapshot: { journalRevision: revision } });
    const after = await stored(persistence);
    expect(after.types).toHaveLength(before.types.length + 2);
    expect(after.types).toEqual(
      expect.arrayContaining([
        ...before.types,
        { id: 'entry-type.close-review', kind: 'EntryType', productKey: 'entry-type.close-review', label: 'Close Review', revision: revision + 1 },
        { id: 'source.trade-close', kind: 'Source', productKey: 'source.trade-close', label: 'Trade Close', revision: revision + 1 },
      ]),
    );
    expect(after.definitions).toHaveLength(before.definitions.length + 1);
    expect(after.definitions).toEqual(
      expect.arrayContaining([...before.definitions, expect.objectContaining({ id: DEFINITION, entryTypeKey: 'entry-type.close-review', revisionNumber: 1 })]),
    );
    expect(after.entries).toEqual([]);

    expect(await j.seedDefaults(D5_JOURNAL_MANIFEST)).toEqual({ kind: 'Seeded', additions: [], snapshot: { journalRevision: revision } });
    expect(await stored(persistence)).toEqual(after);
  });

  it('should match the contract exactly: Would you take this Trade again under similar conditions required Single Select Yes as planned, Yes with changes, No, Unsure; What worked and what did not optional Text; What is the key lesson optional Text, in that order', async () => {
    const { journal: j } = await seeded();
    const result = await j.getDefinitions({ latestFor: 'entry-type.close-review' });
    if (result.kind !== 'Found') throw new Error('expected the definition');
    expect(result.definition.revisionNumber).toBe(1);
    expect(result.definition.prompts).toEqual([
      {
        id: TAKE_AGAIN,
        kind: 'SingleSelect',
        text: 'Would you take this Trade again under similar conditions?',
        required: true,
        options: [
          { id: AS_PLANNED, label: 'Yes, as planned' },
          { id: 'option.close-review.take-again.yes-with-changes', label: 'Yes, with changes' },
          { id: 'option.close-review.take-again.no', label: 'No' },
          { id: 'option.close-review.take-again.unsure', label: 'Unsure' },
        ],
      },
      { id: WORKED, kind: 'Text', text: 'What worked, and what did not?', required: false },
      { id: LESSON, kind: 'Text', text: 'What is the key lesson?', required: false },
    ]);
  });
});

const answers = {
  [TAKE_AGAIN]: { kind: 'Option', optionId: AS_PLANNED },
  [WORKED]: { kind: 'Text', text: 'Sized well; exited on the stop.' },
  [LESSON]: { kind: 'Text', text: 'Wait for the retest.' },
} as const;

// The Close Review owed for the Trade, with the terminal Position Change as origin.
function request(disposition: unknown): CloseReviewRequest {
  return {
    obligation: 'CloseReview',
    disposition,
    anchor: { kind: 'Trade', ref: 'trade-1' },
    origin: { kind: 'PositionChange', ref: 'candidate:pc-2' },
    momentTime: TERMINAL_TIME,
  } as CloseReviewRequest;
}

const complete = (form: Record<string, unknown> = answers) => request({ kind: 'Complete', form: { definitionId: DEFINITION, answers: form } });

describe('prepareEffects: Close Review A86', () => {
  it('should prepare a completed Entry keyed CloseReview and Trade, with the definition snapshot, a Trade Anchor, Source Trade Close, the terminal Position Change as origin, and its Economic Time as moment time, returning RequiredAnswerMissing for a blank first prompt', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);

    expect(await j.prepareEffects(complete())).toEqual({
      kind: 'Prepared',
      effects: {
        entries: [
          {
            entryTypeKey: 'entry-type.close-review',
            definitionId: DEFINITION,
            sourceKey: 'source.trade-close',
            obligationKey: { entryType: 'CloseReview', trade: 'trade-1' },
            anchor: { kind: 'Trade', ref: 'trade-1' },
            origin: { kind: 'PositionChange', ref: 'candidate:pc-2' },
            momentTime: TERMINAL_TIME,
            authoredTime: NOW,
            responses: [
              { promptId: TAKE_AGAIN, value: answers[TAKE_AGAIN] },
              { promptId: WORKED, value: answers[WORKED] },
              { promptId: LESSON, value: answers[LESSON] },
            ],
          },
        ],
        declines: [],
      },
      snapshot: { journalRevision: before.meta!['journalRevision'] },
    });
    expect(await stored(persistence)).toEqual(before);

    // The first prompt is required; the other two may stay blank and are saved as Unanswered.
    expect(await j.prepareEffects(complete({ [TAKE_AGAIN]: { kind: 'Text', text: '  ' }, [WORKED]: answers[WORKED] }))).toEqual({
      kind: 'Rejected',
      issues: [{ promptId: TAKE_AGAIN, code: 'RequiredAnswerMissing' }],
    });
    const minimal = await j.prepareEffects(complete({ [TAKE_AGAIN]: answers[TAKE_AGAIN] }));
    if (minimal.kind !== 'Prepared') throw new Error('expected Prepared');
    expect(minimal.effects.entries[0]?.responses).toEqual([
      { promptId: TAKE_AGAIN, value: answers[TAKE_AGAIN] },
      { promptId: WORKED, value: { kind: 'Unanswered' } },
      { promptId: LESSON, value: { kind: 'Unanswered' } },
    ]);
  });

  it('should prepare a decline under the same key with an optional reason of at most 500 characters', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);
    const expected = {
      entryTypeKey: 'entry-type.close-review',
      obligationKey: { entryType: 'CloseReview', trade: 'trade-1' },
      anchor: { kind: 'Trade', ref: 'trade-1' },
      sourceKey: 'source.trade-close',
      origin: { kind: 'PositionChange', ref: 'candidate:pc-2' },
      definitionId: DEFINITION,
      momentTime: TERMINAL_TIME,
      authoredTime: NOW,
    };
    const snapshot = { journalRevision: before.meta!['journalRevision'] };

    expect(await j.prepareEffects(request({ kind: 'Decline', definitionId: DEFINITION, reason: 'Nothing to add.' }))).toEqual({
      kind: 'Prepared',
      effects: { entries: [], declines: [{ ...expected, reason: 'Nothing to add.' }] },
      snapshot,
    });
    expect(await j.prepareEffects(request({ kind: 'Decline', definitionId: DEFINITION }))).toEqual({
      kind: 'Prepared',
      effects: { entries: [], declines: [expected] },
      snapshot,
    });
    expect(await j.prepareEffects(request({ kind: 'Decline', definitionId: DEFINITION, reason: 'x'.repeat(501) }))).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'ReasonTooLong' }],
    });
    expect((await j.prepareEffects(request({ kind: 'Decline', definitionId: DEFINITION, reason: 'x'.repeat(500) }))).kind).toBe('Prepared');
    expect(await stored(persistence)).toEqual(before);
  });

  it('should prepare an Outstanding Debt under the same key with due anchor the terminal Economic Time and rule OneSessionGrace', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);

    expect(await j.prepareEffects(request({ kind: 'Defer' }))).toEqual({
      kind: 'Prepared',
      effects: {
        entries: [],
        declines: [],
        debts: [
          {
            entryTypeKey: 'entry-type.close-review',
            definitionId: DEFINITION,
            sourceKey: 'source.trade-close',
            obligationKey: { entryType: 'CloseReview', trade: 'trade-1' },
            anchor: { kind: 'Trade', ref: 'trade-1' },
            origin: { kind: 'PositionChange', ref: 'candidate:pc-2' },
            momentTime: TERMINAL_TIME,
            dueAnchor: TERMINAL_TIME,
            dueRule: 'OneSessionGrace',
            route: 'JournalOnly',
          },
        ],
      },
      snapshot: { journalRevision: before.meta!['journalRevision'] },
    });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('save: ResolveDebt for a Close Review Debt', () => {
  it('should answer it with a Close Review Entry validated against the Debt snapshot, Source Trade Detail, and settledDebtId', async () => {
    const { journal: j, persistence } = await seeded();
    const prepared = await j.prepareEffects(request({ kind: 'Defer' }));
    if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
    const tx = beginSemanticTransaction();
    const staged = j.applyPreparedEffects(tx, prepared, { 'candidate:pc-2': 'pc-2' });
    expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    const debt = staged.debts![0]!;
    expect(debt.obligationKey).toBe('CloseReview:trade-1');

    const result = await j.save({
      intention: 'ResolveDebt',
      debtId: debt.debtId,
      expectedDebtRevision: debt.revision,
      resolution: { kind: 'Answer', form: { definitionId: DEFINITION, answers } },
    });

    if (result.kind !== 'Saved') throw new Error(`expected Saved, got ${result.kind}`);
    expect(result.entry).toEqual({
      id: result.entry!.id,
      entryTypeKey: 'entry-type.close-review',
      sourceKey: 'source.trade-detail',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      origin: { kind: 'PositionChange', factId: 'pc-2' },
      momentTime: TERMINAL_TIME,
      authoredTime: NOW,
      definitionId: DEFINITION,
      responses: [
        { promptId: TAKE_AGAIN, value: answers[TAKE_AGAIN] },
        { promptId: WORKED, value: answers[WORKED] },
        { promptId: LESSON, value: answers[LESSON] },
      ],
      settledDebtId: debt.debtId,
    });
    expect(result.debt).toEqual(expect.objectContaining({ debtId: debt.debtId, status: 'Settled', entryId: result.entry!.id }));
    expect(result.currentOutcome).toEqual({ kind: 'Entry', id: result.entry!.id });
    const after = await stored(persistence);
    expect(after.obligations).toEqual([expect.objectContaining({ obligationKey: 'CloseReview:trade-1', outcome: { kind: 'Entry', id: result.entry!.id } })]);
  });
});
