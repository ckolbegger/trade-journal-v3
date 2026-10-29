import { describe, expect, it } from 'vitest';
import { fixedClock } from '../../domain/time/index.ts';
import { IDBFactory } from 'fake-indexeddb';
import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import { beginSemanticTransaction, createPersistence, type Persistence } from '../../persistence/index.ts';
import { appendPositionChangeReflectionRevision2 } from '../../../tests/support/definition-revision.ts';
import { TEST_SESSION_POLICY } from '../../../tests/support/session-policy.ts';
import { sequentialIds } from '../../../tests/support/workspace.ts';
import { createJournal, D2_JOURNAL_MANIFEST, type AnswerInput } from './index.ts';

// T5.3: Debt resolution (D5 P17, A62, A64, A65). D-1 is Outstanding; the clock is Tuesday 2026-10-13 12:30 New York.
const NOW = '2026-10-13T16:30:00Z';
const PC1_TIME = '2026-10-12T14:00:00Z';
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

async function stored(persistence: Persistence) {
  const { value, binding } = await persistence.readSnapshot(
    ['journalEntries', 'journalDeclines', 'journalDebts', 'journalObligations', 'meta'],
    async (tx) => ({
      entries: await tx.getAll('journalEntries'),
      declines: await tx.getAll('journalDeclines'),
      debts: await tx.getAll('journalDebts'),
      outstanding: await tx.getAllFromIndex('journalDebts', 'byOutstandingDue', IDBKeyRange.bound(['', ''], ['￿', '￿'])),
      obligations: await tx.getAll('journalObligations'),
      meta: await tx.get('meta', 'journal'),
    }),
  );
  return { ...value, contentRevision: binding.contentRevision };
}

// D-1: PC1 of the reference Trade deferred (Defer prepared, applied, and committed by the owning workflow).
async function withDebt() {
  // The gate reads `gate.refusal` at every write, so a test can turn the session unwritable later.
  const gate: { refusal: RuntimeNotWritable | null } = { refusal: null };
  const factory = new IDBFactory();
  const persistence = createPersistence({
    indexedDB: factory,
    ids: sequentialIds('ws'),
    writeGate: { current: () => gate.refusal, recheck: () => Promise.resolve(gate.refusal) },
    sessionPolicy: TEST_SESSION_POLICY,
  });
  const created = await persistence.createWorkspace([]);
  if (created.kind !== 'Created') throw new Error('workspace not created');
  const journal = createJournal({ persistence, ids: sequentialIds('j'), clock: fixedClock(NOW) });
  await journal.seedDefaults(D2_JOURNAL_MANIFEST);
  const prepared = await journal.prepareEffects({
    obligation: 'PositionChangeReflection',
    disposition: { kind: 'Defer' },
    anchor: { kind: 'Trade', ref: 'trade-1' },
    origin: { kind: 'PositionChange', ref: 'candidate:pc-1' },
    momentTime: PC1_TIME,
  });
  if (prepared.kind !== 'Prepared') throw new Error('expected Prepared');
  const tx = beginSemanticTransaction();
  const staged = journal.applyPreparedEffects(tx, prepared, { 'candidate:pc-1': 'pc-1' });
  expect((await persistence.commit(tx.close())).kind).toBe('Committed');
  return { journal, persistence, factory, gate, debt: staged.debts![0]! };
}

type Setup = Awaited<ReturnType<typeof withDebt>>;

const anyResponses: unknown = expect.any(Array);

// An Outstanding Debt as stored, without the private due field that leaves with its resolution.
const withoutDue = (debt: Record<string, unknown>) => Object.fromEntries(Object.entries(debt).filter(([field]) => field !== 'outstandingDue'));

const answer = (setup: Setup, form: Record<string, AnswerInput> = answers, definitionId = DEFINITION) =>
  ({
    intention: 'ResolveDebt',
    debtId: setup.debt.debtId,
    expectedDebtRevision: setup.debt.revision,
    resolution: { kind: 'Answer', form: { definitionId, answers: form } },
  }) as const;

