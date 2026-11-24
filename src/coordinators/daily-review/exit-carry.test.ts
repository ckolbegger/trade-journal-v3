import { describe, expect, it } from 'vitest';
import { D6_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { TEN_AM, reviewStack } from '../../../tests/support/review-fixture.ts';
import { Rational } from '../../domain/values/index.ts';

// T95.41: an Exit not carried out carries what is still held and what was sold since the Exit's Review Date (A313), on the page and on the card.
// A long 100 shares of XYZ bought Monday 10-12; Exit saved for that Review Date; 40 sold Tuesday 10-13 at 51.00. The Review Date is Tuesday.

const TUESDAY_1700 = '2026-10-13T21:00:00Z';
const TUESDAY_ELEVEN = '2026-10-13T15:00:00Z';

async function chosenThenPartSale(action: 'Exit' | 'Roll' | 'Adjust' = 'Exit') {
  const stack = await reviewStack(TUESDAY_1700);
  await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
  const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
  await stack.fill(trade, TEN_AM, '100', '50.00');
  await stack.saveMark('XYZ', '51.00', '2026-10-12');
  await stack.saveMark('XYZ', '51.50', '2026-10-13');
  await stack.saveAction(trade.tradeId, action, '2026-10-12', 'Take the money.');
  const current = await stack.tradeRecord.getRecord({ tradeId: trade.tradeId, projection: 'AnalysisInput' });
  if (current.kind !== 'Found') throw new Error('no Trade');
  const sold = await stack.tradeWorkflows.recordPositionChange({
    originTradeId: trade.tradeId,
    trades: [{ tradeId: trade.tradeId, expectedFactRevision: current.factRevision }],
    members: [
      {
        kind: 'Execution',
        tradeId: trade.tradeId,
        action: 'Sell',
        instrument: { kind: 'Stock', symbol: 'XYZ' },
        intent: { kind: 'ServesPlannedLeg', plannedLegId: trade.plan.legs[0]!.factId },
        quantity: '40',
        price: '51.00',
        fee: '1.00',
        economicTime: TUESDAY_ELEVEN,
      },
    ],
    reflection: { kind: 'Defer' },
  });
  if (sold.kind !== 'Recorded') throw new Error(`expected Recorded, got ${sold.kind}`);
  return { stack, tradeId: trade.tradeId };
}

describe('an Exit not carried out (T95.41)', () => {
  it('should carry on the page and on the card what the Exit still holds and what was sold since', async () => {
    const { stack, tradeId } = await chosenThenPartSale();

    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);
    const walked = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])).find((t) => t.tradeId === tradeId);
    expect(walked?.lastAction).toEqual({ reviewDate: '2026-10-12', action: 'Exit', reason: 'Take the money.' });
    expect(walked?.exitCarry).toEqual({ direction: 'Long', held: Rational.of(60n), sold: Rational.of(40n) });

    const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding });
    if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
    expect(card.trade.attention.exitCarry).toEqual({ direction: 'Long', held: Rational.of(60n), sold: Rational.of(40n) });
  }, 60_000);

  it('should carry nothing for an earlier Roll or Adjust, and leave its band alone', async () => {
    for (const action of ['Roll', 'Adjust'] as const) {
      const { stack, tradeId } = await chosenThenPartSale(action);

      const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
      if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);
      const walked = review.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])).find((t) => t.tradeId === tradeId);
      expect(walked?.lastAction?.action).toBe(action);
      expect(walked?.exitCarry).toBeUndefined();
      expect(walked?.band).not.toBe('ExitNotCarriedOut');

      const card = await stack.dailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding });
      if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
      expect(card.trade.attention.exitCarry).toBeUndefined();
    }
  }, 120_000);
});
