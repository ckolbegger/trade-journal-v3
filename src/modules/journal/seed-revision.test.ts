import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { beginSemanticTransaction } from '../../persistence/index.ts';
import { prepareRestore } from './restore.ts';
import { createJournal, D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST, D4_JOURNAL_MANIFEST, D5_JOURNAL_MANIFEST, type CloseReviewRequest, type JournalSeedManifest } from './index.ts';

// T95.27: a seeded form can be revised (D9.5 P173, A321). Manifest 6 itself is T95.28's; these cases
// use a stand-in version 6 that revises the Close Review's key lesson to required.
const NOW = '2026-11-24T16:00:00Z';
const CLOSE_REVIEW = 'entry-type.close-review';
const KEY_LESSON = 'prompt.close-review.key-lesson';

const revisedCloseReview: JournalSeedManifest = {
  ...D5_JOURNAL_MANIFEST,
  version: 6,
  entryTypes: D5_JOURNAL_MANIFEST.entryTypes.map((type) =>
    type.productKey === CLOSE_REVIEW
      ? { ...type, prompts: type.prompts.map((p) => (p.id === KEY_LESSON ? { ...p, required: true } : p)) }
      : type,
  ),
};

const revisedDaily: JournalSeedManifest = {
  ...D5_JOURNAL_MANIFEST,
  version: 6,
  entryTypes: D5_JOURNAL_MANIFEST.entryTypes.map((type) =>
    type.productKey === 'entry-type.daily-trade-review'
      ? { ...type, prompts: type.prompts.map((p) => (p.id === 'prompt.daily-trade-review.note' ? { ...p, text: 'Anything else?' } : p)) }
      : type,
  ),
};

// A stand-in revision of the Position Change Reflection that places a Plan Departure Reason prompt.
const DEPARTURE = 'prompt.position-change-reflection.plan-departure';
const revisedReflection: JournalSeedManifest = {
  ...D5_JOURNAL_MANIFEST,
  version: 6,
  entryTypes: D5_JOURNAL_MANIFEST.entryTypes.map((type) =>
    type.productKey === 'entry-type.position-change-reflection'
      ? { ...type, prompts: [...type.prompts, { id: DEPARTURE, kind: 'Text' as const, text: 'Why did you leave the Plan?', required: false, role: 'PlanDepartureReason' as const }] }
      : type,
  ),
};

async function seededAt5() {
  const { persistence, factory } = await emptyWorkspace();
  const journal = createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) });
  for (const manifest of [D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST, D4_JOURNAL_MANIFEST, D5_JOURNAL_MANIFEST]) {
    await journal.seedDefaults(manifest);
  }
  return { persistence, factory, journal };
}

async function definitionsOf(persistence: Awaited<ReturnType<typeof emptyWorkspace>>['persistence'], entryTypeKey: string) {
  const { value } = await persistence.readSnapshot(['journalDefinitions'], (tx) => tx.getAll('journalDefinitions'));
  return (value as unknown as { id: string; entryTypeKey: string; revisionNumber: number; prompts: unknown[] }[])
    .filter((d) => d.entryTypeKey === entryTypeKey)
    .sort((a, b) => a.revisionNumber - b.revisionNumber);
}

type Seeded = Awaited<ReturnType<typeof seededAt5>>;