describe('save: ResolveDebt, Answer (P17, A64)', () => {
  it('should create one Position Change Reflection Entry with the Debt definition revision, Anchor, origin, and moment time, Source Trade Detail, authored time Tuesday 12:30, and settledDebtId; append a Settled version linking it; and move the obligation current outcome to the Entry, in one semantic commit', async () => {
    const setup = await withDebt();
    const before = await stored(setup.persistence);
    expect(before.outstanding).toHaveLength(1);

    await setup.journal.save(answer(setup));

    const after = await stored(setup.persistence);
    // Entry, Debt version, obligation, and counter share one commit.
    const revision = before.contentRevision + 1;
    expect(after.contentRevision).toBe(revision);
    expect(after.entries).toEqual([
      {
        id: 'j-0005',
        entryTypeKey: 'entry-type.position-change-reflection',
        sourceKey: 'source.trade-detail',
        anchor: { kind: 'Trade', tradeId: 'trade-1' },
        origin: { kind: 'PositionChange', factId: 'pc-1' },
        momentTime: PC1_TIME,
        authoredTime: NOW,
        obligationKey: 'PositionChangeReflection:pc-1',
        anchorTradeId: 'trade-1',
        settledDebtId: 'j-0003',
        versions: [{ versionNumber: 1, definitionId: DEFINITION, responses: anyResponses, savedAt: NOW }],
        revision,
      },
    ]);
    expect(before.debts[0]!['outstandingDue']).toBe(PC1_TIME);
    const openDebt = withoutDue(before.debts[0]!);
    expect(after.debts).toEqual([
      {
        ...openDebt,
        versions: [
          { versionId: 'j-0004', status: 'Outstanding', savedAt: NOW },
          { versionId: 'j-0006', status: 'Settled', entryId: 'j-0005', savedAt: NOW },
        ],
        revision,
      },
    ]);
    // The Debt leaves byOutstandingDue.
    expect(after.outstanding).toEqual([]);
    expect(after.obligations).toEqual([
      { obligationKey: 'PositionChangeReflection:pc-1', outcome: { kind: 'Entry', id: 'j-0005' }, revision },
    ]);
    expect(after.meta).toEqual(expect.objectContaining({ journalRevision: 3 }));
  });

  it('should validate the answers against the Debt snapshot revision, not the latest, when the definition fixture writer has added revision 2', async () => {
    const setup = await withDebt();
    // Revision 2 relabels an option and adds a required Lesson prompt the snapshot does not have.
    await appendPositionChangeReflectionRevision2(setup.factory);

    const result = await setup.journal.save(answer(setup));

    expect(result.kind).toBe('Saved');
    const { entries } = await stored(setup.persistence);
    expect(entries).toEqual([
      expect.objectContaining({
        versions: [expect.objectContaining({ definitionId: DEFINITION, responses: [MODE, EMOTION, CONFIDENCE, NOTE].map((promptId) => ({ promptId, value: answers[promptId as keyof typeof answers] })) })],
      }),
    ]);
  });

  it('should return RequiredAnswerMissing for each blank required prompt of the snapshot at once, and DefinitionRevisionMismatch when the form names revision 2', async () => {
    const setup = await withDebt();
    const revision2 = await appendPositionChangeReflectionRevision2(setup.factory);
    const before = await stored(setup.persistence);

    // Every required prompt blank (a whitespace Note is optional and fine): all three at once.
    expect(await setup.journal.save(answer(setup, { [EMOTION]: { kind: 'Text', text: '  ' }, [NOTE]: { kind: 'Text', text: ' ' } }))).toEqual({
      kind: 'Rejected',
      issues: [
        { promptId: MODE, code: 'RequiredAnswerMissing' },
        { promptId: EMOTION, code: 'RequiredAnswerMissing' },
        { promptId: CONFIDENCE, code: 'RequiredAnswerMissing' },
      ],
    });
    // A form for another revision than the Debt snapshot's.
    expect(await setup.journal.save(answer(setup, answers, revision2))).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'DefinitionRevisionMismatch' }],
    });
    expect(await stored(setup.persistence)).toEqual(before);
  });

  it('should return the Entry, the Debt Settled transition, and the obligation current outcome at the new Journal revision, equal to the stored records (AC-RESP-001)', async () => {
    const setup = await withDebt();

    const result = await setup.journal.save(answer(setup));

    const after = await stored(setup.persistence);
    if (result.kind !== 'Saved') throw new Error('expected Saved');
    const storedEntry = after.entries[0] as Record<string, unknown> & { versions: { definitionId: string; responses: unknown }[] };
    expect(result.entry).toEqual({
      id: storedEntry['id'],
      entryTypeKey: storedEntry['entryTypeKey'],
      sourceKey: storedEntry['sourceKey'],
      anchor: storedEntry['anchor'],
      origin: storedEntry['origin'],
      momentTime: storedEntry['momentTime'],
      authoredTime: storedEntry['authoredTime'],
      definitionId: storedEntry.versions[0]!.definitionId,
      responses: storedEntry.versions[0]!.responses,
      settledDebtId: 'j-0003',
    });
    const storedDebt = after.debts[0] as Record<string, unknown> & { versions: { versionId: string; status: string; entryId: string }[] };
    expect(result.debt).toEqual({
      debtId: storedDebt['debtId'],
      obligationKey: storedDebt['obligationKey'],
      entryTypeKey: storedDebt['entryTypeKey'],
      sourceKey: storedDebt['sourceKey'],
      definitionId: storedDebt['definitionId'],
      anchor: storedDebt['anchor'],
      origin: storedDebt['origin'],
      momentTime: storedDebt['momentTime'],
      dueAnchor: storedDebt['dueAnchor'],
      dueRule: storedDebt['dueRule'],
      route: storedDebt['route'],
      status: storedDebt.versions.at(-1)!.status,
      revision: storedDebt.versions.at(-1)!.versionId,
      entryId: storedDebt.versions.at(-1)!.entryId,
    });
    expect(result.debt.status).toBe('Settled');
    expect(result.decline).toBeUndefined();
    expect(result.currentOutcome).toEqual((after.obligations[0] as { outcome: unknown }).outcome);
    expect(result.snapshot).toEqual({ journalRevision: (after.meta as { journalRevision: number }).journalRevision });
    expect(result.snapshot.journalRevision).toBe(3);
  });
});

