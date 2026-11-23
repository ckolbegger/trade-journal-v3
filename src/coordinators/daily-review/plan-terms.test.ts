import { describe, expect, it } from 'vitest';
import { MONDAY_1700, reviewStack } from '../../../tests/support/review-fixture.ts';

// T95.16-D1: the card carries the Plan's Thesis and "No longer valid if" (P177, decision 130).

describe('getTrade: the Plan terms (P177)', () => {
  it('should give each card the Plan Thesis and No longer valid if', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const a = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(a, '2026-10-12T14:00:00Z', '100', '50.00');
    const b = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(b, '2026-10-12T14:00:00Z', '100', '30.00');
    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);

    for (const tradeId of [a.tradeId, b.tradeId]) {
      const result = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
      if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
      expect(result.trade.plan).toEqual({ thesis: 'Breakout above the 50-day on volume.', invalidation: 'A close back below the stop.' });
    }
  }, 60_000);
});
