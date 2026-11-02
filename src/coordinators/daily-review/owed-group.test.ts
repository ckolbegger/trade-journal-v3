import { describe, expect, it } from 'vitest';
import { Rational } from '../../domain/values/index.ts';
import { reflectionsOwedProgress } from '../../../tests/support/card-progress.ts';
import { closedTradeReviewFixture, TUESDAY_1700, TUESDAY_CUTOFF } from '../../../tests/support/closed-trade-review-fixture.ts';
import { MONDAY_1700 } from '../../../tests/support/review-fixture.ts';
import type { OpenDailyReviewResult, WalkedTrade } from './index.ts';

const openAt = (stack: Awaited<ReturnType<typeof closedTradeReviewFixture>>['stack'], asOf: string) => stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });

function ready(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result;
}

const walkOf = (review: Extract<OpenDailyReviewResult, { kind: 'Ready' }>): readonly WalkedTrade[] => {
  const walk = review.families.find((family) => family.family === 'Trades');
  if (walk?.family !== 'Trades') throw new Error('no Trades family');
  return walk.trades;
};

describe('eligibility extended (A88, AC-REV-001)', () => {
  it('should walk T-N in the Tuesday Review although it is now Closed, evaluated at the Tuesday cutoff with Position 100 and realized-to-date 0.00 dollars', async () => {
    const { stack, trades } = await closedTradeReviewFixture();
    const review = ready(await openAt(stack, TUESDAY_1700));

    const n = walkOf(review).find((trade) => trade.tradeId === trades.N);
    expect(n).toBeDefined();
    expect(n!.summary).toEqual(expect.objectContaining({ kind: 'Stock', direction: 'Long', quantity: Rational.of(100n) }));
    // The stored Trade is Closed, and the Review evaluates the Position it held at the close.
    const stored = await stack.tradeRecord.getRecord({ tradeId: trades.N!, projection: 'Summary' });
    expect(stored).toEqual(expect.objectContaining({ kind: 'Found', projection: expect.objectContaining({ lifecycle: 'Closed' }) as unknown }));
    const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: trades.N!, binding: review.binding });
    if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
    expect(card.trade.evaluation).toEqual(
      expect.objectContaining({
        openQuantity: { kind: 'Value', value: Rational.of(100n) },
        realizedToDate: { kind: 'Value', value: Rational.of(0n) },
      }),
    );
  }, 60_000);
});

const CLOSE_REVIEW = 'entry-type.close-review';
const POSITION_CHANGE_REFLECTION = 'entry-type.position-change-reflection';