describe('save: ResolveDebt, Decline', () => {
  const decline = (setup: Setup, reason?: string) =>
    ({
      intention: 'ResolveDebt',
      debtId: setup.debt.debtId,
      expectedDebtRevision: setup.debt.revision,
      resolution: { kind: 'Decline', ...(reason === undefined ? {} : { reason }) },
    }) as const;

  it('should create a decline with the Debt obligation key, Anchor, origin, moment time, snapshot revision, an optional reason of at most 500 characters (ReasonTooLong otherwise), Source Trade Detail, and settledDebtId; append a Declined version; and move the current outcome to the decline', async () => {
    const setup = await withDebt();
    const before = await stored(setup.persistence);

    // Over the limit: rejected, nothing written. Exactly 500 characters is accepted.
    expect(await setup.journal.save(decline(setup, 'x'.repeat(501)))).toEqual({ kind: 'Rejected', issues: [{ code: 'ReasonTooLong' }] });
    expect(await stored(setup.persistence)).toEqual(before);

    const result = await setup.journal.save(decline(setup, 'x'.repeat(500)));
    expect(result.kind).toBe('Saved');
    const after = await stored(setup.persistence);
    const revision = before.contentRevision + 1;
    expect(after.entries).toEqual([]);
    expect(after.declines).toEqual([
      {
        id: 'j-0005',
        entryTypeKey: 'entry-type.position-change-reflection',
        sourceKey: 'source.trade-detail',
        anchor: { kind: 'Trade', tradeId: 'trade-1' },
        origin: { kind: 'PositionChange', factId: 'pc-1' },
        definitionId: DEFINITION,
        reason: 'x'.repeat(500),
        momentTime: PC1_TIME,
        authoredTime: NOW,
        settledDebtId: 'j-0003',
        obligationKey: 'PositionChangeReflection:pc-1',
        anchorTradeId: 'trade-1',
        revision,
      },
    ]);
    const openDebt = withoutDue(before.debts[0]!);
    expect(after.debts).toEqual([
      {
        ...openDebt,
        versions: [
          { versionId: 'j-0004', status: 'Outstanding', savedAt: NOW },
          { versionId: 'j-0006', status: 'Declined', declineId: 'j-0005', savedAt: NOW },
        ],
        revision,
      },
    ]);
    expect(after.outstanding).toEqual([]);
    expect(after.obligations).toEqual([
      { obligationKey: 'PositionChangeReflection:pc-1', outcome: { kind: 'Decline', id: 'j-0005' }, revision },
    ]);
    if (result.kind !== 'Saved') throw new Error('expected Saved');
    expect(result.currentOutcome).toEqual({ kind: 'Decline', id: 'j-0005' });
    expect(result.debt.status).toBe('Declined');

    // The reason is optional: a second Debt declined without one stores no reason.
    const bare = await withDebt();
    await bare.journal.save(decline(bare));
    expect((await stored(bare.persistence)).declines[0]).not.toHaveProperty('reason');
  });
});

