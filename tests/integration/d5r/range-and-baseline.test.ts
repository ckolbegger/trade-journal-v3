// I5R.4: the range position, Reward : risk now and the Plan baseline end to end, from stored facts and Marks after a
// restart (P39, P40). Expected values are section 4's table for the card fixture at the Monday Marks.
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import { openReview, restart } from '../d5/support.ts';
import { cardApp } from './support.ts';

const r = (n: bigint, d = 1n) => Rational.of(n, d);

describe('I5R.4 Range position and baseline end to end', () => {
  it('should give each Trade the range position and Reward : risk of section 4 table and T-A a baseline of 1R $250.00 and planned 12/5, after a restart', async () => {
    const { d, app, trades } = await cardApp({ withMarks: true });
    const live = await restart(app, d);

    const opened = await openReview(live, d);
    const walked = opened.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
    const position = (id: string) => walked.find((t) => t.tradeId === id)!.rangePosition;
    const now = (id: string) => walked.find((t) => t.tradeId === id)!.figures?.rewardRiskNow;
    expect(position(trades.a)).toEqual({ kind: 'Value', value: { now: r(9n, 17n), atEntry: r(134n, 425n) } });
    expect(position(trades.b)).toEqual({ kind: 'Value', value: { now: r(0n), atEntry: r(1n, 4n), pinned: 'Stop' } });
    expect(position(trades.c)).toEqual({ kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: 'DEF' }, date: opened.reviewDate });
    expect(position(trades.e)).toEqual({ kind: 'Value', value: { now: r(2n, 11n), atEntry: r(1n, 11n) } });
    expect(position(trades.f)).toEqual({ kind: 'Value', value: { now: r(4n, 7n), atEntry: r(2n, 7n) } });
    expect(now(trades.a)).toEqual({ kind: 'Value', value: r(8n, 9n) });
    expect(now(trades.b)?.kind).toBe('NotApplicable');
    expect(now(trades.c)?.kind).toBe('Unavailable');
    expect(now(trades.e)).toEqual({ kind: 'Value', value: r(9n, 2n) });
    expect(now(trades.f)).toEqual({ kind: 'Value', value: r(3n, 4n) });

    // The Plan baseline through getTrade: the planned Reward : risk of the table's last column.
    const planned = { [trades.a]: r(12n, 5n), [trades.b]: r(3n), [trades.c]: r(3n), [trades.e]: r(10n), [trades.f]: r(5n, 2n) };
    for (const [tradeId, ratio] of Object.entries(planned)) {
      const card = await live.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
      if (card.kind !== 'Ready') throw new Error(card.kind);
      expect(card.trade.evaluation?.planBaseline).toEqual({ kind: 'Value', value: expect.objectContaining({ rewardRiskRatio: ratio }) as unknown });
      if (tradeId === trades.a) {
        expect(card.trade.evaluation?.oneR).toEqual({ kind: 'Value', value: r(250n) });
        expect(card.trade.evaluation?.planBaseline).toEqual({
          kind: 'Value',
          value: expect.objectContaining({ oneR: r(250n), originalPlannedRisk: r(250n), originalPlannedReward: r(600n), rewardRiskRatio: r(12n, 5n) }) as unknown,
        });
      }
    }
  }, 60_000);
});
