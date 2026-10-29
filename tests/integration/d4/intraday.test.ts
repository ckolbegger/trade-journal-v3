// I4.18: intraday and missing lines (P12, P13): the dated line values the Position held at the last
// exact Mark's close, and the at-entry line measures Lots opened since from their execution prices.
import { describe, expect, it } from 'vitest';
import { confirmReference, dec, detail, MONDAY, onboarded, openItem, PC1, PC2, record, restart, saveMark, TUESDAY_NOON, value, device, type Device } from './support.ts';
import type { Application } from '../../../src/app/compose.ts';

const TUESDAY = '2026-10-13';
const TUESDAY_1700 = '2026-10-13T21:00:00Z';
const TUESDAY_10AM = '2026-10-13T14:00:00Z';
const instrument = { kind: 'Stock', symbol: 'XYZ' };

// PC1 on Monday and PC2 (40 @ 50.30) on Tuesday at 10:00, with Monday's Mark of 52.00.
async function book(now: string): Promise<{ d: Device; app: Application; tradeId: string }> {
  const d = await device(undefined, now);
  const app = await onboarded(d);
  const tradeId = await confirmReference(app);
  await record(app, tradeId, PC1);
  await record(app, tradeId, { ...PC2, economicTime: TUESDAY_10AM });
  await saveMark(app, 'XYZ', MONDAY, '52.00');
  return { d, app, tradeId };
}

// The Monday close line: 60 shares held then, valued with Monday's own Mark (60 x 1.90 less 1.00 fee).
const mondayLine = (evaluation: unknown) =>
  expect(evaluation).toEqual(
    expect.objectContaining({ openQuantity: value('60'), remainingOpenPnl: value('113'), ongoingRiskToStop: value('270'), atEntry: null }),
  );

// The 40 shares bought Tuesday, measured from their execution price against the Stop and Target.
const atEntry = { label: 'AtEntry', quantity: dec('40'), averageEntry: dec('50.30'), riskFromEntry: dec('112'), rewardFromEntry: dec('228') };

describe('I4.18 intraday and missing lines', () => {
  it('should show AwaitingClose figures with the Monday close line of 60 shares and the 40-share at-entry line on Tuesday noon, and Missing Tuesday figures with only the Monday line on Tuesday 17:00', async () => {
    const intraday = await book(TUESDAY_NOON);
    const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: MONDAY } };
    for (const app of [intraday.app, await restart(intraday.app, intraday.d)]) {
      const item = (await openItem(app, intraday.tradeId)).current;
      const view = (await detail(app, intraday.tradeId)).current;
      if (view.evaluation.kind !== 'Evaluated') throw new Error('no evaluation');
      for (const [figures, where] of [[item, item], [view.evaluation, view]] as const) {
        expect(where.expectedMarkDate).toBe(MONDAY);
        expect(figures.currentMarkedPnl).toEqual(awaiting);
        expect(figures.ongoingRiskToStop).toEqual(awaiting);
        expect(figures.atEntry).toEqual(atEntry);
        expect(where.datedLine?.tradingDate).toBe(MONDAY);
        mondayLine(where.datedLine?.evaluation);
      }
    }

    // Tuesday 17:00 with no Tuesday Mark: Tuesday is the Expected Mark Date and its Mark is Missing.
    const missing = await book(TUESDAY_1700);
    const unavailable = { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument, date: TUESDAY } };
    for (const app of [missing.app, await restart(missing.app, missing.d)]) {
      const item = (await openItem(app, missing.tradeId)).current;
      const view = (await detail(app, missing.tradeId)).current;
      if (view.evaluation.kind !== 'Evaluated') throw new Error('no evaluation');
      for (const [figures, where] of [[item, item], [view.evaluation, view]] as const) {
        expect(where.expectedMarkDate).toBe(TUESDAY);
        expect(where.markResolution).toEqual({ kind: 'Missing', stale: expect.objectContaining({ tradingDate: MONDAY, price: '52' }) as unknown });
        // No current figure uses Monday's Mark.
        expect(figures.currentMarkedPnl).toEqual(unavailable);
        expect(figures.remainingOpenPnl).toEqual(unavailable);
        expect(figures.ongoingRiskToStop).toEqual(unavailable);
        expect(figures.worstCaseOngoingRisk).toEqual(unavailable);
        expect(figures.incrementalRewardToTarget).toEqual(unavailable);
        expect(where.datedLine?.tradingDate).toBe(MONDAY);
        mondayLine(where.datedLine?.evaluation);
        expect(figures.atEntry).toEqual(atEntry);
      }
    }
  });
});
