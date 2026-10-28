/* eslint-disable @typescript-eslint/no-unsafe-assignment -- asymmetric matchers inside toEqual return any */
import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, type Persistence } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createJournal, D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST, D3_JOURNAL_MANIFEST, type DailyTradeReviewRequest } from './index.ts';

const clock = fixedClock('2026-10-12T21:30:00Z');

async function journal() {
  const { persistence, factory } = await emptyWorkspace();
  return { journal: createJournal({ persistence, ids: sequentialIds('j'), clock }), persistence, factory };
}

async function stored(persistence: Persistence) {
  const { value } = await persistence.readSnapshot(
    ['journalTypes', 'journalDefinitions', 'journalEntries', 'journalDeclines', 'journalObligations', 'meta'],
    async (tx) => ({
      types: await tx.getAll('journalTypes'),
      definitions: await tx.getAll('journalDefinitions'),
      entries: await tx.getAll('journalEntries'),
      declines: await tx.getAll('journalDeclines'),
      obligations: await tx.getAll('journalObligations'),
      meta: await tx.get('meta', 'journal'),
    }),
  );
  return value;
}

describe('seedDefaults: manifest v3', () => {
  it('should add the Daily Trade Review Entry Type, its definition revision 1, and the Daily Review Source, and nothing else, to a v2-seeded Journal', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    await j.seedDefaults(D2_JOURNAL_MANIFEST);
    const before = await stored(persistence);

    const result = await j.seedDefaults(D3_JOURNAL_MANIFEST);

    expect(D3_JOURNAL_MANIFEST.version).toBe(3);
    expect(result).toEqual({
      kind: 'Seeded',
      additions: ['entry-type.daily-trade-review', 'source.daily-review'],
      snapshot: { journalRevision: 3 },
    });
    const after = await stored(persistence);
    const byId = (records: Record<string, unknown>[]) => [...records].sort((a, b) => String(a['id']).localeCompare(String(b['id'])));
    expect(byId(after.types)).toEqual(
      byId([
        ...before.types,
        { id: 'entry-type.daily-trade-review', kind: 'EntryType', productKey: 'entry-type.daily-trade-review', label: 'Daily Trade Review', revision: 4 },
        { id: 'source.daily-review', kind: 'Source', productKey: 'source.daily-review', label: 'Daily Review', revision: 4 },
      ]),
    );
    expect(after.definitions).toHaveLength(3);
    expect(after.definitions).toEqual(
      expect.arrayContaining([...before.definitions, expect.objectContaining({ entryTypeKey: 'entry-type.daily-trade-review', revisionNumber: 1 })]),
    );
    expect(after.entries).toEqual([]);
  });
});

describe('seedDefaults: manifest v3 contract', () => {
  it('should match the contract exactly: "Action" required workflow-critical Single Select (Hold, Exit, Roll, Adjust); "Why are you taking this action?" Text required when Action is Exit, Roll, or Adjust; "Conviction now" optional Scale 1–5; "Anything you considered doing and decided against?" optional Text; "Note" optional Text, in that order', async () => {
    const { journal: j } = await journal();
    await j.seedDefaults(D3_JOURNAL_MANIFEST);
    const result = await j.getDefinitions({ latestFor: 'entry-type.daily-trade-review' });
    if (result.kind !== 'Found') throw new Error('expected the definition');
    const option = (label: string) => ({ id: `option.daily-trade-review.action.${label.toLowerCase()}`, label });
    expect(result.definition.revisionNumber).toBe(1);
    expect(result.definition.prompts).toEqual([
      {
        id: 'prompt.daily-trade-review.action',
        kind: 'SingleSelect',
        text: 'Action',
        required: true,
        role: 'Action',
        options: ['Hold', 'Exit', 'Roll', 'Adjust'].map(option),
      },
      {
        id: 'prompt.daily-trade-review.intent',
        kind: 'Text',
        text: 'Why are you taking this action?',
        required: false,
        role: 'Intent',
        requiredWhen: {
          promptId: 'prompt.daily-trade-review.action',
          optionIds: ['Exit', 'Roll', 'Adjust'].map((label) => option(label).id),
        },
      },
      { id: 'prompt.daily-trade-review.conviction', kind: 'Scale', text: 'Conviction now', required: false, min: 1, max: 5 },
      { id: 'prompt.daily-trade-review.considered', kind: 'Text', text: 'Anything you considered doing and decided against?', required: false },
      { id: 'prompt.daily-trade-review.note', kind: 'Text', text: 'Note', required: false },
    ]);
  });
});

