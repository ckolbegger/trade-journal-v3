import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { beginSemanticTransaction, rebuildPrivateState, type Persistence } from '../../persistence/index.ts';
import { emptyWorkspace, sequentialIds } from '../../../tests/support/workspace.ts';
import { createJournal, D1_JOURNAL_MANIFEST, D2_JOURNAL_MANIFEST } from './index.ts';

const clock = fixedClock('2026-10-12T15:05:00Z');

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

describe('seedDefaults: manifest v2', () => {
  it('should add the Position Change Reflection Entry Type, its definition revision 1, and the Position Change Source, and nothing else, to a v1-seeded Journal', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    const before = await stored(persistence);

    const result = await j.seedDefaults(D2_JOURNAL_MANIFEST);

    expect(D2_JOURNAL_MANIFEST.version).toBe(2);
    expect(result).toEqual({
      kind: 'Seeded',
      additions: ['entry-type.position-change-reflection', 'source.position-change'],
      snapshot: { journalRevision: 2 },
    });
    const after = await stored(persistence);
    // Records come back in key order; the v1 records are unchanged and only these two types are new,
    // written at the Workspace content revision of this seed commit.
    const byId = (records: Record<string, unknown>[]) => [...records].sort((a, b) => String(a['id']).localeCompare(String(b['id'])));
    expect(byId(after.types)).toEqual(
      byId([
        ...before.types,
        { id: 'entry-type.position-change-reflection', kind: 'EntryType', productKey: 'entry-type.position-change-reflection', label: 'Position Change Reflection', revision: 3 },
        { id: 'source.position-change', kind: 'Source', productKey: 'source.position-change', label: 'Position Change', revision: 3 },
      ]),
    );
    expect(after.definitions).toHaveLength(2);
    expect(after.definitions).toEqual(
      expect.arrayContaining([
        ...before.definitions,
        expect.objectContaining({ entryTypeKey: 'entry-type.position-change-reflection', revisionNumber: 1 }),
      ]),
    );
    expect(after.entries).toEqual([]);
  });

  it('should match the contract exactly: Decision mode required Single Select As Planned, Deliberate Adjustment, Reactive, Externally Imposed; Primary emotion required Single Select Calm, Eager, Anxious, FOMO, Revenge, Relieved, Frustrated, Other; Decision confidence required Scale 1–5; Note optional Text, in that order', async () => {
    const { journal: j } = await journal();
    await j.seedDefaults(D2_JOURNAL_MANIFEST);
    const result = await j.getDefinitions({ latestFor: 'entry-type.position-change-reflection' });
    if (result.kind !== 'Found') throw new Error('expected the definition');
    const options = (prompt: string, labels: string[]) =>
      labels.map((label) => ({
        id: `option.position-change-reflection.${prompt}.${label.toLowerCase().replaceAll(' ', '-')}`,
        label,
      }));
    expect(result.definition.revisionNumber).toBe(1);
    expect(result.definition.prompts).toEqual([
      {
        id: 'prompt.position-change-reflection.decision-mode',
        kind: 'SingleSelect',
        text: 'Decision mode',
        required: true,
        options: options('decision-mode', ['As Planned', 'Deliberate Adjustment', 'Reactive', 'Externally Imposed']),
      },
      {
        id: 'prompt.position-change-reflection.primary-emotion',
        kind: 'SingleSelect',
        text: 'Primary emotion',
        required: true,
        options: options('primary-emotion', ['Calm', 'Eager', 'Anxious', 'FOMO', 'Revenge', 'Relieved', 'Frustrated', 'Other']),
      },
      { id: 'prompt.position-change-reflection.decision-confidence', kind: 'Scale', text: 'Decision confidence', required: true, min: 1, max: 5 },
      { id: 'prompt.position-change-reflection.note', kind: 'Text', text: 'Note', required: false },
    ]);
  });

  it('should add nothing when run again with manifest v2', async () => {
    const { journal: j, persistence } = await journal();
    await j.seedDefaults(D1_JOURNAL_MANIFEST);
    await j.seedDefaults(D2_JOURNAL_MANIFEST);
    const before = await stored(persistence);
    expect(await j.seedDefaults(D2_JOURNAL_MANIFEST)).toEqual({ kind: 'Seeded', additions: [], snapshot: { journalRevision: 2 } });
    expect(await stored(persistence)).toEqual(before);
  });
});