describe('Trades with owed reflections (P19, P20, A89)', () => {
  it('should return, after the walk, every Trade outside it with an Outstanding reflection, due or not, as T-M, T-L, T-Q in the Tuesday Review and T-M alone in the Monday Review, with T-K and T-P absent, and name only the Close Review of T-M among the Tuesday completion blockers', async () => {
    let monday: OpenDailyReviewResult | undefined;
    const { stack, trades, debts } = await closedTradeReviewFixture({
      onMonday: async ({ stack: building }) => {
        monday = await openAt(building, MONDAY_1700);
      },
    });
    const debtOf = (name: 'L' | 'M' | 'Q') => debts.find((debt) => debt.anchor.tradeId === trades[name])!;
    const item = (name: 'L' | 'M' | 'Q', entryTypeKey: string, dueAnchor: string, classification: string) => ({ debtId: debtOf(name).debtId, entryTypeKey, dueAnchor, classification });

    // Tuesday: the owed Trade with a due reflection first, then by oldest owed anchor.
    const tuesday = ready(await openAt(stack, TUESDAY_1700));
    expect(walkOf(tuesday).map((trade) => trade.tradeId).sort()).toEqual([trades.A, trades.N].sort());
    expect(tuesday.owed).toEqual([
      { tradeId: trades.M, underlying: 'MNP', lifecycle: 'Closed', owed: [item('M', CLOSE_REVIEW, '2026-10-12T19:00:00Z', 'Due')], progress: reflectionsOwedProgress(1, 0) },
      { tradeId: trades.L, underlying: 'LMN', lifecycle: 'Closed', owed: [item('L', CLOSE_REVIEW, '2026-10-13T19:00:00Z', 'DueInNextReview')], progress: reflectionsOwedProgress(0, 1) },
      { tradeId: trades.Q, underlying: 'QST', lifecycle: 'Open', owed: [item('Q', POSITION_CHANGE_REFLECTION, '2026-10-13T20:10:00Z', 'DueInReviewAfterNext')], progress: reflectionsOwedProgress(0, 1) },
    ]);
    // Only the due reflection blocks completion: every Mark and Action is saved, and the later ones never block.
    expect(tuesday.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: trades.M, debtIds: [debtOf('M').debtId] }] });
    // The binding names the group's Trades, so a card of the group can be opened against it.
    expect(Object.keys(tuesday.binding.outstandingDebts).sort()).toEqual([trades.L, trades.M, trades.Q].sort());
    expect(Object.keys(tuesday.binding.factRevisions).sort()).toEqual([trades.A, trades.L, trades.M, trades.N, trades.Q].sort());

    // Monday: T-M alone, its Close Review falling due in the next Review.
    const earlier = ready(monday!);
    expect(walkOf(earlier).map((trade) => trade.tradeId).sort()).toEqual([trades.A, trades.K, trades.N].sort());
    expect(earlier.owed).toEqual([
      { tradeId: trades.M, underlying: 'MNP', lifecycle: 'Closed', owed: [item('M', CLOSE_REVIEW, '2026-10-12T19:00:00Z', 'DueInNextReview')], progress: reflectionsOwedProgress(0, 1) },
    ]);
  }, 60_000);

  it('should list the reflections one Trade owes in due-anchor order as instants, a later anchor whose text sorts first coming last', async () => {
    const { stack } = await closedTradeReviewFixture({ only: [] });
    const trade = await stack.confirm({ shares: '100', symbol: 'QST', entry: '10.00', stop: '9.00', target: '12.00', planTime: '2026-10-13T13:00:00Z' });
    // Both buys come after the Tuesday cutoff, so the Trade is outside the walk. The text of the later anchor sorts before the earlier one
    // ('.' before 'Z'), so the Journal's index returns the later Debt first.
    const earlier = '2026-10-13T20:10:00Z';
    const later = '2026-10-13T20:10:00.500Z';
    await stack.fill(trade, earlier, '50', '10.00', { kind: 'Defer' });
    await stack.fill(trade, later, '50', '10.00', { kind: 'Defer' });
    const indexOrder = (await stack.journal.query({ scope: 'OutstandingDebt' })).debts.map((debt) => debt.dueAnchor);
    expect(indexOrder).toEqual([later, earlier]);

    // Neither reflection is due yet, so no Trade is walked and the Review is Empty with the owed group attached.
    const review = await openAt(stack, TUESDAY_1700);
    if (review.kind !== 'Empty') throw new Error(`expected Empty, got ${review.kind}`);

    expect(review.owed).toHaveLength(1);
    expect(review.owed[0]!.owed.map((reflection) => reflection.dueAnchor)).toEqual([earlier, later]);
  }, 60_000);

  it('should return Empty with the owed group attached when no Trade was eligible and no reflection is due, from a Workspace holding only T-L in the Tuesday Review', async () => {
    const { stack, trades, debts } = await closedTradeReviewFixture({ only: ['L'] });
    const opened = await openAt(stack, TUESDAY_1700);

    expect(opened).toEqual({
      kind: 'Empty',
      reviewDate: '2026-10-13',
      cutoff: TUESDAY_CUTOFF,
      owed: [
        {
          tradeId: trades.L,
          underlying: 'LMN',
          lifecycle: 'Closed',
          owed: [{ debtId: debts[0]!.debtId, entryTypeKey: CLOSE_REVIEW, dueAnchor: '2026-10-13T19:00:00Z', classification: 'DueInNextReview' }],
          progress: reflectionsOwedProgress(0, 1),
        },
      ],
      // The cards of the group are opened against this binding.
      binding: expect.objectContaining({ factRevisions: { [trades.L!]: expect.any(Number) as unknown }, outstandingDebts: { [trades.L!]: [debts[0]!.debtId] } }) as unknown,
    });
  }, 60_000);
});
