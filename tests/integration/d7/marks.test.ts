// I7.9: a Mark of exactly 0 is a Mark (P27, A115): the Settlement Review fixture's call and XYZ stock are saved at 0 on
// 2026-11-20, T-1 and T-2 evaluate with them, and a negative price and a Mark dated after the contract's expiration are
// refused with the dump unchanged.
import { describe, expect, it } from 'vitest';
import type { OpenTradeDetail } from '../../../src/coordinators/trade-views/index.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { detail, device, dumpAll, FRIDAY_1700, FRIDAY_DATE, MONDAY_NEXT_1700, onboarded, restart, saveMark, settlementTrades, value, XYZ_CALL } from './support.ts';

const markFor = (instrumentKey: string, tradingDate: string, price: string) =>
  ({ intention: 'RecordInitialManualMark', instrumentKey, tradingDate, price, expectedResolutionRevision: 'None' }) as const;

describe('I7.9 Marks of 0', () => {
  it('should save 0 for the XYZ call and for XYZ stock as Available Marks, evaluate T-1 and T-2 with them and their Stops Breached, and refuse -0.01 and a Mark dated after expiration with the dump unchanged', async () => {
    const d = await device(undefined, FRIDAY_1700);
    let app = await onboarded(d);
    const { t1, t2 } = await settlementTrades(app, false);

    const call = await saveMark(app, instrumentKey(XYZ_CALL), FRIDAY_DATE, '0');
    const stock = await saveMark(app, 'XYZ', FRIDAY_DATE, '0');
    for (const saved of [call, stock]) {
      expect(saved.resolution).toEqual({ kind: 'Available', mark: expect.objectContaining({ price: '0', source: 'Manual' }) as unknown });
    }

    // T-1: O-C after X1, one contract left at 1.90 with fee 0.65, realized 88.70. The call at 0 is worth nothing.
    const one = (await detail(app, t1)).current as OpenTradeDetail['current'];
    expect(one.markResolution).toEqual(call.resolution);
    expect(one.mark).toEqual(expect.objectContaining({ revisionId: call.revision.revisionId, price: '0' }));
    expect(one.underlyingMark).toEqual(expect.objectContaining({ revisionId: stock.revision.revisionId, price: '0' }));
    const first = one.evaluation;
    if (first.kind !== 'Evaluated') throw new Error('T-1 has no evaluation');
    expect(first.marketValue).toEqual(value('0'));
    expect(first.remainingOpenPnl).toEqual(value('-190.65'));
    expect(first.currentMarkedPnl).toEqual(value('-101.95'));
    expect(first.worstCaseOngoingRisk).toEqual(value('0'));
    expect(first.conditions.map((c) => [c.role, c.result.kind === 'Value' && c.result.value.status])).toEqual([['Stop', 'Breached'], ['Target', 'Active']]);

    // T-2: 100 XYZ shares bought at 50.00 with fee 1.00. At 0 the Marked P&L is minus the cost and the fee.
    const two = (await detail(app, t2)).current;
    expect(two.markResolution).toEqual(stock.resolution);
    const second = two.evaluation;
    if (second.kind !== 'Evaluated') throw new Error('T-2 has no evaluation');
    expect(second.marketValue).toEqual(value('0'));
    expect(second.currentMarkedPnl).toEqual(value('-5001'));
    expect(second.worstCaseOngoingRisk).toEqual(value('0'));
    expect(second.conditions.map((c) => [c.role, c.result.kind === 'Value' && c.result.value.status])).toEqual([['Stop', 'Breached'], ['Target', 'Active']]);

    // A negative price is refused, and so is a Mark for the call dated after its expiration (Monday 11-23, a completed session).
    const before = await dumpAll(d.factory);
    const negative = await app.MarketData.save(markFor('ABC', FRIDAY_DATE, '-0.01'));
    expect(negative).toEqual({ kind: 'Rejected', issues: [{ field: 'price', code: 'PriceNegative' }] });
    app = await restart(app, { ...d, now: MONDAY_NEXT_1700 });
    const late = await app.MarketData.save(markFor(instrumentKey(XYZ_CALL), '2026-11-23', '1.00'));
    expect(late).toEqual({ kind: 'Rejected', issues: [{ field: 'tradingDate', code: 'AfterExpiration' }] });
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);
});
