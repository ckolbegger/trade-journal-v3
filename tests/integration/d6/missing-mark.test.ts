// I6.16: realized-to-date stays a Value beside a Missing Mark (AC-CALC-002, partial; one Instrument). T-A after X1
// at Tuesday 17:00 with no Tuesday Mark: realized 55.90 is known, and every figure that needs the Mark is
// Unavailable(MarkMissing) naming XYZ and 2026-10-13, never a fill cost or zero.
import { describe, expect, it } from 'vitest';
import { dec, detail, openItem, referenceTrade, reviewAt, recordExit, TUESDAY_1700, TUESDAY_DATE, value, X1 } from './support.ts';

const MARK_DEPENDENT = [
  'remainingOpenPnl',
  'currentMarkedPnl',
  'currentMarkedPnlInPlanR',
  'ongoingRiskToStop',
  'ongoingRiskToStopInPlanR',
  'worstCaseOngoingRisk',
  'worstCaseOngoingRiskInPlanR',
  'incrementalRewardToTarget',
  'incrementalRewardToTargetInPlanR',
] as const;

const unavailable = { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument: { kind: 'Stock', symbol: 'XYZ' }, date: TUESDAY_DATE } };

describe('I6.16 Realized beside a Missing Mark', () => {
  it('should show realized-to-date 55.90 as a Value in the Detail and Review, and remaining-open, current P&L and risk figures are Unavailable MarkMissing naming XYZ and 2026-10-13 in the Open list, Detail and Review', async () => {
    const { app, tradeId } = await referenceTrade(TUESDAY_1700);
    await recordExit(app, tradeId, [X1]);

    const item = (await openItem(app, tradeId)).current;
    const view = await detail(app, tradeId);
    const evaluation = view.current.evaluation;
    if (evaluation.kind !== 'Evaluated') throw new Error('the Detail has no evaluation');
    const figuresOf = [item, evaluation] as unknown as Record<string, unknown>[];
    for (const figures of figuresOf) for (const name of MARK_DEPENDENT) expect([name, figures[name]]).toEqual([name, unavailable]);
    expect(view.realizedToDate).toEqual(dec('55.90'));
    expect(evaluation.realizedToDate).toEqual(value('55.90'));
    expect(evaluation.incurredFees).toEqual(value('2.60'));

    // The Review's card for T-A, at the Tuesday close: the same split.
    const opened = await reviewAt(app, TUESDAY_1700);
    if (opened.kind !== 'Ready') throw new Error(`DailyReview.open: ${opened.kind}`);
    const card = await app.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
    const reviewFigures = card.trade.evaluation as unknown as Record<string, unknown>;
    expect(reviewFigures['realizedToDate']).toEqual(value('55.90'));
    for (const name of ['remainingOpenPnl', 'currentMarkedPnl', 'ongoingRiskToStop', 'worstCaseOngoingRisk', 'incrementalRewardToTarget']) expect([name, reviewFigures[name]]).toEqual([name, unavailable]);
  }, 60_000);
});
