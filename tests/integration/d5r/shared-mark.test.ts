// I5R.3: a Mark shared by two Trades resolves once, whichever card it is saved from (AC-REV-002, "shared Mark resolves once").
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import { dumpAll, MONDAY, openReview, workspaceStores, type StoredObservation } from '../d5/support.ts';
import { cardApp, initialMark, marksSaved, saveMarksFrom } from './support.ts';

describe('I5R.3 Shared Mark through either card', () => {
  it('should carry T-A and T-F revised items both using XYZ 52.00 from a save on T-F card, with no Mark-missing blocker for XYZ, a fresh open in agreement, and one observation record', async () => {
    const { d, app, trades } = await cardApp({ withMarks: false });

    const saved = marksSaved(await saveMarksFrom(app, d, trades.f, [initialMark('XYZ', MONDAY, '52.00')]));

    const review = saved.review;
    if (review.kind !== 'Ready') throw new Error(review.kind);
    const walked = (id: string) => review.trades.find((t) => t.tradeId === id)!;
    // Both items are read from XYZ 52.00: T-A $180.00 and T-F $99.00.
    expect(walked(trades.a).meter!.now).toMatchObject({ kind: 'Value', value: { pnl: Rational.of(180n) } });
    expect(walked(trades.f).meter!.now).toMatchObject({ kind: 'Value', value: { pnl: Rational.of(99n) } });
    expect(walked(trades.a).figures?.rewardRiskNow).toEqual({ kind: 'Value', value: Rational.of(8n, 9n) });
    expect(walked(trades.f).figures?.rewardRiskNow).toEqual({ kind: 'Value', value: Rational.of(3n, 4n) });
    // No Mark-missing blocker for XYZ remains; the others do.
    const reasons = review.completion.kind === 'Incomplete' ? review.completion.reasons : [];
    expect(reasons.filter((r) => r.code === 'MarkMissing').map((r) => (r.code === 'MarkMissing' ? r.instrument.symbol : '')).sort()).toEqual(['ABC', 'DEF', 'JKL']);

    // A fresh open agrees, and each Trade's card uses the same XYZ Mark.
    const reopened = await openReview(app, d);
    expect(review.trades).toEqual(reopened.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])));
    expect(review.completion).toEqual(reopened.completion);
    for (const tradeId of [trades.a, trades.f]) {
      const card = await app.DailyReview.getTrade({ reviewDate: reopened.reviewDate, tradeId, binding: reopened.binding });
      if (card.kind !== 'Ready') throw new Error(card.kind);
      const resolution = card.trade.frame?.resolution;
      expect(resolution?.kind === 'Available' ? resolution.mark.price : resolution?.kind).toBe('52');
    }

    // One observation record, written once.
    const stored = workspaceStores(await dumpAll(d.factory))['observations'] as StoredObservation[];
    expect(stored.map((o) => [o.instrumentKey, o.tradingDate, o.marks.length])).toEqual([['XYZ', MONDAY, 1]]);
  }, 60_000);
});