describe('conflicts (AC-JOUR-005)', () => {
  it('should return Conflict carrying the current outcome and write nothing when the expected Debt revision is stale or the Debt is already Settled or Declined', async () => {
    const setup = await withDebt();
    const outstanding = await stored(setup.persistence);
    const stale = { ...answer(setup), expectedDebtRevision: 'j-9999' };
    expect(await setup.journal.save(stale)).toEqual({ kind: 'Conflict', currentOutcome: { kind: 'Debt', id: 'j-0003' } });
    expect(await stored(setup.persistence)).toEqual(outstanding);

    // Settled: a second save naming the revision the trader was shown conflicts with the Entry.
    expect((await setup.journal.save(answer(setup))).kind).toBe('Saved');
    const settled = await stored(setup.persistence);
    expect(await setup.journal.save(answer(setup))).toEqual({ kind: 'Conflict', currentOutcome: { kind: 'Entry', id: 'j-0005' } });
    expect(await stored(setup.persistence)).toEqual(settled);

    // Declined: the same, with the decline.
    const declined = await withDebt();
    const decline = { ...answer(declined), resolution: { kind: 'Decline' } } as const;
    expect((await declined.journal.save(decline)).kind).toBe('Saved');
    const afterDecline = await stored(declined.persistence);
    expect(await declined.journal.save(answer(declined))).toEqual({ kind: 'Conflict', currentOutcome: { kind: 'Decline', id: 'j-0005' } });
    expect(await stored(declined.persistence)).toEqual(afterDecline);
  });

  // Beyond the planned wording: ADR 0011's counter retry, which T5.3 inherits for its own commit.
  it('should re-read and retry when only the Journal counter moved, up to 3 attempts in all, then return Conflict with nothing resolved', async () => {
    const racing = async (moves: number) => {
      const setup = await withDebt();
      let bumps = 0;
      // Another writer advances the shared counter just before each of the first `moves` commits.
      const persistence: Persistence = {
        ...setup.persistence,
        commit: async (writeSet) => {
          if (bumps < moves) {
            const { value } = await setup.persistence.readSnapshot(['meta'], (tx) => tx.get('meta', 'journal'));
            await setup.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'meta', value: { key: 'journal', journalRevision: (value?.['journalRevision'] as number) + 1 } }] });
            bumps++;
          }
          return setup.persistence.commit(writeSet);
        },
      };
      const journal = createJournal({ persistence, ids: sequentialIds('r'), clock: fixedClock(NOW) });
      return { ...setup, journal, result: await journal.save(answer(setup)) };
    };

    const twice = await racing(2);
    expect(twice.result).toEqual(expect.objectContaining({ kind: 'Saved', snapshot: { journalRevision: 5 } }));
    expect((await stored(twice.persistence)).entries).toHaveLength(1);

    const always = await racing(3);
    expect(always.result).toEqual({ kind: 'Conflict', currentOutcome: { kind: 'Debt', id: 'j-0003' } });
    const after = await stored(always.persistence);
    expect(after.entries).toEqual([]);
    expect(after.obligations).toEqual([expect.objectContaining({ outcome: { kind: 'Debt', id: 'j-0003' } })]);
  });

  it('should return NotFound for an unknown Debt', async () => {
    const setup = await withDebt();
    const before = await stored(setup.persistence);
    expect(await setup.journal.save({ ...answer(setup), debtId: 'j-unknown' })).toEqual({ kind: 'NotFound' });
    expect(await stored(setup.persistence)).toEqual(before);
  });
});

