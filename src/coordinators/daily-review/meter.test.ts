import { describe, expect, it } from 'vitest';
import { cardFixture, FRIDAY_DATE, MONDAY_1700, REVIEW_DATE, reviewStack } from '../../../tests/support/review-fixture.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { seriesStack } from '../../../tests/support/replay-series-stack.ts';
import { R_BREN_U } from '../../domain/trade-analysis/option-trade.ts';
import { R_AXIO_D } from '../../domain/trade-analysis/reference-trade.ts';
import { Rational } from '../../domain/values/index.ts';
import type { MarketDataPrepareEntry } from '../../modules/market-data/index.ts';
import type { OpenDailyReviewResult } from './index.ts';

// T9.31: DailyReview.open and save give each walked Trade its meter reading (A260, P133).

const MON_1116_1700 = '2026-11-16T22:00:00Z';
const dollars = (n: bigint) => Rational.of(n);

function walk(result: OpenDailyReviewResult) {
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  const family = result.families.find((f) => f.family === 'Trades');
  if (!family) throw new Error('no Trades family');
  return family.trades;
}

describe('open: the meter reading (A260)', () => {
  it('should give each walked Trade its meter reading at the Review Date, with the session before as the earlier result', async () => {
    const { stack, tradeId } = await seriesStack(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });

    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });

    const meter = walk(opened).find((t) => t.tradeId === tradeId)!.meter!;
    expect(meter.stop).toEqual({ kind: 'Value', value: dollars(316n) });
    expect(meter.target).toEqual({ kind: 'Value', value: dollars(956n) });
    expect(meter.banked).toEqual({ kind: 'Value', value: dollars(478n) });
    expect(meter.now).toMatchObject({ kind: 'Value', value: { pnl: dollars(988n), zone: 'PastTarget' } });
    expect(meter.previous).toMatchObject({ tradingDate: '2026-11-13', pnl: dollars(1138n), direction: 'Down' });
  }, 60_000);

  it('should read one more date\'s Marks for the whole Review and none per Trade', async () => {
    const stack = await reviewStack(MONDAY_1700);
    // Three Trades held at Friday's close, each on its own Instrument, with a Mark on both sessions.
    for (const [symbol, friday, monday] of [['XYZ', '51.00', '52.00'], ['ABC', '29.00', '27.50'], ['GHI', '61.00', '62.00']] as const) {
      const trade = await stack.confirm({ symbol, shares: '100', entry: '50.00', stop: '25.00', target: '70.00', planTime: '2026-10-09T13:00:00Z' });
      await stack.fill(trade, '2026-10-09T14:00:00Z', '100', '50.00');
      await stack.saveMark(symbol, friday, FRIDAY_DATE);
      await stack.saveMark(symbol, monday);
    }

    const { result, requests } = await countRequests(() => stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 }));

    expect(walk(result).map((t) => t.meter?.previous?.tradingDate)).toEqual([FRIDAY_DATE, FRIDAY_DATE, FRIDAY_DATE]);
    const dateWide = requests.filter((r) => r.store === 'observations' && r.on === 'store' && r.method === 'getAll');
    // Monday's date-wide read and Friday's, whatever the number of Trades.
    expect(dateWide).toHaveLength(2);
  }, 60_000);

  it('should value the session before from that date\'s Marks alone, with no earlier-Mark lookup for an Instrument missing on that date', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const trade = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '25.00', target: '70.00', planTime: '2026-10-09T13:00:00Z' });
    await stack.fill(trade, '2026-10-09T14:00:00Z', '100', '50.00');
    // Monday has a Mark; Friday, the session before, has none.
    await stack.saveMark('XYZ', '52.00');

    const { result, requests } = await countRequests(() => stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 }));

    expect(walk(result)[0]!.meter!.previous).toBeUndefined();
    expect(requests.filter((r) => r.store === 'observations' && r.method === 'openCursor')).toHaveLength(0);
  }, 60_000);
});

describe('save: the meter reading after Save Marks (A260)', () => {
  it('should refresh the reading of every card that shares a saved Mark\'s Instrument, in the Save Marks result', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const { a, f } = await cardFixture(stack, { withoutMarks: true });
    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
    const meterOf = (trades: ReturnType<typeof walk>, tradeId: string) => trades.find((t) => t.tradeId === tradeId)!.meter!;
    // T-A and T-F share XYZ, which has no Mark yet.
    expect(meterOf(walk(opened), f).now).toMatchObject({ kind: 'Unavailable', reason: 'MarkMissing' });
    const entry = (tradingDate: string, price: string): MarketDataPrepareEntry => ({ key: { instrumentKey: 'XYZ', tradingDate }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price } });

    const saved = await stack.dailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, binding: opened.binding, entries: [entry(REVIEW_DATE, '52.00'), entry(FRIDAY_DATE, '51.00')] });

    if (saved.kind !== 'MarksSaved' || saved.review.kind !== 'Ready') throw new Error(`expected a Ready review, got ${saved.kind}`);
    const { trades } = saved.review;
    expect(meterOf(trades, a).now.kind).toBe('Value');
    expect(meterOf(trades, a).previous?.tradingDate).toBe(FRIDAY_DATE);
    expect(meterOf(trades, f).now).toMatchObject({ kind: 'Value', value: { pnl: Rational.of(99n) } });
    // The same readings a fresh open gives, without the caller reading again.
    const reopened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    expect(trades.map((t) => t.meter)).toEqual(walk(reopened).map((t) => t.meter));
  }, 60_000);
});

// T95.26-B3: the label's percent is the Pressure share of the open Lots, not the meter's P&L share, which includes realized P&L.
const TUE_1117_1700 = '2026-11-17T22:00:00Z';

describe('open: a Trade with a partial sale (T95.26-B3)', () => {
  it('should give a partly sold Trade the pressure share of its open Lots, apart from the meter share that counts the realized P&L', async () => {
    // R-AXIO-D: 200 shares at $50.00 with 100 sold at $45.60; the Stop is $47.00. Marked $48.00 on Tue 11-17.
    const { stack, tradeId } = await seriesStack({ ...R_AXIO_D, held: R_AXIO_D.held.map(() => null) }, 'strategy.long-stock', TUE_1117_1700, { marksThrough: 10, extraMarks: [{ instrument: { kind: 'Stock', symbol: 'AXIO' }, date: '2026-11-17', price: '48.00' }] });

    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: TUE_1117_1700 });

    const item = walk(opened).find((t) => t.tradeId === tradeId)!;
    // Risk consumed since entry over risk at entry, on the 100 open shares: (300 - 100) / 300.
    expect(item.basis).toEqual({ kind: 'Value', value: { side: 'Losing', share: Rational.of(2n, 3n), atEntry: dollars(300n), now: dollars(100n) } });
    expect(item.meter!.now).toMatchObject({ kind: 'Value', value: { zone: 'Between' } });
    const now = item.meter!.now;
    expect(now.kind === 'Value' && now.value.share?.percent).not.toEqual(Rational.of(67n));
  }, 60_000);
});