describe('seedDefaults: manifest v3 repeat', () => {
  it('should add nothing when run again', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D3_JOURNAL_MANIFEST);
    const before = await stored(persistence);
    expect(await j.seedDefaults(D3_JOURNAL_MANIFEST)).toEqual({ kind: 'Seeded', additions: [], snapshot: { journalRevision: 1 } });
    expect(await stored(persistence)).toEqual(before);
  });
});

const ACTION = 'prompt.daily-trade-review.action';
const INTENT = 'prompt.daily-trade-review.intent';
const CONVICTION = 'prompt.daily-trade-review.conviction';
const NOTE = 'prompt.daily-trade-review.note';
const option = (label: string) => ({ kind: 'Option', optionId: `option.daily-trade-review.action.${label.toLowerCase()}` }) as const;
// Seeding v1, v2, then v3 on an empty Journal: the third definition is Daily Trade Review.
const DEFINITION = 'j-0003';

async function seeded() {
  const setup = await journal();
  await setup.journal.seedDefaults(D1_JOURNAL_MANIFEST);
  await setup.journal.seedDefaults(D2_JOURNAL_MANIFEST);
  await setup.journal.seedDefaults(D3_JOURNAL_MANIFEST);
  return setup;
}

type Request = DailyTradeReviewRequest;

// Review Date Monday 2026-10-12; its cutoff is 17:00 New York.
function request(disposition: unknown, extra: Record<string, unknown> = {}): Request {
  return {
    obligation: 'DailyTradeReview',
    disposition,
    anchor: { kind: 'Trade', ref: 'trade-1' },
    origin: { kind: 'DailyReview', ref: 'trade-1', reviewDate: '2026-10-12' },
    momentTime: '2026-10-12T21:00:00Z',
    ...extra,
  } as Request;
}

