// I7.15: an option Trade with its Underlying's Mark Missing, and with both of Tuesday's Marks Missing (AC-CALC-002 partial;
// AC-CALC-003 partial): the valuation at the call's Mark stays a Value while every figure that needs XYZ is
// Unavailable(MarkMissing) naming XYZ and the date; with neither Tuesday Mark, the current figures are Missing for the call.
import { describe, expect, it } from 'vitest';
import type { OpenTradeDetail } from '../../../src/coordinators/trade-views/index.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { confirmOption, detail, MONDAY_DATE, OC_PC1, OC_PC2, onboardedAt, openItem, recordOption, restart, saveMark, TUESDAY_1700, TUESDAY_DATE, value, XYZ_CALL } from './support.ts';

const CALL = instrumentKey(XYZ_CALL);
const missing = (instrument: unknown) => ({ kind: 'Unavailable', reason: 'MarkMissing', instrument, date: TUESDAY_DATE });
const MARK_DEPENDENT = ['remainingOpenPnl', 'currentMarkedPnl', 'ongoingRiskToStop', 'worstCaseOngoingRisk', 'incrementalRewardToTarget'] as const;

// O-C after PC2 on a Tuesday 17:00 device.
async function afterPc2() {
  const { d, app } = await onboardedAt(TUESDAY_1700);
  const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
  await recordOption(app, tradeId, 'Buy', OC_PC1);
  await recordOption(app, tradeId, 'Buy', OC_PC2);
  return { d, app, tradeId };
}

describe('I7.15 Underlying Mark Missing and dated line', () => {
  it('should value O-C at the call Mark of 2.40 as a Value of 78.70 while condition status, Risk to Stop and Reward to Target are Unavailable MarkMissing naming XYZ and 2026-10-13', async () => {
    const { d, app, tradeId } = await afterPc2();
    await saveMark(app, CALL, TUESDAY_DATE, '2.40');
    const xyz = { kind: 'Stock', symbol: 'XYZ' };

    const check = async (live: typeof app) => {
      const item = (await openItem(live, tradeId)).current;
      const view = await detail(live, tradeId);
      const current = view.current as OpenTradeDetail['current'];
      if (view.current.evaluation.kind !== 'Evaluated') throw new Error('no evaluation');
      expect(view.current.expectedMarkDate).toBe(TUESDAY_DATE);
      expect(current.mark).toEqual(expect.objectContaining({ price: '2.4' }));
      expect(current.underlyingMark).toBeUndefined();
      expect(view.current.evaluation.marketValue).toEqual(value('480'));
      for (const figures of [item, view.current.evaluation]) {
        expect(figures.remainingOpenPnl).toEqual(value('78.70'));
        expect(figures.currentMarkedPnl).toEqual(value('78.70'));
        expect(figures.worstCaseOngoingRisk).toEqual(value('480'));
        expect(figures.ongoingRiskToStop).toEqual(missing(xyz));
        expect(figures.incrementalRewardToTarget).toEqual(missing(xyz));
      }
      expect(view.current.evaluation.conditions.map((c) => [c.role, c.result])).toEqual([['Stop', missing(xyz)], ['Target', missing(xyz)]]);
    };
    await check(app);
    await check(await restart(app, d));
  }, 60_000);

  it('should show every current figure Missing for the call, naming the call and 2026-10-13, when only Monday has Marks', async () => {
    const { d, app, tradeId } = await afterPc2();
    await saveMark(app, CALL, MONDAY_DATE, '2.20');
    await saveMark(app, 'XYZ', MONDAY_DATE, '52.00');

    const check = async (live: typeof app) => {
      const item = (await openItem(live, tradeId)).current;
      const view = (await detail(live, tradeId)).current;
      if (view.evaluation.kind !== 'Evaluated') throw new Error('no evaluation');
      expect(view.expectedMarkDate).toBe(TUESDAY_DATE);
      expect(view.markResolution).toEqual({ kind: 'Missing', stale: expect.objectContaining({ tradingDate: MONDAY_DATE, price: '2.2' }) as unknown });
      for (const figures of [item, view.evaluation]) {
        for (const name of MARK_DEPENDENT) expect([name, figures[name]]).toEqual([name, missing(XYZ_CALL)]);
      }
      expect(view.evaluation.marketValue).toEqual(missing(XYZ_CALL));
    };
    await check(app);
    await check(await restart(app, d));
  }, 60_000);

  // The plan expects a dated "At Mon Oct 12 close" line valuing the Position held then with Monday's two Marks (decision 26,
  // reusing D4's mechanism). Trade Views builds the dated line for a Long Stock Trade only (`legs[0].instrument.kind ===
  // 'Stock'` in trade-views.ts, twice), and `datedLineOf` has no Underlying frame, so an option Trade gets none. Expected to
  // fail until the dated line serves options.
  it('should add the dated line from Monday close valuing 2 contracts at 2.20 with XYZ at 52.00 beside the Missing Tuesday figures', async () => {
    const { app, tradeId } = await afterPc2();
    await saveMark(app, CALL, MONDAY_DATE, '2.20');
    await saveMark(app, 'XYZ', MONDAY_DATE, '52.00');

    const view = (await detail(app, tradeId)).current;
    expect(view.datedLine?.tradingDate).toBe(MONDAY_DATE);
    const line = view.datedLine!.evaluation;
    if (line.kind !== 'Evaluated') throw new Error('the dated line has no evaluation');
    // 2 contracts at 2.20 are worth 440.00; the cost was 400.00 and the fees 1.30.
    expect(line.marketValue).toEqual(value('440'));
    expect(line.remainingOpenPnl).toEqual(value('38.70'));
    expect((await openItem(app, tradeId)).current.datedLine?.tradingDate).toBe(MONDAY_DATE);
  }, 60_000);
});