describe('write gate', () => {
  it('should return RuntimeNotWritable and write nothing when the mutation-boundary readiness recheck fails', async () => {
    const setup = await withDebt();
    const before = await stored(setup.persistence);
    const refusal: RuntimeNotWritable = {
      kind: 'RuntimeNotWritable',
      runtimeReadiness: 'RecoveryOnly',
      failedChecks: [{ check: 'inventory', reason: 'InventoryInvalid' }],
      workspaceStatus: 'RecoveryOnly',
      safeActions: [{ action: 'Retry', explanation: 'Check again once the problem is fixed.' }],
    };
    setup.gate.refusal = refusal;
    expect(await setup.journal.save(answer(setup))).toEqual(refusal);
    expect(await setup.journal.save({ ...answer(setup), resolution: { kind: 'Decline' } })).toEqual(refusal);
    expect(await stored(setup.persistence)).toEqual(before);
  });
});

describe('prepareEffects: ResolveDebt for a coordinator', () => {
  // The request a coordinator (Daily Review) prepares: the command's fields under `obligation`.
  const request = (setup: Setup) => {
    const { debtId, expectedDebtRevision, resolution } = answer(setup);
    return { obligation: 'ResolveDebt', debtId, expectedDebtRevision, resolution } as const;
  };

  it('should prepare the same Entry with Source Daily Review for staging in a caller transaction, and fail that transaction at apply when the Debt revision moved after preparation', async () => {
    const setup = await withDebt();
    const before = await stored(setup.persistence);

    const first = await setup.journal.prepareEffects(request(setup));
    const second = await setup.journal.prepareEffects(request(setup));
    // Preparing writes nothing.
    expect(await stored(setup.persistence)).toEqual(before);
    if (first.kind !== 'Prepared' || second.kind !== 'Prepared') throw new Error('expected Prepared');
    expect(first.effects.entries).toEqual([
      expect.objectContaining({
        entryTypeKey: 'entry-type.position-change-reflection',
        definitionId: DEFINITION,
        sourceKey: 'source.daily-review',
        anchor: { kind: 'Trade', ref: 'trade-1' },
        origin: { kind: 'PositionChange', ref: 'pc-1' },
        momentTime: PC1_TIME,
        authoredTime: NOW,
        settledDebtId: 'j-0003',
      }),
    ]);

    // The caller stages it in its own transaction.
    const tx = beginSemanticTransaction();
    const staged = setup.journal.applyPreparedEffects(tx, first, {});
    expect(staged.entries).toHaveLength(1);
    expect(staged.debts).toEqual([expect.objectContaining({ debtId: 'j-0003', status: 'Settled', entryId: staged.entries[0]!.id })]);
    expect((await setup.persistence.commit(tx.close())).kind).toBe('Committed');
    const settled = await stored(setup.persistence);
    expect(settled.entries).toEqual([expect.objectContaining({ sourceKey: 'source.daily-review', settledDebtId: 'j-0003' })]);

    // The second preparation saw the Debt Outstanding; its Debt moved since, so applying it fails.
    const late = beginSemanticTransaction();
    setup.journal.applyPreparedEffects(late, second, {});
    expect(await setup.persistence.commit(late.close())).toEqual({ kind: 'Conflict', binding: expect.stringContaining('j-0003') as string });
    expect(await stored(setup.persistence)).toEqual(settled);
  });
});

