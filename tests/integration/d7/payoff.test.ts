// I7.10: the Expiration Payoff is not a valuation (AC-CALC-004): through the facade, O-C's Planned view stays the
// same at every step, its Current view follows the facts and never a Mark, the value at the underlying's Mark comes
// from XYZ's Mark only, and no theoretical option value appears in the view.
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import {
  closeReviewDisposition, confirmOption, dec, detail, detailOf, FRIDAY_1600, FRIDAY_1700, OC_PC1, OC_PC2, OC_X1, onboardedAt, recordExpiration, recordOption, referenceTrade, restart, saveMark, TUESDAY_1700,
  TUESDAY_DATE, value, XYZ_CALL, type Fill,
} from './support.ts';

const r = (n: bigint) => Rational.of(n);
const CALL = instrumentKey(XYZ_CALL);
// X1′ sells at 4.0195, realizing 191.95 - 1.30 = 190.65, which exactly offsets the remaining Lot.
const X1_PRIME: Fill = { ...OC_X1, price: '4.0195' };

// The Current view of a Detail's payoff, required to be a Value.
function currentOf(view: Awaited<ReturnType<typeof detailOf>>) {
  if (!('payoff' in view) || view.payoff.current.kind !== 'Value') throw new Error('the Detail has no Current payoff view');
  return view.payoff.current.value;
}

