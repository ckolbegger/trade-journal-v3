// I6.13: the write gate refuses every D6 write while the inventory check fails, and the Closed list, Detail and
// Review stay readable (AC-DEL-004, AC-DEL-006). One case per boundary so each is shown to be checked.
import { describe, expect, it } from 'vitest';
import {
  closeReasonId, closeReviewDisposition, device, dumpAll, exitCommand, onboarded, outstandingDebts, PC1_TIME, planStock, record, recordExit, restart, reviewAt, TUESDAY_1400, TUESDAY_1700,
} from './support.ts';

const notWritable = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
}) as unknown;

const SELL = { quantity: '100', price: '53.00', economicTime: TUESDAY_1400, fee: '1.00' };

// T-B (ABC) is Closed with its Close Review deferred, and T-C (DEF) is Open with an exit prepared against it. Everything a
// write needs is prepared while the host is healthy; then the host fails the inventory check and the application restarts.
async function failedHost() {
  const d = await device(undefined, TUESDAY_1700);
  const app = await onboarded(d);
  const reason = await closeReasonId(app, 'Target Reached');
  const closed = await planStock(app, 'ABC', '30.00', '28.00', '36.00');
  await record(app, closed, { quantity: '100', price: '30.00', economicTime: PC1_TIME });
  await recordExit(app, closed, [SELL], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Defer') });
  const open = await planStock(app, 'DEF', '40.00', '38.00', '46.00');
  await record(app, open, { quantity: '100', price: '40.00', economicTime: PC1_TIME });
  const exit = await exitCommand(app, open, [SELL], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, 'Complete') });

  const debt = (await outstandingDebts(app)).find((x) => x.entryTypeKey === 'entry-type.close-review')!;
  const live = await restart(app, d);
  const opened = await reviewAt(live, TUESDAY_1700);
  const card = await live.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: closed, binding: opened.binding });
  if (card.kind !== 'ReflectionsOwed') throw new Error(`getTrade: ${card.kind}`);
  const binding = card.card.reflections[0]!.saveBinding;
  const disposition = await closeReviewDisposition(live, 'Complete');
  if (disposition.kind !== 'Complete') throw new Error('expected Complete');

  d.testHost.fail(['inventory']);
  const recovery = await restart(live, d);
  const before = await dumpAll(d.factory);
  return { d, recovery, closed, debt, exit, reviewDate: opened.reviewDate, binding, answerForm: disposition.form, before };
}

describe('I6.13 Write gate', () => {
  it('should return RuntimeNotWritable from recordPositionChange for an exit with a Close Review and leave every store unchanged', async () => {
    const { d, recovery, exit, before } = await failedHost();

    expect(await recovery.TradeWorkflows.recordPositionChange(exit)).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from Journal.save for a Close Review Debt and leave every store unchanged', async () => {
    const { d, recovery, debt, answerForm, before } = await failedHost();

    expect(await recovery.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Answer', form: answerForm } })).toEqual(notWritable);
    expect(await recovery.Journal.save({ intention: 'ResolveDebt', debtId: debt.debtId, expectedDebtRevision: debt.revision, resolution: { kind: 'Decline', reason: 'No.' } })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from DailyReview.save with ResolveReviewDebt for a Close Review Debt and leave every store unchanged', async () => {
    const { d, recovery, reviewDate, binding, answerForm, before } = await failedHost();

    expect(await recovery.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate, binding, resolution: { kind: 'Answer', answers: answerForm.answers } })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should return RuntimeNotWritable from a direct Persistence.commit and leave every store unchanged', async () => {
    const { d, recovery, debt, before } = await failedHost();

    expect(await recovery.persistence.commit({ checks: [], writes: [{ op: 'put', store: 'journalDebts', value: { debtId: debt.debtId, direct: true } }] })).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);

  it('should keep the Closed list, the Closed Trade Detail with its Debt, and the Review readable in recovery', async () => {
    const { d, recovery, closed, debt, before } = await failedHost();

    expect((await recovery.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    const list = await recovery.TradeViewsAndReporting.browseTrades({ lifecycle: 'Closed' });
    expect(list.kind === 'Ready' && list.view.items.map((i) => i.tradeId)).toEqual([closed]);
    const detail = await recovery.TradeViewsAndReporting.getTradeDetail({ tradeId: closed });
    if (detail.kind !== 'Ready' || !('terminalDisposition' in detail.view)) throw new Error('expected the Closed form of Detail');
    expect(detail.view.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(detail.view.journal.filter((item) => item.kind === 'Debt')).toEqual([expect.objectContaining({ id: debt.debtId, revision: debt.revision })]);
    const review = await reviewAt(recovery, TUESDAY_1700);
    expect(review.owed.map((t) => [t.tradeId, t.owed.map((o) => o.debtId)])).toEqual([[closed, [debt.debtId]]]);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);
});