const complete = (answers: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  request({ kind: 'Complete', form: { definitionId: DEFINITION, answers } }, extra);

describe('prepareEffects: Daily Trade Review (CompleteNow)', () => {
  it('should prepare an Entry with the definition snapshot, a Trade Anchor, Source Daily Review, origin DailyReview (Trade, Review Date), moment time at the Review cutoff, and authored time from the clock', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);
    const result = await j.prepareEffects(complete({ [ACTION]: option('Hold'), [CONVICTION]: { kind: 'Scale', value: 4 } }));
    expect(result).toEqual({
      kind: 'Prepared',
      effects: {
        entries: [
          {
            entryTypeKey: 'entry-type.daily-trade-review',
            definitionId: DEFINITION,
            sourceKey: 'source.daily-review',
            obligationKey: { entryType: 'DailyTradeReview', trade: 'trade-1', reviewDate: '2026-10-12' },
            anchor: { kind: 'Trade', ref: 'trade-1' },
            origin: { kind: 'DailyReview', ref: 'trade-1', reviewDate: '2026-10-12' },
            momentTime: '2026-10-12T21:00:00Z',
            authoredTime: '2026-10-12T21:30:00Z',
            responses: [
              { promptId: ACTION, value: option('Hold') },
              { promptId: INTENT, value: { kind: 'Unanswered' } },
              { promptId: CONVICTION, value: { kind: 'Scale', value: 4 } },
              { promptId: 'prompt.daily-trade-review.considered', value: { kind: 'Unanswered' } },
              { promptId: NOTE, value: { kind: 'Unanswered' } },
            ],
          },
        ],
        declines: [],
      },
      snapshot: { journalRevision: 3 },
    });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('prepareEffects: Daily Trade Review Intent', () => {
  it('should accept Hold with no Intent and return RequiredAnswerMissing for Exit, Roll, or Adjust without Intent', async () => {
    const { journal: j } = await seeded();
    expect((await j.prepareEffects(complete({ [ACTION]: option('Hold') }))).kind).toBe('Prepared');
    for (const action of ['Exit', 'Roll', 'Adjust']) {
      for (const blank of [{}, { [INTENT]: { kind: 'Text', text: '  ' } }]) {
        expect(await j.prepareEffects(complete({ [ACTION]: option(action), ...blank }))).toEqual({
          kind: 'Rejected',
          issues: [{ promptId: INTENT, code: 'RequiredAnswerMissing' }],
        });
      }
      const withIntent = await j.prepareEffects(complete({ [ACTION]: option(action), [INTENT]: { kind: 'Text', text: 'Thesis played out.' } }));
      expect(withIntent.kind).toBe('Prepared');
    }
  });
});

describe('prepareEffects: Daily Trade Review dispositions', () => {
  it('should reject Defer and Decline with DispositionNotAllowed', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);
    for (const disposition of [{ kind: 'Defer' }, { kind: 'Decline', definitionId: DEFINITION }, { kind: 'Decline', definitionId: DEFINITION, reason: 'x' }]) {
      expect(await j.prepareEffects(request(disposition))).toEqual({ kind: 'Rejected', issues: [{ code: 'DispositionNotAllowed' }] });
    }
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('edit by expected revision (AC-JOUR-005)', () => {
  const KEY = ['DailyTradeReview', '2026-10-12', 'trade-1'];

  async function apply(j: Awaited<ReturnType<typeof seeded>>['journal'], persistence: Persistence, req: Request) {
    const result = await j.prepareEffects(req);
    if (result.kind !== 'Prepared') throw new Error(`expected Prepared, got ${JSON.stringify(result)}`);
    const tx = beginSemanticTransaction();
    const staged = j.applyPreparedEffects(tx, result, {});
    return { staged, committed: await persistence.commit(tx.close()) };
  }

  it('should append a version under the same Entry identity, using the original definition snapshot, when the obligation already has an Entry and the expected Entry revision matches', async () => {
    const { journal: j, persistence } = await seeded();
    const first = await apply(j, persistence, complete({ [ACTION]: option('Hold') }));
    expect(first.committed.kind).toBe('Committed');
    const created = await stored(persistence);
    expect(created.obligations).toEqual([expect.objectContaining({ obligationKey: KEY, outcome: { kind: 'Entry', id: first.staged.entries[0]!.id } })]);
    // A later definition revision exists; the edit still uses the Entry's original snapshot.
    await persistence.commit({
      checks: [],
      writes: [{ op: 'put', store: 'journalDefinitions', value: { id: 'j-next', entryTypeKey: 'entry-type.daily-trade-review', revisionNumber: 2, prompts: [] } }],
    });

    const later = createJournal({ persistence, ids: sequentialIds('k'), clock: fixedClock('2026-10-13T09:00:00Z') });
    const edit = await apply(later, persistence, complete({ [ACTION]: option('Exit'), [INTENT]: { kind: 'Text', text: 'Target reached.' } }, { expectedEntryRevision: 1 }));

    expect(edit.committed.kind).toBe('Committed');
    expect(edit.staged.entries).toEqual([
      expect.objectContaining({
        id: first.staged.entries[0]!.id,
        definitionId: DEFINITION,
        momentTime: '2026-10-12T21:00:00Z',
        authoredTime: '2026-10-12T21:30:00Z',
      }),
    ]);
    const after = await stored(persistence);
    expect(after.entries).toHaveLength(1);
    expect(after.obligations).toHaveLength(1);
    const versions = (after.entries[0] as { versions: Record<string, unknown>[] }).versions;
    expect(versions).toEqual([
      (created.entries[0] as { versions: unknown[] }).versions[0],
      {
        versionNumber: 2,
        definitionId: DEFINITION,
        savedAt: '2026-10-13T09:00:00Z',
        responses: expect.arrayContaining([
          { promptId: ACTION, value: option('Exit') },
          { promptId: INTENT, value: { kind: 'Text', text: 'Target reached.' } },
        ]),
      },
    ]);
    expect(after.entries[0]).toEqual(expect.objectContaining({ id: first.staged.entries[0]!.id, authoredTime: '2026-10-12T21:30:00Z', obligationKey: KEY }));
  });

  it('should return Conflict when the expected Entry revision is stale, and fail the transaction on a second new Entry for the same key', async () => {
    const { journal: j, persistence } = await seeded();
    const prepareNew = await j.prepareEffects(complete({ [ACTION]: option('Hold') }));
    const prepareRetry = await j.prepareEffects(complete({ [ACTION]: option('Hold') }));
    if (prepareNew.kind !== 'Prepared' || prepareRetry.kind !== 'Prepared') throw new Error('expected Prepared');
    const stage = (prepared: typeof prepareNew) => {
      const tx = beginSemanticTransaction();
      j.applyPreparedEffects(tx, prepared, {});
      return persistence.commit(tx.close());
    };
    expect((await stage(prepareNew)).kind).toBe('Committed');
    // A second new Entry for the same (Trade, Review Date) key fails the whole transaction.
    expect(await stage(prepareRetry)).toEqual(expect.objectContaining({ kind: 'ConstraintViolation' }));
    expect((await stored(persistence)).entries).toHaveLength(1);

    expect((await apply(j, persistence, complete({ [ACTION]: option('Roll'), [INTENT]: { kind: 'Text', text: 'Roll out.' } }, { expectedEntryRevision: 1 }))).committed.kind).toBe('Committed');
    const before = await stored(persistence);
    // Revision 1 is now stale; so is a save that names no revision for a key that has an Entry.
    expect(await j.prepareEffects(complete({ [ACTION]: option('Hold') }, { expectedEntryRevision: 1 }))).toEqual({ kind: 'Conflict' });
    expect(await j.prepareEffects(complete({ [ACTION]: option('Hold') }))).toEqual({ kind: 'Conflict' });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('query: Actions for a Review Date', () => {
  it('should return every Action for a Review Date with one range read, keyed by Trade', async () => {
    const { journal: setup, persistence } = await seeded();
    const save = async (tradeId: string, reviewDate: string, answers: Record<string, unknown>, expectedEntryRevision?: number) => {
      const req = {
        ...complete(answers, expectedEntryRevision === undefined ? {} : { expectedEntryRevision }),
        anchor: { kind: 'Trade', ref: tradeId },
        origin: { kind: 'DailyReview', ref: tradeId, reviewDate },
      } as Request;
      const prepared = await setup.prepareEffects(req);
      if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
      const tx = beginSemanticTransaction();
      setup.applyPreparedEffects(tx, prepared, {});
      expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    };
    await save('trade-1', '2026-10-12', { [ACTION]: option('Hold') });
    await save('trade-2', '2026-10-12', { [ACTION]: option('Roll'), [INTENT]: { kind: 'Text', text: 'Roll out a month.' } });
    await save('trade-1', '2026-10-13', { [ACTION]: option('Exit'), [INTENT]: { kind: 'Text', text: 'Done.' } });
    await save('trade-1', '2026-10-12', { [ACTION]: option('Adjust'), [INTENT]: { kind: 'Text', text: 'Tighten.' } }, 1);

    const reads: string[] = [];
    const counting: Persistence = {
      ...persistence,
      readSnapshot: (stores, read) =>
        persistence.readSnapshot(stores, (tx) =>
          read({
            ...tx,
            getAll: (store) => (reads.push(`getAll:${store}`), tx.getAll(store)),
            getAllInRange: (store, range) => (reads.push(`range:${store}`), tx.getAllInRange(store, range)),
          }),
        ),
    };
    const result = await createJournal({ persistence: counting, ids: sequentialIds('q'), clock }).queryActions({ reviewDate: '2026-10-12' });

    expect(reads.filter((r) => r.endsWith('journalObligations'))).toEqual(['range:journalObligations']);
    expect(result).toEqual({
      kind: 'Actions',
      reviewDate: '2026-10-12',
      actions: {
        'trade-1': expect.objectContaining({ action: 'Adjust', entryRevision: 2, anchor: { kind: 'Trade', tradeId: 'trade-1' } }),
        'trade-2': expect.objectContaining({ action: 'Roll', entryRevision: 1, anchor: { kind: 'Trade', tradeId: 'trade-2' } }),
      },
      snapshot: { journalRevision: expect.any(Number) },
    });
    expect(Object.keys((result as { actions: object }).actions)).toEqual(['trade-1', 'trade-2']);
  });
});

describe('query: Trade narrative', () => {
  it('should include Daily Trade Review Entries, with an Edited indicator when they have more than one version, in the Trade narrative', async () => {
    const { journal: j, persistence } = await seeded();
    const save = async (reviewDate: string, momentTime: string, answers: Record<string, unknown>, expectedEntryRevision?: number) => {
      const req = {
        ...complete(answers, expectedEntryRevision === undefined ? {} : { expectedEntryRevision }),
        origin: { kind: 'DailyReview', ref: 'trade-1', reviewDate },
        momentTime,
      } as Request;
      const prepared = await j.prepareEffects(req);
      if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
      const tx = beginSemanticTransaction();
      j.applyPreparedEffects(tx, prepared, {});
      expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    };
    await save('2026-10-12', '2026-10-12T21:00:00Z', { [ACTION]: option('Hold') });
    await save('2026-10-13', '2026-10-13T21:00:00Z', { [ACTION]: option('Hold') });
    await save('2026-10-13', '2026-10-13T21:00:00Z', { [ACTION]: option('Exit'), [INTENT]: { kind: 'Text', text: 'Done.' } }, 1);

    const page = await j.query({ scope: 'TradeNarrative', tradeId: 'trade-1' });

    const items = page.items.filter((item) => item.kind === 'Entry');
    expect(items).toEqual([
      expect.objectContaining({ entryType: 'Daily Trade Review', source: 'Daily Review', momentTime: '2026-10-12T21:00:00Z', responses: expect.arrayContaining([{ prompt: 'Action', answer: { kind: 'Option', label: 'Hold' } }]) }),
      expect.objectContaining({ momentTime: '2026-10-13T21:00:00Z', edited: true, responses: expect.arrayContaining([{ prompt: 'Action', answer: { kind: 'Option', label: 'Exit' } }]) }),
    ]);
    expect(items[0]).not.toHaveProperty('edited');
  });
});