const MODE = 'prompt.position-change-reflection.decision-mode';
const EMOTION = 'prompt.position-change-reflection.primary-emotion';
const CONFIDENCE = 'prompt.position-change-reflection.decision-confidence';
const NOTE = 'prompt.position-change-reflection.note';
// Seeding manifest v2 on an empty Journal: j-0001 is Plan Reflection's revision, j-0002 this one's.
const DEFINITION = 'j-0002';

const answers = {
  [MODE]: { kind: 'Option', optionId: 'option.position-change-reflection.decision-mode.as-planned' },
  [EMOTION]: { kind: 'Option', optionId: 'option.position-change-reflection.primary-emotion.calm' },
  [CONFIDENCE]: { kind: 'Scale', value: 4 },
  [NOTE]: { kind: 'Text', text: 'Filled the first tranche at the open.' },
} as const;

async function seeded() {
  const setup = await journal();
  await setup.journal.seedDefaults(D2_JOURNAL_MANIFEST);
  return setup;
}

type Request = Parameters<Awaited<ReturnType<typeof seeded>>['journal']['prepareEffects']>[0];

// PC1 of the reference Trade: an Execution at 10:00 New York, recorded on the existing Trade.
function request(disposition: unknown): Request {
  return {
    obligation: 'PositionChangeReflection',
    disposition,
    anchor: { kind: 'Trade', ref: 'trade-1' },
    origin: { kind: 'PositionChange', ref: 'candidate:pc-1' },
    momentTime: '2026-10-12T14:00:00Z',
  } as Request;
}

const complete = (form: Record<string, unknown> = answers) => request({ kind: 'Complete', form: { definitionId: DEFINITION, answers: form } });

describe('prepareEffects: Position Change Reflection, Complete', () => {
  it('should prepare an Entry with the definition snapshot, a Trade Anchor to the originating Trade, Source Position Change, the Position Change origin, and moment time equal to the Position Change Economic Time', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);
    const result = await j.prepareEffects(complete());
    expect(result).toEqual({
      kind: 'Prepared',
      effects: {
        entries: [
          {
            entryTypeKey: 'entry-type.position-change-reflection',
            definitionId: DEFINITION,
            sourceKey: 'source.position-change',
            obligationKey: { entryType: 'PositionChangeReflection', positionChange: 'candidate:pc-1' },
            anchor: { kind: 'Trade', ref: 'trade-1' },
            origin: { kind: 'PositionChange', ref: 'candidate:pc-1' },
            momentTime: '2026-10-12T14:00:00Z',
            authoredTime: '2026-10-12T15:05:00Z',
            responses: [
              { promptId: MODE, value: answers[MODE] },
              { promptId: EMOTION, value: answers[EMOTION] },
              { promptId: CONFIDENCE, value: answers[CONFIDENCE] },
              { promptId: NOTE, value: answers[NOTE] },
            ],
          },
        ],
        declines: [],
      },
      snapshot: { journalRevision: 1 },
    });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should return RequiredAnswerMissing for each blank required prompt at once, and store a blank Note as Unanswered', async () => {
    const { journal: j } = await seeded();
    expect(await j.prepareEffects(complete({ [CONFIDENCE]: answers[CONFIDENCE], [NOTE]: { kind: 'Text', text: '  ' } }))).toEqual({
      kind: 'Rejected',
      issues: [
        { promptId: MODE, code: 'RequiredAnswerMissing' },
        { promptId: EMOTION, code: 'RequiredAnswerMissing' },
      ],
    });
    const result = await j.prepareEffects(complete({ ...answers, [NOTE]: { kind: 'Text', text: '   ' } }));
    if (result.kind !== 'Prepared') throw new Error('expected Prepared');
    expect(result.effects.entries[0]?.responses[3]).toEqual({ promptId: NOTE, value: { kind: 'Unanswered' } });
  });
});