describe('applyPreparedEffects: several Debt resolutions in one batch', () => {
  it('should link each Debt resolution in one applied batch to the Entry or decline that carries its settledDebtId', async () => {
    const setup = await withDebt();
    // A second Outstanding Debt for another Position Change.
    const deferred = await setup.journal.prepareEffects({
      obligation: 'PositionChangeReflection',
      disposition: { kind: 'Defer' },
      anchor: { kind: 'Trade', ref: 'trade-1' },
      origin: { kind: 'PositionChange', ref: 'candidate:pc-2' },
      momentTime: PC1_TIME,
    });
    if (deferred.kind !== 'Prepared') throw new Error('expected Prepared');
    const deferTx = beginSemanticTransaction();
    const second = setup.journal.applyPreparedEffects(deferTx, deferred, { 'candidate:pc-2': 'pc-2' }).debts![0]!;
    expect((await setup.persistence.commit(deferTx.close())).kind).toBe('Committed');

    // The first Debt is answered, the second declined; one batch carries both.
    const answered = await setup.journal.prepareEffects({ obligation: 'ResolveDebt', ...answer(setup) });
    const declined = await setup.journal.prepareEffects({
      obligation: 'ResolveDebt',
      debtId: second.debtId,
      expectedDebtRevision: second.revision,
      resolution: { kind: 'Decline' },
    });
    if (answered.kind !== 'Prepared' || declined.kind !== 'Prepared') throw new Error('expected Prepared');
    const batch = {
      ...answered,
      effects: {
        entries: [...answered.effects.entries, ...declined.effects.entries],
        declines: [...answered.effects.declines, ...declined.effects.declines],
        debtResolutions: [...answered.effects.debtResolutions!, ...declined.effects.debtResolutions!],
      },
    };
    const tx = beginSemanticTransaction();
    const staged = setup.journal.applyPreparedEffects(tx, batch, {});
    expect((await setup.persistence.commit(tx.close())).kind).toBe('Committed');

    const entryId = staged.entries[0]!.id;
    const declineId = staged.declines[0]!.id;
    expect(staged.debts).toEqual([
      expect.objectContaining({ debtId: setup.debt.debtId, status: 'Settled', entryId }),
      expect.objectContaining({ debtId: second.debtId, status: 'Declined', declineId }),
    ]);
    expect(staged.debts![1]).not.toHaveProperty('entryId');
    const after = await stored(setup.persistence);
    const versionOf = (debtId: string) => (after.debts.find((debt) => debt.debtId === debtId) as { versions: unknown[] }).versions.at(-1);
    expect(versionOf(setup.debt.debtId)).toEqual(expect.objectContaining({ status: 'Settled', entryId }));
    expect(versionOf(second.debtId)).toEqual(expect.objectContaining({ status: 'Declined', declineId }));
    expect(versionOf(second.debtId)).not.toHaveProperty('entryId');
    expect(after.obligations).toEqual(
      expect.arrayContaining([expect.objectContaining({ outcome: { kind: 'Entry', id: entryId } }), expect.objectContaining({ outcome: { kind: 'Decline', id: declineId } })]),
    );
  });
});
