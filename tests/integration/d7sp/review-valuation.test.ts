// T7SP.8: the Daily Review values each Trade through Mark-to-Market Valuation (P83, decision 104), with the real facade on
// fake-indexeddb, as D7's Review cases are. O-C is bought on Monday 2026-10-12 and the Review is Tuesday 17:00 with the
// call's and XYZ's Monday Marks only, so Tuesday's contract Mark is Missing with Monday's as its Stale context.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { confirmOption, detailOf, OC_PC1, OC_PC2, onboardedAt, recordOption, reviewAt, saveMark, TUESDAY_1700, XYZ_CALL } from '../d7/support.ts';

const MONDAY_DATE = '2026-10-12';

async function openCall(app: Application) {
  const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', OC_PC1);
  await recordOption(app, tradeId, 'Buy', OC_PC2);
  await saveMark(app, instrumentKey(XYZ_CALL), MONDAY_DATE, '2.20');
  await saveMark(app, 'XYZ', MONDAY_DATE, '52.00');
  return tradeId;
}

async function cardOf(app: Application, tradeId: string) {
  const review = await reviewAt(app, TUESDAY_1700);
  if (review.kind !== 'Ready') throw new Error(review.kind);
  const card = await app.DailyReview.getTrade({ reviewDate: review.reviewDate, tradeId, binding: review.binding });
  if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
  return card.trade;
}

describe('Daily Review through Mark-to-Market Valuation (P83, P84)', () => {
  it('should give O-C a getTrade card dated line at Monday close valued with the call and XYZ Monday Marks', { timeout: 120_000 }, async () => {
    const { app } = await onboardedAt(TUESDAY_1700);
    const tradeId = await openCall(app);

    const card = await cardOf(app, tradeId);

    expect(card.evaluation?.staleContext).toEqual(expect.objectContaining({ tradingDate: MONDAY_DATE, price: '2.2' }));
    expect(card.datedLastClose?.tradingDate).toBe(MONDAY_DATE);
    const line = card.datedLastClose!.evaluation;
    expect(line.observation).toEqual(expect.objectContaining({ tradingDate: MONDAY_DATE, mark: expect.objectContaining({ price: '2.2' }) as unknown }));
    expect(line.currentMarkedPnl.kind).toBe('Value');
  });

  it('should give O-C a card the same dated line as the Trade Views Detail for the same Trade and date', { timeout: 120_000 }, async () => {
    const { app } = await onboardedAt(TUESDAY_1700);
    const tradeId = await openCall(app);

    const card = await cardOf(app, tradeId);
    const detail = await detailOf(app, tradeId);

    const detailLine = 'current' in detail && 'datedLine' in detail.current ? detail.current.datedLine : undefined;
    expect(detailLine).toBeTruthy();
    expect(card.datedLastClose).toEqual(detailLine);
  });
});
