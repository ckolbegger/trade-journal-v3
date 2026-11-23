import { describe, expect, it } from 'vitest';
import { cardFixture, MONDAY_1700, reviewStack } from '../../../tests/support/review-fixture.ts';
import { seriesStack } from '../../../tests/support/replay-series-stack.ts';
import { R_BREN_U } from '../../domain/trade-analysis/option-trade.ts';
import { Rational } from '../../domain/values/index.ts';
import type { OpenDailyReviewResult } from './index.ts';

// T95.16-D2: each walked Trade carries its P&L in dollars and R and its change since the session before (P178, decision 131).

const MON_1116_1700 = '2026-11-16T22:00:00Z';

const PLAN_R = Rational.of(247n, 81n);

function walk(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  const family = result.families.find((f) => f.family === 'Trades');
  if (!family) throw new Error('no Trades family');
  return family.trades;
}

describe('open: the walked Trade P&L (P178)', () => {
  it('should give each walked Trade its P&L in dollars and R', async () => {
    const { stack, tradeId } = await seriesStack(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });

    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });

    const trade = walk(opened).find((t) => t.tradeId === tradeId)!;
    expect(trade.pnl?.dollars).toEqual({ kind: 'Value', value: Rational.of(988n) });
    expect(trade.pnl?.planR).toEqual({ kind: 'Value', value: PLAN_R });
  }, 60_000);

  it('should give its change since the session before', async () => {
    const { stack, tradeId } = await seriesStack(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });

    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });

    // 988 now against 1138 at the session before.
    expect(walk(opened).find((t) => t.tradeId === tradeId)!.pnl?.change).toEqual({ kind: 'Value', dollars: Rational.of(-150n) });
  }, 60_000);

  it('should leave both Unavailable as the evaluation figures are', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { f } = await cardFixture(stack, { withoutMarks: true });

    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });

    // T-F's Instrument has no Mark on the Review Date.
    const pnl = walk(opened).find((t) => t.tradeId === f)!.pnl!;
    expect(pnl.dollars).toMatchObject({ kind: 'Unavailable', reason: 'MarkMissing' });
    expect(pnl.planR).toMatchObject({ kind: 'Unavailable', reason: 'MarkMissing' });
    expect(pnl.change).toEqual({ kind: 'Unavailable' });
  }, 60_000);
});
