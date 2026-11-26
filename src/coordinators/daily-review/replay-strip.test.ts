import { describe, expect, it } from 'vitest';
import { closedTradeReviewFixture, TUESDAY_1700 } from '../../../tests/support/closed-trade-review-fixture.ts';
import { MONDAY_1700, REVIEW_DATE, reviewStack } from '../../../tests/support/review-fixture.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { Rational } from '../../domain/values/index.ts';

// T95.56, decision 131: the figures the Replay strip's words say, counted by the coordinator from the replay a card already holds.
describe('the Replay strip figures of a card (T95.56, W146)', () => {
  it('should count the sessions, the low and the high, and for the line a Trade is past its first crossing, the run since and the sessions in it', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // ABC is past its Stop on Tuesday, recovers Wednesday, and is past it again Thursday, Friday and Monday.
    // Each fill costs a fee of 1.00, so the dollars are one more than the price moves.
    const abc = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-05T13:00:00Z' });
    await stack.fill(abc, '2026-10-05T14:00:00Z', '100', '30.00');
    for (const [date, price] of [['2026-10-05', '29.00'], ['2026-10-06', '27.00'], ['2026-10-07', '29.00'], ['2026-10-08', '27.00'], ['2026-10-09', '27.00'], [REVIEW_DATE, '27.00']] as const) await stack.saveMark('ABC', price, date);
    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);

    const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: abc.tradeId, binding: review.binding });
    if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);

    expect(card.trade.strip).toEqual({
      sessions: 6,
      low: { date: '2026-10-06', value: Rational.of(-301n) },
      high: { date: '2026-10-05', value: Rational.of(-101n) },
      stop: { first: '2026-10-06', since: '2026-10-08', sessions: 3 },
      target: {},
    });
  }, 60_000);

  // Decision 136: the owed card reads its Trade's replay from the read session it holds, as an open card does.
  it('should give an owed card its Trade replay and strip figures with one series read of the Trade Instrument', async () => {
    const { stack, trades } = await closedTradeReviewFixture({ only: ['M', 'Q'] });
    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);

    // T-M (MNP, bought and sold Monday) is Closed, T-Q (QST, bought after Tuesday's close) is Open: both owe only a reflection.
    const counted = await countRequests(() => stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: trades.M!, binding: review.binding }));
    if (counted.result.kind !== 'ReflectionsOwed') throw new Error(`expected ReflectionsOwed, got ${counted.result.kind}`);
    const { card } = counted.result;

    expect(card.replay?.tradeId).toBe(trades.M);
    expect(card.replay?.sessions.map((s) => s.date)).toEqual(['2026-10-12']);
    expect(card.replay?.sessions[0]?.journal).toEqual([]);
    expect(card.strip?.sessions).toBe(1);
    // Bought at 40.00 and sold at 41.00 inside its Stop and Target: neither line was reached, and the one session is both the low and the high.
    const result = Rational.of(492n, 5n);
    expect(card.strip).toEqual({ sessions: 1, low: { date: '2026-10-12', value: result }, high: { date: '2026-10-12', value: result }, stop: {}, target: {} });
    // One series read for the Trade's one Instrument (the cursor on the same index is the Review frames', made before).
    expect(counted.requests.filter((r) => r.index === 'byInstrumentDate' && r.method === 'getAll')).toEqual([{ on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'getAll' }]);

    const open = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId: trades.Q!, binding: review.binding });
    if (open.kind !== 'ReflectionsOwed') throw new Error(`expected ReflectionsOwed, got ${open.kind}`);
    expect(open.card.replay?.tradeId).toBe(trades.Q);
  }, 60_000);
});
