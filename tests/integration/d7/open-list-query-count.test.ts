// T7.30-B3-R2 query count (AC-PERF-001, D4 T4.31, D7 T7.29, A111): an Open page with option Trades issues D4's counts,
// one getAll on trades, one getAll on observations and one byInstrumentDate request per Missing Instrument, plus one
// Historical ResolveFrames per distinct dated close date for the Underlyings' frames at that date, which reads
// observations once for all its Underlyings; nothing is issued per Trade. Counted with the real facade on
// fake-indexeddb wrapped in the disclosed request counter (D2 section 6.0).
import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { countRequests, type CountedRequest } from '../../support/request-counter.ts';
import { ABC_PUT, confirmOption, OC_PC1, OC_PC2, onboardedAt, planStock, record, recordOption, saveMark, TUESDAY_1700, type Fill } from './support.ts';

const FRIDAY_PLAN = '2026-10-09T13:00:00Z';
const ABC_FILL: Fill = { quantity: '1', price: '1.50', economicTime: '2026-10-09T14:00:00Z', fee: '0.65' };
const XYZ_CALL = { kind: 'Option', symbol: 'XYZ', root: 'XYZ', expiration: '2026-11-20', right: 'Call', strike: '55', multiplier: 100 } as const;
const on = (requests: readonly CountedRequest[], ...stores: string[]) => requests.filter((r) => stores.includes(r.store));

describe('T7.30-B3-R2 query count: the Open page with option Trades', () => {
  it('should add one observations read per distinct dated close date to D4 counts and none per Trade', { timeout: 120_000 }, async () => {
    const { app } = await onboardedAt(TUESDAY_1700);
    // Two Long Calls on XYZ bought Monday, valued at Monday's close (the call is Missing on Tuesday).
    for (let n = 0; n < 2; n++) {
      const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
      await recordOption(app, tradeId, 'Buy', OC_PC1);
      await recordOption(app, tradeId, 'Buy', OC_PC2);
    }
    // A Long Put on ABC bought the Friday before, valued at Friday's close.
    const put = (await confirmOption(app, 'O-P', FRIDAY_PLAN)).receipt.tradeId;
    await recordOption(app, put, 'Buy', ABC_FILL);
    // Stock Trades with Tuesday's Marks.
    for (const symbol of ['KLM', 'NOP']) {
      const stock = await planStock(app, symbol, '20.00', '19.00', '25.00');
      await record(app, stock, { quantity: '100', price: '20.00', economicTime: '2026-10-12T14:00:00Z' });
      await saveMark(app, symbol, '2026-10-13', '21.00');
    }
    await saveMark(app, instrumentKey(XYZ_CALL), '2026-10-12', '2.20');
    await saveMark(app, 'XYZ', '2026-10-12', '52.00');
    await saveMark(app, instrumentKey(ABC_PUT), '2026-10-09', '1.60');
    await saveMark(app, 'ABC', '2026-10-09', '51.00');

    const page = await countRequests(() => app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' }));
    if (page.result.kind !== 'Ready') throw new Error(page.result.kind);
    const items = page.result.view.items as unknown as readonly { current: { datedLine?: { tradingDate: string } } }[];
    expect(items.map((i) => i.current.datedLine?.tradingDate).filter(Boolean).sort()).toEqual(['2026-10-09', '2026-10-12', '2026-10-12']);

    const reads = on(page.requests, 'trades', 'observations');
    expect(reads.filter((r) => r.store === 'trades')).toEqual([{ on: 'index', store: 'trades', index: 'byLifecycleActivity', method: 'getAll', count: 201 }]);
    // D4's reads: one getAll on observations and one byInstrumentDate request per Missing Instrument (the call, the put and
    // their two Underlyings, all Missing at Tuesday's close); then one getAll per distinct dated close date, two here.
    const cursor = { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' };
    const getAll = { on: 'store', store: 'observations', method: 'getAll' };
    expect(on(page.requests, 'observations')).toEqual([getAll, cursor, cursor, cursor, cursor, getAll, getAll]);
  });

  it('should read observations once for two different Underlyings that need the same earlier date', { timeout: 120_000 }, async () => {
    const { app } = await onboardedAt(TUESDAY_1700);
    // A Long Call on XYZ and a Long Put on ABC, both bought Monday and valued at Monday's close.
    const call = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, call, 'Buy', OC_PC1);
    await recordOption(app, call, 'Buy', OC_PC2);
    const put = (await confirmOption(app, 'O-P')).receipt.tradeId;
    await recordOption(app, put, 'Buy', { ...ABC_FILL, economicTime: '2026-10-12T14:00:00Z' });
    await saveMark(app, instrumentKey(XYZ_CALL), '2026-10-12', '2.20');
    await saveMark(app, 'XYZ', '2026-10-12', '52.00');
    await saveMark(app, instrumentKey(ABC_PUT), '2026-10-12', '1.60');
    await saveMark(app, 'ABC', '2026-10-12', '51.00');

    const page = await countRequests(() => app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' }));
    if (page.result.kind !== 'Ready') throw new Error(page.result.kind);
    const items = page.result.view.items as unknown as readonly { current: { datedLine?: { tradingDate: string } } }[];
    expect(items.map((i) => i.current.datedLine?.tradingDate)).toEqual(['2026-10-12', '2026-10-12']);

    // D4's reads (one getAll, four byInstrumentDate requests for the call, the put and their Underlyings), then one getAll
    // for the one earlier date, which carries both Underlyings.
    const cursor = { on: 'index', store: 'observations', index: 'byInstrumentDate', method: 'openCursor' };
    const getAll = { on: 'store', store: 'observations', method: 'getAll' };
    expect(on(page.requests, 'observations')).toEqual([getAll, cursor, cursor, cursor, cursor, getAll]);
  });
});
