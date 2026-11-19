// I9AR.1 The Plan beside what happened, end to end (AC-CALC-003): R-AXIO-U, R-AXIO-D, R-BREN-U, R-CORV-D and R-DALE-D entered through the
// facade, read with replayTrade, then again after a restart. The Plan's terms as confirmed, each fill's line, side and distance (A270),
// and the first crossings (A271).
import { describe, expect, it } from 'vitest';
import { BREN_CALL, DALE_PUT, R_BREN_U, R_CORV_D, R_DALE_D } from '../../../src/domain/trade-analysis/option-trade.ts';
import { AXIO, R_AXIO_D, R_AXIO_U } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { restart } from '../d7s/support.ts';
import { crossingsOf, dollars as q, fillsOf, frac, MON_1116_1700, price, readyReplay, seriesApp, sessionOf, WED_1111_1700 } from './support.ts';

describe('I9AR.1 The Plan beside what happened, end to end', () => {
  it('I9AR.1 should give the Plan terms as confirmed, each fill against the Plan and the first crossings, equal after a restart', { timeout: 300_000 }, async () => {
    const bren = await seriesApp(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });
    const dale = await seriesApp(R_DALE_D, 'strategy.cash-secured-put', WED_1111_1700, { marksThrough: 7 });
    const axioD = await seriesApp(R_AXIO_D, 'strategy.long-stock', MON_1116_1700, { marksThrough: 10 });
    const axioU = await seriesApp(R_AXIO_U, 'strategy.long-stock', MON_1116_1700, { marksThrough: 10 });
    const corv = await seriesApp(R_CORV_D, 'strategy.long-put', WED_1111_1700, { marksThrough: 7 });

    const first = {
      bren: await readyReplay(bren.app, bren.tradeId),
      dale: await readyReplay(dale.app, dale.tradeId),
      axioD: await readyReplay(axioD.app, axioD.tradeId),
      axioU: await readyReplay(axioU.app, axioU.tradeId),
      corv: await readyReplay(corv.app, corv.tradeId),
    };

    // The Plan's terms as confirmed.
    const legs = (view: typeof first.bren) => view.planColumn?.terms?.legs.map((l) => ({ instrument: l.instrument, side: l.side, quantity: frac(l.quantity), entry: price(l.entryPrice) }));
    const conditions = (view: typeof first.bren) => view.planColumn?.terms?.conditions.map((c) => ({ role: c.role, priceOf: c.priceOf, price: price(c.price), pnlIfHit: frac(c.pnlIfHit) }));
    expect(legs(first.bren)).toEqual([{ instrument: BREN_CALL, side: 'Long', quantity: q(4n), entry: '1.61' }]);
    expect(conditions(first.bren)).toEqual([
      { role: 'Stop', priceOf: 'Option', price: '0.80', pnlIfHit: q(-324n) },
      { role: 'Target', priceOf: 'Option', price: '4.00', pnlIfHit: q(956n) },
    ]);
    expect(legs(first.dale)).toEqual([{ instrument: DALE_PUT, side: 'Short', quantity: q(6n), entry: '0.94' }]);
    expect(conditions(first.dale)?.map((c) => `${c.role} ${c.priceOf} ${c.price}`)).toEqual(['Stop Underlying 54.00', 'Target Option 0.20']);
    expect(legs(first.axioD)).toEqual([{ instrument: AXIO, side: 'Long', quantity: q(200n), entry: '50.00' }]);

    // Each fill's line, side and distance (A270's examples).
    expect(fillsOf(sessionOf(first.bren, '2026-11-02'))).toEqual([{ action: 'Buy', quantity: q(4n), price: '1.61', against: { line: 'Entry', side: 'At', distance: '0.00' } }]);
    expect(fillsOf(sessionOf(first.bren, '2026-11-12'))).toEqual([{ action: 'Sell', quantity: q(2n), price: '4.00', against: { line: 'Target', side: 'At', distance: '0.00' } }]);
    expect(fillsOf(sessionOf(first.axioU, '2026-11-06'))).toEqual([{ action: 'Buy', quantity: q(100n), price: '51.40', against: { line: 'Entry', side: 'Above', distance: '1.40' } }]);
    expect(fillsOf(sessionOf(first.axioD, '2026-11-09'))).toEqual([{ action: 'Sell', quantity: q(100n), price: '45.60', against: { line: 'Stop', side: 'Below', distance: '1.40' } }]);
    // A buyback is measured on the option's own price: the Stop is a price of the Underlying and is passed over.
    expect(fillsOf(sessionOf(first.dale, '2026-11-10'))).toEqual([{ action: 'Buy', quantity: q(3n), price: '2.59', against: { line: 'Target', side: 'Above', distance: '2.39' } }]);

    // The first crossings (A271).
    expect(crossingsOf(sessionOf(first.corv, '2026-11-06'), 'target')).toEqual({ first: { date: '2026-11-06', afterGap: false }, since: { date: '2026-11-06', afterGap: false } });
    expect(crossingsOf(sessionOf(first.corv, '2026-11-09'), 'target')).toEqual({ first: { date: '2026-11-06', afterGap: false }, since: null });
    // Tue 11-10 has no put Mark; Wed 11-11 starts a new run, first seen after that gap.
    expect(crossingsOf(sessionOf(first.corv, '2026-11-11'), 'target')).toEqual({ first: { date: '2026-11-06', afterGap: false }, since: { date: '2026-11-11', afterGap: true } });
    expect(crossingsOf(sessionOf(first.axioD, '2026-11-05'), 'stop')).toEqual({ first: null, since: null });
    expect(crossingsOf(sessionOf(first.axioD, '2026-11-09'), 'stop')).toEqual({ first: { date: '2026-11-09', afterGap: false }, since: { date: '2026-11-09', afterGap: false } });
    expect(crossingsOf(sessionOf(first.axioD, '2026-11-16'), 'stop')).toEqual({ first: { date: '2026-11-09', afterGap: false }, since: { date: '2026-11-09', afterGap: false } });

    // Equal after a restart.
    const again = {
      bren: await readyReplay(await restart(bren.app, bren.d), bren.tradeId),
      dale: await readyReplay(await restart(dale.app, dale.d), dale.tradeId),
      axioD: await readyReplay(await restart(axioD.app, axioD.d), axioD.tradeId),
      axioU: await readyReplay(await restart(axioU.app, axioU.d), axioU.tradeId),
      corv: await readyReplay(await restart(corv.app, corv.d), corv.tradeId),
    };
    expect(again).toEqual(first);
  });
});
