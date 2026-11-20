// I9.10 The meter and the order: the four test Trades (R-BREN-U, R-CORV-D, R-DALE-D, R-AXIO-U) open at Fri 11-13 in one Workspace. The
// Open list (browseTrades) is in the Review's walk order, and each item's meter reading is A260's: the two rails, what is banked, the
// result now with its zone, how far past a rail and the share of the way, and the session before's result with its date. No view holds
// a rangePosition (T9.40 removed it). Real facade on fake-indexeddb; every read is on a fresh launch.
import { describe, expect, it } from 'vitest';
import { R_BREN_U, R_CORV_D, R_DALE_D } from '../../../src/domain/trade-analysis/option-trade.ts';
import { R_AXIO_U } from '../../../src/domain/trade-analysis/reference-trade.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import { seriesBook } from './support.ts';

const FRI_1113_1700 = '2026-11-13T22:00:00Z';
const dollars = (n: bigint) => Rational.of(n);
const value = (n: bigint) => ({ kind: 'Value', value: dollars(n) });

// The names of every property in a value, at any depth.
function keysOf(node: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof node === 'object' && node !== null) {
    for (const [key, child] of Object.entries(node)) {
      found.add(key);
      keysOf(child, found);
    }
  }
  return found;
}

async function fourTrades() {
  const { app, tradeIds } = await seriesBook(FRI_1113_1700, [
    [R_BREN_U, 'strategy.long-call', { marksThrough: 9 }],
    [R_CORV_D, 'strategy.long-put', { marksThrough: 9 }],
    [R_DALE_D, 'strategy.cash-secured-put', { marksThrough: 9 }],
    [R_AXIO_U, 'strategy.long-stock', { marksThrough: 9 }],
  ]);
  const [bren, corv, dale, axio] = tradeIds as [string, string, string, string];
  const list = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (list.kind !== 'Ready') throw new Error(`browseTrades: ${list.kind}`);
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: FRI_1113_1700 });
  if (opened.kind !== 'Ready') throw new Error(`DailyReview.open: ${opened.kind}`);
  const walk = opened.families.find((f) => f.family === 'Trades');
  if (!walk) throw new Error('no Trades family');
  // An item whose facts cannot be replayed carries no meter; the four Trades here all have one.
  const items = list.view.items.flatMap((i) => ('meter' in i ? [i] : []));
  if (items.length !== list.view.items.length) throw new Error('an Open item has no meter');
  return { items, walk: walk.trades, opened, list, ids: { bren, corv, dale, axio } };
}

describe('I9.10 The meter and the order', () => {
  it('I9.10 should list the Open Trades in the Review walk order, each with the A260 meter reading and no rangePosition anywhere', { timeout: 120_000 }, async () => {
    const { items, walk, opened, list, ids } = await fourTrades();

    // The same order as the Review's walk, and the same reading for each Trade.
    expect(opened.reviewDate).toBe('2026-11-13');
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.tradeId)).toEqual(walk.map((t) => t.tradeId));
    for (const item of items) expect(item.meter).toEqual(walk.find((t) => t.tradeId === item.tradeId)!.meter);

    const meterOf = (tradeId: string) => items.find((i) => i.tradeId === tradeId)!.meter;
    // R-BREN-U: past the Target by $182, with 2 sold and $478 banked; Thursday's result was $982.
    const bren = meterOf(ids.bren);
    expect(bren.stop).toEqual(value(316n));
    expect(bren.target).toEqual(value(956n));
    expect(bren.banked).toEqual(value(478n));
    expect(bren.now).toMatchObject({ kind: 'Value', value: { pnl: dollars(1138n), zone: 'PastTarget', pastBy: { dollars: dollars(182n) } } });
    expect(bren.previous).toMatchObject({ tradingDate: '2026-11-12', pnl: dollars(982n), direction: 'Up' });
    // R-CORV-D: a plain hold past the Target by $90; Thursday's result was $1,086.
    const corv = meterOf(ids.corv);
    expect(corv.stop).toEqual(value(-318n));
    expect(corv.target).toEqual(value(867n));
    expect(corv.banked).toEqual(value(0n));
    expect(corv.now).toMatchObject({ kind: 'Value', value: { pnl: dollars(957n), zone: 'PastTarget', pastBy: { dollars: dollars(90n) } } });
    expect(corv.previous).toMatchObject({ tradingDate: '2026-11-12', pnl: dollars(1086n), direction: 'Down' });
    // R-DALE-D: past the Stop by $213, with $495 banked; Thursday's result was -$1,272.
    const dale = meterOf(ids.dale);
    expect(dale.stop).toEqual(value(-1263n));
    expect(dale.target).toEqual(value(-273n));
    expect(dale.banked).toEqual(value(-495n));
    expect(dale.now).toMatchObject({ kind: 'Value', value: { pnl: dollars(-1476n), zone: 'PastStop', pastBy: { dollars: dollars(213n), crossed: true } } });
    expect(dale.previous).toMatchObject({ tradingDate: '2026-11-12', pnl: dollars(-1272n), direction: 'Down' });
    // R-AXIO-U: between the lines, 620 of the 1,060 at the Target (58 percent); Thursday's result was $680.
    const axio = meterOf(ids.axio);
    expect(axio.stop).toEqual(value(-740n));
    expect(axio.target).toEqual(value(1060n));
    expect(axio.banked).toEqual(value(0n));
    expect(axio.now).toMatchObject({ kind: 'Value', value: { pnl: dollars(620n), zone: 'Between', share: { fraction: Rational.of(620n, 1060n), percent: dollars(58n), toward: 'Target' } } });
    expect(axio.previous).toMatchObject({ tradingDate: '2026-11-12', pnl: dollars(680n), direction: 'Down' });

    // The Open list's order (A262) puts the two Trades past a rail ahead of the Trade between the lines.
    expect(items.at(-1)!.tradeId).toBe(ids.axio);

    // T9.40: no view holds a rangePosition.
    expect(keysOf(list.view).has('rangePosition')).toBe(false);
    expect(keysOf(opened).has('rangePosition')).toBe(false);
    expect(keysOf(items).has('meter')).toBe(true);
  });
});