describe('I7.10 Payoff is not valuation', () => {
  it('should keep O-C Planned the same at every step, give Current its figures after PC2, X1 and E1, move the value at XYZ only with XYZ Mark, and keep the Mark-to-Market apart from both views', async () => {
    const { d, app: first } = await onboardedAt(TUESDAY_1700);
    let app = first;
    const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, tradeId, 'Buy', OC_PC1);
    await recordOption(app, tradeId, 'Buy', OC_PC2);
    const call = await saveMark(app, CALL, TUESDAY_DATE, '2.40');
    const stock = await saveMark(app, 'XYZ', TUESDAY_DATE, '52.00');

    // After PC2 with the call at 2.40 and XYZ at 52.00.
    const afterPc2 = await detail(app, tradeId);
    const planned = afterPc2.payoff.planned;
    if (planned.kind !== 'Value') throw new Error('expected the Planned view');
    expect(planned.value.segments).toEqual([
      { from: r(0n), to: r(55n), valueAtStart: r(-400n), slope: r(0n) },
      { from: r(55n), to: null, valueAtStart: r(-400n), slope: r(200n) },
    ]);
    expect(planned.value.zeroSet).toEqual([{ kind: 'Crossing', price: r(57n) }]);
    const current = currentOf(afterPc2);
    expect(current.zeroSet).toEqual([{ kind: 'Crossing', price: dec('57.0065') }]);
    expect(current.minimum).toEqual({ kind: 'Value', value: { value: dec('-401.30'), attainedOn: [{ kind: 'Interval', from: r(0n), to: r(55n) }] } });
    if (afterPc2.current.evaluation.kind !== 'Evaluated') throw new Error('expected an evaluation');
    // "If XYZ is at 52.00 at expiration" reads -401.30; the Mark-to-Market is the call's alone.
    expect(afterPc2.current.evaluation.expirationValueAtUnderlyingClose).toEqual({ kind: 'Value', value: { underlyingPrice: dec('52'), value: dec('-401.30') } });
    expect(afterPc2.current.evaluation.marketValue).toEqual(value('480'));
    expect(afterPc2.current.evaluation.remainingOpenPnl).toEqual(value('78.70'));

    // The call's Mark corrected to 3.10 moves the Mark-to-Market and nothing in either payoff view or the value at XYZ.
    const corrected = await app.MarketData.save({ intention: 'CorrectMark', instrumentKey: CALL, tradingDate: TUESDAY_DATE, price: '3.10', reason: 'Typo.', expectedResolutionRevision: call.resolutionRevision });
    if (corrected.kind !== 'Saved') throw new Error(`CorrectMark: ${JSON.stringify(corrected)}`);
    const callMoved = await detail(app, tradeId);
    expect(callMoved.payoff).toEqual(afterPc2.payoff);
    if (callMoved.current.evaluation.kind !== 'Evaluated') throw new Error('expected an evaluation');
    expect(callMoved.current.evaluation.marketValue).toEqual(value('620'));
    expect(callMoved.current.evaluation.remainingOpenPnl).toEqual(value('218.70'));
    expect(callMoved.current.evaluation.expirationValueAtUnderlyingClose).toEqual(afterPc2.current.evaluation.expirationValueAtUnderlyingClose);

    // XYZ's Mark corrected to 58.00 moves the value at expiration to 198.70, and neither payoff curve.
    const stockMoved = await app.MarketData.save({ intention: 'CorrectMark', instrumentKey: 'XYZ', tradingDate: TUESDAY_DATE, price: '58.00', reason: 'Typo.', expectedResolutionRevision: stock.resolutionRevision });
    if (stockMoved.kind !== 'Saved') throw new Error(`CorrectMark: ${JSON.stringify(stockMoved)}`);
    const xyzMoved = await detail(app, tradeId);
    expect(xyzMoved.payoff).toEqual(afterPc2.payoff);
    if (xyzMoved.current.evaluation.kind !== 'Evaluated') throw new Error('expected an evaluation');
    expect(xyzMoved.current.evaluation.expirationValueAtUnderlyingClose).toEqual({ kind: 'Value', value: { underlyingPrice: dec('58'), value: dec('198.70') } });
    expect(xyzMoved.current.evaluation.marketValue).toEqual(value('620'));

    // No theoretical option value anywhere in the view: nothing but the facts and the Planned Leg's terms feeds it.
    const text = JSON.stringify(xyzMoved.payoff, (_k, v: unknown) => (typeof v === 'bigint' ? String(v) : v));
    expect(text).not.toMatch(/theoretical|blackScholes|impliedVol|delta|greeks/i);

    // After X1: the Planned view is unchanged and Current takes the realized 88.70 as its offset.
    await recordOption(app, tradeId, 'Sell', OC_X1);
    const afterX1 = await detail(app, tradeId);
    expect(afterX1.payoff.planned).toEqual(planned);
    const second = currentOf(afterX1);
    expect(second.realizedOffset).toEqual(dec('88.70'));
    expect(second.zeroSet).toEqual([{ kind: 'Crossing', price: dec('56.0195') }]);
    expect(second.minimum).toEqual({ kind: 'Value', value: { value: dec('-101.95'), attainedOn: [{ kind: 'Interval', from: r(0n), to: r(55n) }] } });

    // After E1: Current is NotApplicable and Planned is still the same.
    app = await restart(app, { ...d, now: FRIDAY_1700 });
    await recordExpiration(app, tradeId, '1', FRIDAY_1600, { closeReview: await closeReviewDisposition(app, 'Complete') });
    const closed = await detailOf(app, tradeId);
    if (!('payoff' in closed)) throw new Error('expected a Detail with payoff views');
    expect(closed.payoff.current).toEqual({ kind: 'NotApplicable', reason: 'NoRemainingPosition' });
    expect(closed.payoff.planned).toEqual(planned);
  }, 60_000);

  it('should give Current a Zero Range of 0 to 55 for X1 prime, and NotApplicable for both views of T-A', async () => {
    const { app } = await onboardedAt(TUESDAY_1700);
    const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, tradeId, 'Buy', OC_PC1);
    await recordOption(app, tradeId, 'Buy', OC_PC2);
    await recordOption(app, tradeId, 'Sell', X1_PRIME);
    const current = currentOf(await detailOf(app, tradeId));
    expect(current.zeroSet).toEqual([{ kind: 'ZeroRange', from: r(0n), to: r(55n) }]);
    expect(current.minimum).toEqual({ kind: 'Value', value: { value: r(0n), attainedOn: [{ kind: 'Interval', from: r(0n), to: r(55n) }] } });

    // T-A, D6's Long Stock reference Trade, has no option expiration to anchor either view.
    const stock = await referenceTrade(TUESDAY_1700);
    const view = await detailOf(stock.app, stock.tradeId);
    if (!('payoff' in view)) throw new Error('expected a Detail with payoff views');
    expect(view.payoff).toEqual({
      planned: { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' },
      current: { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' },
    });
  }, 60_000);
});