const TAKE_AGAIN = 'prompt.close-review.take-again';
const closeAnswers = {
  [TAKE_AGAIN]: { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' },
  [KEY_LESSON]: { kind: 'Text', text: 'Size down into earnings.' },
} as const;

const closeRequest = (disposition: unknown) =>
  ({
    obligation: 'CloseReview',
    disposition,
    anchor: { kind: 'Trade', ref: 'trade-1' },
    origin: { kind: 'PositionChange', ref: 'candidate:pc-2' },
    momentTime: '2026-11-20T15:00:00Z',
  }) as unknown as CloseReviewRequest;

// Prepares, stages and commits one request the way the owning workflow does.
async function commit(setup: Seeded, request: ReturnType<typeof closeRequest>) {
  const prepared = await setup.journal.prepareEffects(request as never);
  if (prepared.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(prepared)}`);
  const tx = beginSemanticTransaction();
  const staged = setup.journal.applyPreparedEffects(tx, prepared, { 'candidate:pc-1': 'pc-1', 'candidate:pc-2': 'pc-2' });
  expect((await setup.persistence.commit(tx.close())).kind).toBe('Committed');
  return staged;
}

describe('seedDefaults: a revised form (P173)', () => {
  it('should add revision 2 of an Entry Type whose stored revision 1 equals an earlier seeded form and differs from the manifest', async () => {
    const { persistence, journal } = await seededAt5();
    const result = await journal.seedDefaults(revisedCloseReview);
    expect(result.kind).toBe('Seeded');
    const definitions = await definitionsOf(persistence, CLOSE_REVIEW);
    expect(definitions.map((d) => d.revisionNumber)).toEqual([1, 2]);
    expect(definitions[0]!.prompts).toEqual(D5_JOURNAL_MANIFEST.entryTypes.find((t) => t.productKey === CLOSE_REVIEW)!.prompts);
    expect(definitions[1]!.prompts).toEqual(revisedCloseReview.entryTypes.find((t) => t.productKey === CLOSE_REVIEW)!.prompts);
  });

  it('should add nothing when run again', async () => {
    const { persistence, journal } = await seededAt5();
    const first = await journal.seedDefaults(revisedCloseReview);
    const again = await journal.seedDefaults(revisedCloseReview);
    expect(again).toEqual({ kind: 'Seeded', additions: [], snapshot: first.kind === 'Seeded' ? first.snapshot : undefined });
    expect((await definitionsOf(persistence, CLOSE_REVIEW)).map((d) => d.revisionNumber)).toEqual([1, 2]);
  });

  it('should name the revised Entry Types among its additions', async () => {
    const { journal } = await seededAt5();
    const result = await journal.seedDefaults(revisedCloseReview);
    expect(result.kind === 'Seeded' && result.additions).toEqual([CLOSE_REVIEW]);
  });

  it('should seed a new Workspace Entry Type at the manifest prompts as revision 1', async () => {
    const { persistence, journal } = await emptyWorkspace().then(({ persistence }) => ({
      persistence,
      journal: createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) }),
    }));
    await journal.seedDefaults(revisedCloseReview);
    const definitions = await definitionsOf(persistence, CLOSE_REVIEW);
    expect(definitions.map((d) => d.revisionNumber)).toEqual([1]);
    expect(definitions[0]!.prompts).toEqual(revisedCloseReview.entryTypes.find((t) => t.productKey === CLOSE_REVIEW)!.prompts);
  });

  it('should still return SeedConflict when the latest stored revision equals no seeded form', async () => {
    const { persistence, journal } = await emptyWorkspace().then(({ persistence }) => ({
      persistence,
      journal: createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) }),
    }));
    const edited: JournalSeedManifest = {
      ...D5_JOURNAL_MANIFEST,
      entryTypes: D5_JOURNAL_MANIFEST.entryTypes.map((type) =>
        type.productKey === CLOSE_REVIEW
          ? { ...type, prompts: type.prompts.map((p) => (p.id === KEY_LESSON ? { ...p, text: 'A form no manifest ever seeded' } : p)) }
          : type,
      ),
    };
    await journal.seedDefaults(edited);
    const before = await definitionsOf(persistence, CLOSE_REVIEW);
    expect(await journal.seedDefaults(revisedCloseReview)).toEqual({ kind: 'SeedConflict', productKey: CLOSE_REVIEW });
    expect(await definitionsOf(persistence, CLOSE_REVIEW)).toEqual(before);
  });

  it('should return SeedConflict when an earlier revision equals the manifest but the latest equals no seeded form', async () => {
    const { persistence } = await emptyWorkspace();
    const journal = createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) });
    await journal.seedDefaults(revisedCloseReview);
    const [first] = await definitionsOf(persistence, CLOSE_REVIEW);
    const unrecognized = { ...first, id: 'def-edited', revisionNumber: 2, prompts: (first!.prompts as { id: string }[]).map((p) => (p.id === KEY_LESSON ? { ...p, text: 'A form no manifest ever seeded' } : p)) };
    expect((await persistence.commit({ checks: [], writes: [{ op: 'put', store: 'journalDefinitions', value: unrecognized }] })).kind).toBe('Committed');
    const before = await definitionsOf(persistence, CLOSE_REVIEW);
    expect(await journal.seedDefaults(revisedCloseReview)).toEqual({ kind: 'SeedConflict', productKey: CLOSE_REVIEW });
    expect(await definitionsOf(persistence, CLOSE_REVIEW)).toEqual(before);
  });
});

describe('a revised form: entries and Debts keep the revision they were made under (P173)', () => {
  it('should offer the new revision as the latest for a new entry, and refuse a new entry under the earlier one', async () => {
    const setup = await seededAt5();
    await setup.journal.seedDefaults(revisedCloseReview);
    const [earlier, latest] = await definitionsOf(setup.persistence, CLOSE_REVIEW);
    const offered = await setup.journal.getDefinitions({ latestFor: CLOSE_REVIEW });
    expect(offered.kind === 'Found' && offered.definition.id).toBe(latest!.id);

    const refused = await setup.journal.prepareEffects(closeRequest({ kind: 'Complete', form: { definitionId: earlier!.id, answers: closeAnswers } }));
    expect(refused).toEqual({ kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] });
    const accepted = await setup.journal.prepareEffects(closeRequest({ kind: 'Complete', form: { definitionId: latest!.id, answers: closeAnswers } }));
    expect(accepted.kind).toBe('Prepared');
  });
});

describe('a revised form: a Debt keeps the revision it was owed under', () => {
  it('should keep a Debt on the revision it was owed under and resolve it under that revision', async () => {
    const setup = await seededAt5();
    const [earlier] = await definitionsOf(setup.persistence, CLOSE_REVIEW);
    const staged = await commit(setup, closeRequest({ kind: 'Defer' }));
    const debt = staged.debts![0]!;
    expect(debt.definitionId).toBe(earlier!.id);

    await setup.journal.seedDefaults(revisedCloseReview);
    const [, latest] = await definitionsOf(setup.persistence, CLOSE_REVIEW);
    const command = (definitionId: string) =>
      ({
        intention: 'ResolveDebt',
        debtId: debt.debtId,
        expectedDebtRevision: debt.revision,
        resolution: { kind: 'Answer', form: { definitionId, answers: { [TAKE_AGAIN]: closeAnswers[TAKE_AGAIN] } } },
      }) as const;
    // The later revision requires the key lesson, but this Debt was owed under the form where it is optional.
    expect(await setup.journal.save(command(latest!.id))).toEqual({ kind: 'Rejected', issues: [{ code: 'DefinitionRevisionMismatch' }] });
    const saved = await setup.journal.save(command(earlier!.id));
    expect(saved.kind === 'Saved' && saved.entry?.definitionId).toBe(earlier!.id);
  });
});

describe('a revised form: an entry keeps the revision it was saved under', () => {
  it('should change an entry saved under the earlier revision under that revision', async () => {
    const setup = await seededAt5();
    const DAILY = 'entry-type.daily-trade-review';
    const [earlier] = await definitionsOf(setup.persistence, DAILY);
    const dailyRequest = (definitionId: string, action: string, extra: Record<string, unknown> = {}) =>
      ({
        obligation: 'DailyTradeReview',
        disposition: {
          kind: 'Complete',
          form: {
            definitionId,
            answers: {
              'prompt.daily-trade-review.action': { kind: 'Option', optionId: `option.daily-trade-review.action.${action}` },
              ...(action === 'exit' ? { 'prompt.daily-trade-review.intent': { kind: 'Text', text: 'Stop was breached.' } } : {}),
            },
          },
        },
        anchor: { kind: 'Trade', ref: 'trade-1' },
        origin: { kind: 'DailyReview', ref: 'trade-1', reviewDate: '2026-11-23' },
        momentTime: '2026-11-23T22:00:00Z',
        ...extra,
      }) as unknown as ReturnType<typeof closeRequest>;
    await commit(setup, dailyRequest(earlier!.id, 'hold'));
    await setup.journal.seedDefaults(revisedDaily);
    const [, latest] = await definitionsOf(setup.persistence, DAILY);

    expect(await setup.journal.prepareEffects(dailyRequest(latest!.id, 'exit', { expectedEntryRevision: 1 }) as never)).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'DefinitionRevisionMismatch' }],
    });
    await commit(setup, dailyRequest(earlier!.id, 'exit', { expectedEntryRevision: 1 }));
    const { value } = await setup.persistence.readSnapshot(['journalEntries'], (tx) => tx.getAll('journalEntries'));
    const [entry] = value as unknown as { versions: { definitionId: string }[] }[];
    expect(entry!.versions.map((v) => v.definitionId)).toEqual([earlier!.id, earlier!.id]);
  });
});

describe('a restored stored form shape (A321)', () => {
  const definition = (extra: { optionExtra?: Record<string, unknown>; promptExtra?: Record<string, unknown> } = {}) => ({
    id: 'def-1',
    entryTypeKey: 'entry-type.position-change-reflection',
    revisionNumber: 2,
    prompts: [
      { id: 'p.action', kind: 'SingleSelect', text: 'Action', required: true, options: [{ id: 'o.hold', label: 'Hold' }, { id: 'o.later', label: 'Settle Later', protected: true, ...extra.optionExtra }] },
      { id: 'p.departure', kind: 'Text', text: 'Why did you leave the Plan?', required: false, role: 'PlanDepartureReason' },
      { id: 'p.expiration', kind: 'Text', text: 'Why?', required: false, role: 'ExpirationReason', ...extra.promptExtra },
    ],
  });
  const parse = (record: unknown) => prepareRestore().parse('journalDefinitions', [{ line: 1, record }]);

  it('should accept, in a restored definition, an option marked protected and the two new roles, and still refuse an unknown field', () => {
    expect(parse(definition()).kind).toBe('Parsed');
    expect(parse(definition({ optionExtra: { sticky: true } }))).toMatchObject({ kind: 'Rejected', issues: [{ code: 'MalformedRecord', path: 'prompts.0.options.1.sticky' }] });
    expect(parse(definition({ promptExtra: { weight: 1 } })).kind).toBe('Rejected');
  });
});

describe('a deferred reflection carries the roles its answer must include (U14, A321)', () => {
  const reflectionRequest = (disposition: unknown) =>
    ({
      obligation: 'PositionChangeReflection',
      disposition,
      anchor: { kind: 'Trade', ref: 'trade-1' },
      origin: { kind: 'PositionChange', ref: 'candidate:pc-1' },
      momentTime: '2026-11-20T15:00:00Z',
    }) as unknown as ReturnType<typeof closeRequest>;

  async function owed() {
    const setup = await seededAt5();
    await setup.journal.seedDefaults(revisedReflection);
    const staged = await commit(setup, reflectionRequest({ kind: 'Defer', requires: ['PlanDepartureReason'] }));
    return { ...setup, debt: staged.debts![0]! };
  }

  it('should keep on a deferred reflection Debt the roles its answer must include', async () => {
    const setup = await owed();
    const { value } = await setup.persistence.readSnapshot(['journalDebts'], (tx) => tx.getAll('journalDebts'));
    expect((value as unknown as { debtId: string; requires?: string[] }[]).map((d) => [d.debtId, d.requires])).toEqual([[setup.debt.debtId, ['PlanDepartureReason']]]);
  });

  it('should return the required roles on the Debt projection, from the save that created it and from query', async () => {
    const setup = await owed();
    expect(setup.debt.requires).toEqual(['PlanDepartureReason']);
    const page = await setup.journal.query({ scope: 'OutstandingDebt' });
    expect(page.kind === 'Debts' && page.debts.map((d) => [d.debtId, d.requires])).toEqual([[setup.debt.debtId, ['PlanDepartureReason']]]);
  });

  it('should refuse a deferral that requires a role the pinned form has no Text prompt for', async () => {
    const setup = await seededAt5();
    expect(await setup.journal.prepareEffects(reflectionRequest({ kind: 'Defer', requires: ['PlanDepartureReason'] }))).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'DispositionNotAllowed' }],
    });
  });

  it('should refuse to resolve that Debt with an answer missing a required role, and still let it be declined', async () => {
    const setup = await owed();
    const [, latest] = await definitionsOf(setup.persistence, 'entry-type.position-change-reflection');
    const base = {
      'prompt.position-change-reflection.decision-mode': { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
      'prompt.position-change-reflection.primary-emotion': { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
      'prompt.position-change-reflection.decision-confidence': { kind: 'Scale', value: 4 },
    } as const;
    const answer = (answers: Record<string, unknown>) =>
      ({
        intention: 'ResolveDebt',
        debtId: setup.debt.debtId,
        expectedDebtRevision: setup.debt.revision,
        resolution: { kind: 'Answer', form: { definitionId: latest!.id, answers } },
      }) as never;
    expect(await setup.journal.save(answer(base))).toEqual({ kind: 'Rejected', issues: [{ promptId: DEPARTURE, code: 'RequiredAnswerMissing' }] });
    expect(await setup.journal.save(answer({ ...base, [DEPARTURE]: { kind: 'Text', text: '   ' } }))).toMatchObject({ kind: 'Rejected' });
    expect((await setup.journal.save(answer({ ...base, [DEPARTURE]: { kind: 'Text', text: 'The Stop was hit.' } }))).kind).toBe('Saved');

    // Declining is still the trader's choice.
    const another = await owed();
    const declined = await another.journal.save({
      intention: 'ResolveDebt',
      debtId: another.debt.debtId,
      expectedDebtRevision: another.debt.revision,
      resolution: { kind: 'Decline', reason: 'Nothing to add.' },
    } as never);
    expect(declined.kind).toBe('Saved');
  });
});

describe('a restored Debt', () => {
  const debt = (extra: Record<string, unknown> = {}) => ({
    debtId: 'debt-1',
    obligationKey: 'PositionChangeReflection:pc-1',
    entryTypeKey: 'entry-type.position-change-reflection',
    sourceKey: 'source.position-change',
    definitionId: 'def-2',
    anchor: { kind: 'Trade', tradeId: 'trade-1' },
    origin: { kind: 'PositionChange', factId: 'pc-1' },
    momentTime: '2026-11-20T15:00:00Z',
    dueAnchor: '2026-11-20T15:00:00Z',
    dueRule: 'OneSessionGrace',
    route: 'JournalOnly',
    anchorTradeId: 'trade-1',
    outstandingDue: '2026-11-20T15:00:00Z',
    versions: [{ versionId: 'v-1', status: 'Outstanding', savedAt: '2026-11-20T15:00:00Z' }],
    ...extra,
  });
  const parse = (record: unknown) => prepareRestore().parse('journalDebts', [{ line: 1, record }]);

  it('should accept a Debt carrying required roles in a restored Workspace', () => {
    expect(parse(debt({ requires: ['PlanDepartureReason'] })).kind).toBe('Parsed');
    expect(parse(debt({ requires: ['Unknown'] })).kind).toBe('Rejected');
    expect(parse(debt({ needs: ['PlanDepartureReason'] })).kind).toBe('Rejected');
  });
});
