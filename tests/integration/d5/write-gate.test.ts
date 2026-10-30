// I5.11: the write gate refuses every D5 write while the inventory check fails, and the Review, Detail
// and Debt stay readable (AC-DEL-004, AC-DEL-006). One case per boundary so each is shown to be checked.
import { describe, expect, it } from 'vitest';
import {
  bindingFor, detail, type Device, dumpAll, outstandingDebts, positionChange, buy, PC2, reflectionForm, restart, TUESDAY_1700, withDebt,
} from './support.ts';

const notWritable = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
}) as unknown;

// D-1 is due at Tuesday 17:00. Everything a write needs is prepared while the host is healthy; then the
// host fails the inventory check and the application restarts into recovery.
async function failedHost() {
  const { d, app, tradeId, debt } = await withDebt();
  const tuesday: Device = { ...d, now: TUESDAY_1700 };
  const live = await restart(app, tuesday);
  const { opened, form } = await bindingFor(live, tuesday, tradeId);
  const binding = form.reflections[0]!.saveBinding;
  const answerForm = await reflectionForm(live);
  const deferCommand = await positionChange(live, tradeId, [await buy(live, tradeId, PC2)], { kind: 'Defer' });
  d.testHost.fail(['inventory']);
  const recovery = await restart(live, tuesday);
  const before = await dumpAll(d.factory);
  return { d, tuesday, recovery, tradeId, debt, opened, binding, answerForm, deferCommand, before };
}

describe('I5.11 Write gate', () => {
  it('should return RuntimeNotWritable from recordPositionChange with Defer and leave every store unchanged', async () => {
    const { d, recovery, deferCommand, before } = await failedHost();

    expect(await recovery.TradeWorkflows.recordPositionChange(deferCommand)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from Journal.save and leave every store unchanged', async () => {
    const { d, recovery, debt, answerForm, before } = await failedHost();

    expect(await recovery.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: answerForm } })).toEqual(notWritable);
    expect(await recovery.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Decline', reason: 'No.' } })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from DailyReview.save with ResolveReviewDebt and leave every store unchanged', async () => {
    const { d, recovery, opened, binding, answerForm, before } = await failedHost();

    expect(await recovery.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding, resolution: { kind: 'Answer', answers: answerForm.answers } })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from a direct Persistence.commit and leave every store unchanged', async () => {
    const { d, recovery, debt, before } = await failedHost();

    expect(await recovery.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'journalDebts', value: { debtId: debt.debtId, direct: true } }] })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should keep the Review, the Trade Detail with its Debt, and the Journal Debt list readable in recovery', async () => {
    const { d, tuesday, recovery, tradeId, debt, before } = await failedHost();

    expect((await recovery.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    const review = await recovery.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: tuesday.now });
    if (review.kind !== 'Ready') throw new Error(`DailyReview.open: ${review.kind}`);
    const reflections = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => t.reflections) : []));
    expect(reflections).toEqual([{ due: 1, later: 0 }]);
    const owed = (await detail(recovery, tradeId)).journal.filter((item) => item.kind === 'Debt');
    expect(owed).toEqual([expect.objectContaining({ id: debt.debtId, revision: debt.revision, dueStatus: 'Due' })]);
    expect(await outstandingDebts(recovery)).toEqual([debt]);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);
});
