// I5.10: rejections write nothing, through the real facade on fake-indexeddb. Each rejection is its
// own case so each is shown to be checked on its own.
import { describe, expect, it } from 'vitest';
import { planCommand } from '../d1/support.ts';
import { dumpAll, journalStores, reflectionForm, withDebt } from './support.ts';

describe('I5.10 Rejections write nothing', () => {
  it('should reject an Answer with a blank required prompt with a typed issue and leave every store unchanged', async () => {
    const { d, app, debt } = await withDebt();
    const form = await reflectionForm(app);
    const promptId = 'prompt.position-change-reflection.decision-mode';
    const before = await dumpAll(d.factory);

    const blank = await app.Journal.save({
      intention: 'ResolveDebt',
      debtId: debt.debtId,
      expectedDebtRevision: debt.revision,
      resolution: { kind: 'Answer', form: { ...form, answers: { ...form.answers, [promptId]: { kind: 'Text', text: '   ' } } } },
    });
    const missing = await app.Journal.save({
      intention: 'ResolveDebt',
      debtId: debt.debtId,
      expectedDebtRevision: debt.revision,
      resolution: { kind: 'Answer', form: { ...form, answers: Object.fromEntries(Object.entries(form.answers).filter(([id]) => id !== promptId)) } },
    });

    const issue = { kind: 'Rejected', issues: [{ promptId, code: 'RequiredAnswerMissing' }] };
    expect(blank).toEqual(issue);
    expect(missing).toEqual(issue);
    expect(await dumpAll(d.factory)).toEqual(before);
    expect((await app.Journal.query({ scope: 'OutstandingDebt' })).kind).toBe('Debts');
  }, 60_000);

  it('should reject a 501-character decline reason with ReasonTooLong and leave every store unchanged, while 500 is accepted', async () => {
    const { d, app, debt } = await withDebt();
    const before = await dumpAll(d.factory);

    const result = await app.Journal.save({
      intention: 'ResolveDebt',
      debtId: debt.debtId,
      expectedDebtRevision: debt.revision,
      resolution: { kind: 'Decline', reason: 'x'.repeat(501) },
    });

    expect(result).toEqual({ kind: 'Rejected', issues: [{ code: 'ReasonTooLong' }] });
    expect(await dumpAll(d.factory)).toEqual(before);

    // The boundary: exactly 500 characters is accepted.
    const accepted = await app.Journal.save({
      intention: 'ResolveDebt',
      debtId: debt.debtId,
      expectedDebtRevision: debt.revision,
      resolution: { kind: 'Decline', reason: 'x'.repeat(500) },
    });
    expect(accepted.kind).toBe('Saved');
  }, 60_000);

  it('should return Conflict naming the Entry for a decline of a Settled Debt, at the stale and the Settled revision, and leave every store unchanged', async () => {
    const { d, app, debt } = await withDebt();
    const form = await reflectionForm(app);
    const settled = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form } });
    if (settled.kind !== 'Saved') throw new Error(`settle: ${settled.kind}`);
    const before = await dumpAll(d.factory);
    const conflict = { kind: 'Conflict', currentOutcome: { kind: 'Entry', id: settled.entry!.id } };

    // At the revision the trader saw before the answer, and at the Settled version's own revision.
    for (const [label, expectedDebtRevision] of [['stale revision', debt.revision], ['Settled revision', settled.debt.revision]] as const) {
      const result = await app.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision, resolution: { kind: 'Decline', reason: 'Too late.' } });
      expect(result, label).toEqual(conflict);
      expect(await dumpAll(d.factory)).toEqual(before);
    }
    const stores = journalStores(before);
    expect(stores.declines).toEqual([]);
    expect(stores.debts[0]!.versions.map((v) => v.status)).toEqual(['Outstanding', 'Settled']);
  }, 60_000);

  it('should reject a Defer of a Plan Reflection through confirmPlan and leave every store unchanged', async () => {
    const { d, app } = await withDebt();
    const before = await dumpAll(d.factory);
    const command = await planCommand(app, { underlying: 'ABC' });
    // confirmPlan carries no disposition: it always submits a Complete one (a Plan Reflection is
    // completed at confirmation, A66), so DispositionNotAllowed is unreachable from the facade and a
    // Defer cannot be typed. Deferring means confirming the Plan with the reflection left unanswered.
    const deferred = { ...command, reflection: { definitionId: command.reflection.definitionId, answers: {} } };

    const result = await app.TradeWorkflows.confirmPlan(deferred);

    if (result.kind !== 'Rejected') throw new Error(`confirmPlan: ${result.kind}`);
    expect(result.issues).toEqual([
      { source: 'Journal', field: 'prompt.plan-reflection.thesis', code: 'RequiredAnswerMissing' },
      { source: 'Journal', field: 'prompt.plan-reflection.invalidation', code: 'RequiredAnswerMissing' },
    ]);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);
});
