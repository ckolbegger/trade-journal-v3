// I6.10: the Daily Review with closed Trades (P19, P20, AC-REV-001, AC-REV-006 partial): the walk and the
// owed-reflection group of the Closed-Trade Review fixture on Monday and on Tuesday, a Trade closed after the
// close still walked at the cutoff (A91), and the owed Close Reviews answered on their cards. The Review is
// derived from facts, so it reads the same after a restart.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import { closedScenario, MONDAY_1700, outstandingDebts, restart, reviewAt, TUESDAY_1700, TUESDAY_DATE, walkedIds, workspaceStores, dumpAll } from './support.ts';

const CLOSE_REVIEW = 'entry-type.close-review';
const ANSWERS = { 'prompt.close-review.take-again': { kind: 'Option', optionId: 'option.close-review.take-again.yes-as-planned' } } as const;

type Opened = Awaited<ReturnType<typeof reviewAt>>;
const owedOf = (opened: Opened) => opened.owed.map((t) => [t.tradeId, t.lifecycle, t.owed.map((o) => [o.entryTypeKey, o.classification])] as const);

// Answers an owed Close Review on its card, against the Review as `open` returns it.
async function answerOwed(app: Application, tradeId: string) {
  const opened = await reviewAt(app, TUESDAY_1700);
  const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'ReflectionsOwed') throw new Error(`getTrade: ${card.kind}`);
  const result = await app.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding: card.card.reflections[0]!.saveBinding, resolution: { kind: 'Answer', answers: ANSWERS } });
  if (result.kind !== 'DebtResolved') throw new Error(`DailyReview.save: ${result.kind}`);
  return result;
}

describe('I6.10 Review with closed Trades', () => {
  it('should walk and owe as the fixture table on Monday and Tuesday, walk T-N with cutoff figures and current lifecycle Closed, stay Incomplete naming only T-M until it is answered, leave completion unchanged when T-L is answered early, and read the same after a restart', async () => {
    let monday: Opened | undefined;
    const { d, app, trades } = await closedScenario(async (mondayApp) => {
      monday = await reviewAt(mondayApp, MONDAY_1700);
    });
    const { A, K, L, M, N, Q } = trades;

    // Monday: T-A, T-K and T-N walked, T-M owing a Close Review due in the next Review; T-P is absent.
    expect(walkedIds(monday!).sort()).toEqual([A, K, N].sort());
    expect(owedOf(monday!)).toEqual([[M, 'Closed', [[CLOSE_REVIEW, 'DueInNextReview']]]]);

    // Derivation at Monday's cutoff excludes Tuesday's exits, although Tuesday's facts are stored by now: the walk is
    // the same. (The owed group reads the Debts Outstanding now, so it also lists the Debts Tuesday created.)
    const mondayAgain = await reviewAt(app, MONDAY_1700);
    expect(walkedIds(mondayAgain).sort()).toEqual([A, K, N].sort());
    expect(owedOf(mondayAgain).find(([tradeId]) => tradeId === M)).toEqual([M, 'Closed', [[CLOSE_REVIEW, 'DueInNextReview']]]);

    // Tuesday: T-A and T-N walked; T-M (due), T-L (not yet due) and T-Q (a Position Change Reflection) owed, in that order.
    const tuesday = await reviewAt(app, TUESDAY_1700);
    expect(walkedIds(tuesday).sort()).toEqual([A, N].sort());
    expect(owedOf(tuesday)).toEqual([
      [M, 'Closed', [[CLOSE_REVIEW, 'Due']]],
      [L, 'Closed', [[CLOSE_REVIEW, 'DueInNextReview']]],
      [Q, 'Open', [['entry-type.position-change-reflection', 'DueInReviewAfterNext']]],
    ]);
    const debtM = (await outstandingDebts(app)).find((debt) => debt.anchor.tradeId === M)!;
    expect(tuesday.kind === 'Ready' && tuesday.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: M, debtIds: [debtM.debtId] }] });

    // T-N: closed after the close, so walked at the cutoff with the Position it held then and its lifecycle now.
    const card = await app.DailyReview.getTrade({ reviewDate: tuesday.reviewDate, tradeId: N, binding: tuesday.binding });
    if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
    expect(card.trade.lifecycle).toBe('Closed');
    expect(card.trade.evaluation).toEqual(
      expect.objectContaining({ openQuantity: { kind: 'Value', value: Rational.of(100n) }, realizedToDate: { kind: 'Value', value: Rational.of(0n) } }),
    );

    // Answering T-L's not-yet-due Close Review leaves completion as it was and removes T-L from the group.
    await answerOwed(app, L);
    const afterL = await reviewAt(app, TUESDAY_1700);
    expect(afterL.kind === 'Ready' && afterL.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: M, debtIds: [debtM.debtId] }] });
    expect(owedOf(afterL).map(([tradeId]) => tradeId)).toEqual([M, Q]);

    // Answering T-M's due one completes the Review.
    const resolved = await answerOwed(app, M);
    expect(resolved.review.kind === 'Ready' && resolved.review.completion).toEqual({ kind: 'Complete' });
    const done = await reviewAt(app, TUESDAY_1700);
    expect(done.kind === 'Ready' && done.completion).toEqual({ kind: 'Complete' });
    expect(owedOf(done)).toEqual([[Q, 'Open', [['entry-type.position-change-reflection', 'DueInReviewAfterNext']]]]);

    // After a restart the Review is the same, derived from facts, and no Review-session record exists.
    const again = await restart(app, d);
    const reopened = await reviewAt(again, TUESDAY_1700);
    expect({ ...reopened, binding: undefined }).toEqual({ ...done, binding: undefined });
    expect(walkedIds(reopened).sort()).toEqual([A, N].sort());
    expect(Object.keys(workspaceStores(await dumpAll(d.factory))).filter((name) => /session/i.test(name) || /review/i.test(name))).toEqual([]);
    expect(reopened.reviewDate).toBe(TUESDAY_DATE);
  }, 120_000);
});