const decline = (reason?: string) =>
  request({ kind: 'Decline', definitionId: DEFINITION, ...(reason === undefined ? {} : { reason }) });

describe('prepareEffects: Position Change Reflection, Decline', () => {
  it('should prepare a decline with the obligation key, Anchor, Source, origin, the definition revision shown, an optional reason, and moment and authored times', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);
    const expected = {
      entryTypeKey: 'entry-type.position-change-reflection',
      obligationKey: { entryType: 'PositionChangeReflection', positionChange: 'candidate:pc-1' },
      anchor: { kind: 'Trade', ref: 'trade-1' },
      sourceKey: 'source.position-change',
      origin: { kind: 'PositionChange', ref: 'candidate:pc-1' },
      definitionId: DEFINITION,
      momentTime: '2026-10-12T14:00:00Z',
      authoredTime: '2026-10-12T15:05:00Z',
    };
    expect(await j.prepareEffects(decline('Routine scale-in; nothing to add.'))).toEqual({
      kind: 'Prepared',
      effects: { entries: [], declines: [{ ...expected, reason: 'Routine scale-in; nothing to add.' }] },
      snapshot: { journalRevision: 1 },
    });
    expect(await j.prepareEffects(decline())).toEqual({
      kind: 'Prepared',
      effects: { entries: [], declines: [expected] },
      snapshot: { journalRevision: 1 },
    });
    // The revision shown must be the current one, as for a completed form.
    expect(await j.prepareEffects(request({ kind: 'Decline', definitionId: 'j-0001' }))).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'DefinitionRevisionMismatch' }],
    });
    expect(await stored(persistence)).toEqual(before);
  });

  it('should reject a reason longer than 500 characters with ReasonTooLong', async () => {
    const { journal: j } = await seeded();
    expect(await j.prepareEffects(decline('x'.repeat(501)))).toEqual({ kind: 'Rejected', issues: [{ code: 'ReasonTooLong' }] });
    expect((await j.prepareEffects(decline('x'.repeat(500)))).kind).toBe('Prepared');
  });

  // Replaced from D5 by D5 T5.2, which installs Defer: the test is changed to the new expectation then, not deleted.
  it('should reject Defer with DispositionNotAllowed', async () => {
    const { journal: j, persistence } = await seeded();
    const before = await stored(persistence);
    expect(await j.prepareEffects(request({ kind: 'Defer' }))).toEqual({ kind: 'Rejected', issues: [{ code: 'DispositionNotAllowed' }] });
    expect(await stored(persistence)).toEqual(before);
  });
});

