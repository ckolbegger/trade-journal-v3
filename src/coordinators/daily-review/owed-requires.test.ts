import { describe, expect, it } from 'vitest';
import { D6_CATALOG_MANIFEST } from '../../modules/reference-catalog/index.ts';
import { ELEVEN_AM, MONDAY_1700, REVIEW_DATE, TEN_AM, reviewStack } from '../../../tests/support/review-fixture.ts';
import { createTradeViews } from '../trade-views/index.ts';

const TUESDAY_1700 = '2026-10-13T21:00:00Z';

// T95.42: a reflection owed for a sale that left the Plan Exit carries the roles its answer must include (U14, A321),
// on the Review card and on Trade Detail, from what each already reads.
// A long 100 shares of XYZ bought Monday 10-12 at 50.00 (Stop 47.50, Target 56.00); 40 sold at 51.00 that morning with its reflection put off.

async function partSaleOwed(now = MONDAY_1700) {
  const stack = await reviewStack(now);
  await stack.catalog.seedDefaults(D6_CATALOG_MANIFEST);
  const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
  await stack.fill(trade, TEN_AM, '100', '50.00');
  await stack.saveMark('XYZ', '51.00');
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
        economicTime: ELEVEN_AM,
      },
    ],
    reflection: { kind: 'Defer' },
  });
  if (sold.kind !== 'Recorded') throw new Error(`expected Recorded, got ${sold.kind}`);
  return { stack, tradeId: trade.tradeId };
}

describe('the roles an owed reflection requires (T95.42)', () => {
  it('should carry the Debt required roles on each owed reflection the Review card and Trade Detail return, with no added read', async () => {
    const { stack, tradeId } = await partSaleOwed();

    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);
    const card = await stack.dailyReview.getTrade({ reviewDate: REVIEW_DATE, tradeId, binding: review.binding });
    if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
    expect(card.trade.reflections.map((r) => r.requires)).toEqual([['PlanDepartureReason']]);

    const detail = await createTradeViews(stack).getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready' || !('positionChanges' in detail.view)) throw new Error('expected the Open Trade Detail');
    const debts = detail.view.journal.filter((item) => item.kind === 'Debt');
    expect(debts.map((d) => d.requires)).toEqual([['PlanDepartureReason']]);
  }, 60_000);
});

describe('what the Trade line still needs when a reason is owed (W155)', () => {
  it('should say what the Trade line still needs when a reason is owed', async () => {
    // The reason is owed at the next Review: Tuesday's.
    const { stack, tradeId } = await partSaleOwed(TUESDAY_1700);
    await stack.saveMark('XYZ', '52.00', '2026-10-13');

    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUESDAY_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);

    // The reflection is due and names the reason: the line asks for it, not for a reflection, before the Action.
    expect(review.day!.lines.find((line) => line.tradeId === tradeId)!.needs).toEqual(['SayWhy', 'Action']);
  }, 60_000);
});