describe('applyPreparedEffects and the obligation index', () => {
  // Trade Record's exact durable mapping for the Position Change; the Trade was already durable.
  const mapping = { 'candidate:pc-1': 'pc-durable-1', 'candidate:execution-1': 'execution-durable-1' };

  async function prepared(req: Request) {
    const setup = await seeded();
    const result = await setup.journal.prepareEffects(req);
    if (result.kind !== 'Prepared') throw new Error('expected Prepared');
    return { ...setup, prepared: result };
  }

  async function commitApplied(setup: Awaited<ReturnType<typeof prepared>>) {
    const tx = beginSemanticTransaction();
    const staged = setup.journal.applyPreparedEffects(tx, setup.prepared, mapping);
    return { staged, committed: await setup.persistence.commit(tx.close()) };
  }

  it('should stage the Entry or decline and its obligation record in the shared transaction, mapped to Trade Record durable Position Change identity', async () => {
    const completed = await prepared(complete());
    const tx = beginSemanticTransaction();
    const staged = completed.journal.applyPreparedEffects(tx, completed.prepared, mapping);
    expect(staged).toEqual({
      kind: 'Staged',
      entries: [
        {
          id: 'j-0003',
          entryTypeKey: 'entry-type.position-change-reflection',
          sourceKey: 'source.position-change',
          anchor: { kind: 'Trade', tradeId: 'trade-1' },
          origin: { kind: 'PositionChange', factId: 'pc-durable-1' },
          momentTime: '2026-10-12T14:00:00Z',
          authoredTime: '2026-10-12T15:05:00Z',
          definitionId: DEFINITION,
          responses: completed.prepared.effects.entries[0]!.responses,
        },
      ],
      declines: [],
    });
    expect((await stored(completed.persistence)).obligations).toEqual([]);
    expect((await completed.persistence.commit(tx.close())).kind).toBe('Committed');
    const afterEntry = await stored(completed.persistence);
    expect(afterEntry.entries).toEqual([
      expect.objectContaining({
        id: 'j-0003',
        obligationKey: 'PositionChangeReflection:pc-durable-1',
        anchorTradeId: 'trade-1',
        origin: { kind: 'PositionChange', factId: 'pc-durable-1' },
      }),
    ]);
    expect(afterEntry.obligations).toEqual([
      { obligationKey: 'PositionChangeReflection:pc-durable-1', outcome: { kind: 'Entry', id: 'j-0003' }, revision: 3 },
    ]);

    const declined = await prepared(decline('Routine scale-in.'));
    const { staged: stagedDecline, committed } = await commitApplied(declined);
    const declineProjection = {
      id: 'j-0003',
      entryTypeKey: 'entry-type.position-change-reflection',
      sourceKey: 'source.position-change',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      origin: { kind: 'PositionChange', factId: 'pc-durable-1' },
      definitionId: DEFINITION,
      reason: 'Routine scale-in.',
      momentTime: '2026-10-12T14:00:00Z',
      authoredTime: '2026-10-12T15:05:00Z',
    };
    expect(stagedDecline).toEqual({ kind: 'Staged', entries: [], declines: [declineProjection] });
    expect(committed.kind).toBe('Committed');
    const afterDecline = await stored(declined.persistence);
    expect(afterDecline.entries).toEqual([]);
    expect(afterDecline.declines).toEqual([
      { ...declineProjection, obligationKey: 'PositionChangeReflection:pc-durable-1', anchorTradeId: 'trade-1', revision: 3 },
    ]);
    expect(afterDecline.obligations).toEqual([
      { obligationKey: 'PositionChangeReflection:pc-durable-1', outcome: { kind: 'Decline', id: 'j-0003' }, revision: 3 },
    ]);
  });

  it('should fail the transaction when the obligation key already has an outcome, whether Entry or decline', async () => {
    for (const [first, second] of [
      [complete(), decline()],
      [decline(), complete()],
      [complete(), complete()],
      [decline('first'), decline('second')],
    ] as const) {
      const { journal: j, persistence } = await seeded();
      const apply = async (req: Request) => {
        const result = await j.prepareEffects(req);
        if (result.kind !== 'Prepared') throw new Error('expected Prepared');
        const tx = beginSemanticTransaction();
        j.applyPreparedEffects(tx, result, mapping);
        return persistence.commit(tx.close());
      };
      expect((await apply(first)).kind).toBe('Committed');
      const before = await stored(persistence);
      expect(await apply(second)).toEqual(expect.objectContaining({ kind: 'ConstraintViolation' }));
      expect(await stored(persistence)).toEqual(before);
    }
  });

  it('should rebuild the obligation index from Entries and declines with the same contents', async () => {
    const { journal: j, persistence, factory } = await seeded();
    const outcomes: Request[] = [
      {
        obligation: 'PlanReflection',
        disposition: {
          kind: 'Complete',
          form: {
            definitionId: 'j-0001',
            answers: {
              'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout.' },
              'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'Below 48.' },
            },
          },
        },
        anchor: { kind: 'Trade', ref: 'trade-1' },
        origin: { kind: 'Plan', ref: 'plan-1' },
        momentTime: '2026-10-12T13:00:00Z',
      } as unknown as Request,
      complete(),
      { ...decline('Routine.'), origin: { kind: 'PositionChange', ref: 'pc-durable-2' }, momentTime: '2026-10-12T15:00:00Z' },
    ];
    for (const req of outcomes) {
      const result = await j.prepareEffects(req);
      if (result.kind !== 'Prepared') throw new Error('expected Prepared');
      const tx = beginSemanticTransaction();
      j.applyPreparedEffects(tx, result, mapping);
      expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    }
    const before = await stored(persistence);
    expect(before.obligations.map((o) => o['obligationKey'])).toEqual([
      'PlanReflection:trade-1',
      'PositionChangeReflection:pc-durable-1',
      'PositionChangeReflection:pc-durable-2',
    ]);

    // The obligation index is private: lose it entirely, then rebuild it from the authoritative records.
    const { binding } = await persistence.commit({
      checks: [],
      writes: before.obligations.map((o) => ({ op: 'delete' as const, store: 'journalObligations' as const, key: o['obligationKey'] as string })),
    }) as { binding: { databaseName: string } };
    expect((await stored(persistence)).obligations).toEqual([]);
    persistence.close();
    await rebuildPrivateState(factory, binding.databaseName);

    expect((await stored(persistence)).obligations).toEqual(before.obligations);
  });
});

describe('query: Trade narrative', () => {
  it('should return Plan Reflection, Position Change Reflections, and declines for the Trade ordered by moment time then identity, each with its snapshot labels or decline reason', async () => {
    const { journal: j, persistence } = await seeded();
    const planReflection = {
      obligation: 'PlanReflection',
      disposition: {
        kind: 'Complete',
        form: {
          definitionId: 'j-0001',
          answers: {
            'prompt.plan-reflection.thesis': { kind: 'Text', text: 'Breakout.' },
            'prompt.plan-reflection.invalidation': { kind: 'Text', text: 'Below 48.' },
          },
        },
      },
      anchor: { kind: 'Trade', ref: 'trade-1' },
      origin: { kind: 'Plan', ref: 'plan-1' },
      momentTime: '2026-10-12T13:00:00Z',
    } as unknown as Request;
    const onPc = (req: Request, pc: string, tradeId = 'trade-1') =>
      ({ ...req, anchor: { kind: 'Trade', ref: tradeId }, origin: { kind: 'PositionChange', ref: pc } }) as Request;
    // Applied out of moment order: the decline (j-0003) and the Entry (j-0004) share the PC moment
    // 14:00, and the Plan Reflection (j-0005) is earliest but applied last.
    for (const req of [
      onPc(decline('Routine scale-in.'), 'pc-a'),
      onPc(complete(), 'pc-b'),
      planReflection,
      onPc(decline('Another Trade.'), 'pc-c', 'trade-2'),
    ]) {
      const result = await j.prepareEffects(req);
      if (result.kind !== 'Prepared') throw new Error('expected Prepared');
      const tx = beginSemanticTransaction();
      j.applyPreparedEffects(tx, result, {});
      expect((await persistence.commit(tx.close())).kind).toBe('Committed');
    }

    const page = await j.query({ scope: 'TradeNarrative', tradeId: 'trade-1' });

    expect(page.items.map((item) => [item.kind, item.id])).toEqual([
      ['Entry', 'j-0005'],
      ['Decline', 'j-0003'],
      ['Entry', 'j-0004'],
    ]);
    expect(page.items[1]).toEqual({
      kind: 'Decline',
      id: 'j-0003',
      entryType: 'Position Change Reflection',
      source: 'Position Change',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      momentTime: '2026-10-12T14:00:00Z',
      authoredTime: '2026-10-12T15:05:00Z',
      reason: 'Routine scale-in.',
    });
    expect(page.items[2]).toEqual({
      kind: 'Entry',
      id: 'j-0004',
      entryType: 'Position Change Reflection',
      source: 'Position Change',
      anchor: { kind: 'Trade', tradeId: 'trade-1' },
      momentTime: '2026-10-12T14:00:00Z',
      authoredTime: '2026-10-12T15:05:00Z',
      responses: [
        { prompt: 'Decision mode', answer: { kind: 'Option', label: 'As Planned' } },
        { prompt: 'Primary emotion', answer: { kind: 'Option', label: 'Calm' } },
        { prompt: 'Decision confidence', answer: { kind: 'Scale', value: 4 } },
        { prompt: 'Note', answer: { kind: 'Text', text: 'Filled the first tranche at the open.' } },
      ],
    });
    expect(page.items[0]).toEqual(expect.objectContaining({ kind: 'Entry', entryType: 'Plan Reflection', source: 'Plan Confirmation' }));
  });
});
