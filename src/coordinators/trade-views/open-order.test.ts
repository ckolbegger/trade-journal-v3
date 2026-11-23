import { describe, expect, it } from 'vitest';
import { closedTradeReviewFixture } from '../../../tests/support/closed-trade-review-fixture.ts';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { seriesStack } from '../../../tests/support/replay-series-stack.ts';
import { breakFirstExecution, ELEVEN_AM, fiveTradeFixture, MONDAY_1700, TEN_AM, reviewStack } from '../../../tests/support/review-fixture.ts';
import { R_BREN_U } from '../../domain/trade-analysis/option-trade.ts';
import { Rational } from '../../domain/values/index.ts';
import { createTradeViews } from './index.ts';

// T9.32: the Open list's default order, with each item's attention and meter reading (A262, P131, P133).

const MON_1116_1700 = '2026-11-16T22:00:00Z';

async function openIds(views: ReturnType<typeof createTradeViews>) {
  const result = await views.browseTrades({ lifecycle: 'Open' });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.view.items;
}

describe("browseTrades: the Open list follows the Review's order (T95.22, A301)", () => {
  it('should order the Open list past the Stop deepest in R first, then at the Target, by the Review comparator', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const views = createTradeViews(stack);
    // At the Target, the most recently active.
    const target = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(target, ELEVEN_AM, '100', '50.00');
    // 1R is $200.00 and the Stop is passed by $300.00, 1.5R.
    const shallow = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(shallow, TEN_AM, '100', '30.00');
    // 1R is $100.00 and the Stop is passed by $200.00, 2R: less in dollars, more in R.
    const deep = await stack.confirm({ symbol: 'DEF', shares: '100', entry: '50.00', stop: '49.00', target: '56.00' });
    await stack.fill(deep, TEN_AM, '100', '50.00');
    await stack.saveMark('XYZ', '56.50');
    await stack.saveMark('ABC', '25.00');
    await stack.saveMark('DEF', '47.00');

    const items = await openIds(views);

    expect(items.map((i) => i.tradeId)).toEqual([deep.tradeId, shallow.tradeId, target.tradeId]);
    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);
    expect(items.map((i) => i.tradeId)).toEqual(review.families.find((f) => f.family === 'Trades')!.trades.map((t) => t.tradeId));
  }, 60_000);

  it('should place first a Trade whose most recent Action is an Exit not carried out', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const views = createTradeViews(stack);
    const past = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00', planTime: '2026-10-08T13:00:00Z' });
    await stack.fill(past, '2026-10-08T14:00:00Z', '100', '30.00');
    const leaving = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-08T13:00:00Z' });
    await stack.fill(leaving, '2026-10-08T14:00:00Z', '100', '50.00');
    await stack.saveMark('ABC', '27.50');
    await stack.saveMark('XYZ', '52.00');
    await stack.saveAction(leaving.tradeId, 'Exit', '2026-10-09');

    const items = await openIds(views);

    expect(items.map((i) => [i.tradeId, i.attention.band])).toEqual([
      [leaving.tradeId, 'ExitNotCarriedOut'],
      [past.tradeId, 'StopReached'],
    ]);
  }, 60_000);

  it('should make exactly one Journal read for that, the same for two Trades and for four', async () => {
    const readsFor = async (symbols: readonly string[]) => {
      const stack = await reviewStack(MONDAY_1700);
      for (const symbol of symbols) {
        const planned = await stack.confirm({ symbol, shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-08T13:00:00Z' });
        await stack.fill(planned, '2026-10-08T14:00:00Z', '100', '50.00');
        await stack.saveMark(symbol, '52.00');
      }
      const { result, requests } = await countRequests(() => createTradeViews(stack).browseTrades({ lifecycle: 'Open' }));
      if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
      return requests.filter((r) => r.store === 'journalEntries');
    };

    const two = await readsFor(['AAA', 'BBB']);
    const four = await readsFor(['AAA', 'BBB', 'CCC', 'DDD']);

    expect(two).toEqual([{ on: 'index', store: 'journalEntries', index: 'byObligation', method: 'getAll' }]);
    expect(four).toEqual(two);
  }, 60_000);

  it('should make the same one Journal read when Actions are saved on the Review Date, none per Action', async () => {
    const readsFor = async (symbols: readonly string[]) => {
      const stack = await reviewStack(MONDAY_1700);
      for (const symbol of symbols) {
        const planned = await stack.confirm({ symbol, shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-08T13:00:00Z' });
        await stack.fill(planned, '2026-10-08T14:00:00Z', '100', '50.00');
        await stack.saveMark(symbol, '52.00');
        await stack.saveAction(planned.tradeId);
      }
      const { result, requests } = await countRequests(() => createTradeViews(stack).browseTrades({ lifecycle: 'Open' }));
      if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
      return requests.filter((r) => r.store === 'journalEntries');
    };

    const two = await readsFor(['AAA', 'BBB']);
    const four = await readsFor(['AAA', 'BBB', 'CCC', 'DDD']);

    expect(two).toEqual([{ on: 'index', store: 'journalEntries', index: 'byObligation', method: 'getAll' }]);
    expect(four).toEqual(two);
  }, 60_000);
});

describe("browseTrades: the Open list's default order (A262)", () => {
  it('should list a Trade past its Stop before one that is not, whatever their Last Activity', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const views = createTradeViews(stack);
    // The Trade past its Stop was last active before the one that is not.
    const past = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(past, TEN_AM, '100', '30.00');
    const inside = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(inside, ELEVEN_AM, '100', '50.00');
    await stack.saveMark('ABC', '27.50');
    await stack.saveMark('XYZ', '52.00');

    const items = await openIds(views);

    expect(items.map((i) => i.tradeId)).toEqual([past.tradeId, inside.tradeId]);
  }, 60_000);

  it('should order Trades in the same band by the share of their range used, a losing side before a winning one, then Last Activity', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const views = createTradeViews(stack);
    // Entry 50, Stop 40, Target 60, 100 shares: a Mark of 47 or 53 uses 30% of the range, 45 uses 50%.
    const open = async (symbol: string, mark: string, fillTime: string) => {
      const trade = await stack.confirm({ symbol, shares: '100', entry: '50.00', stop: '40.00', target: '60.00' });
      await stack.fill(trade, fillTime, '100', '50.00');
      await stack.saveMark(symbol, mark);
      return trade.tradeId;
    };
    const losing30 = await open('AAA', '47.00', TEN_AM);
    const winning30 = await open('BBB', '53.00', ELEVEN_AM);
    const losing50 = await open('CCC', '45.00', TEN_AM);
    const losing30Newer = await open('DDD', '47.00', ELEVEN_AM);

    const items = await openIds(views);

    expect(items.map((i) => i.tradeId)).toEqual([losing50, losing30Newer, losing30, winning30]);
  }, 60_000);

  it('should list a Trade whose facts cannot be replayed first, with the blockers', async () => {
    const stack = await reviewStack(MONDAY_1700);
    const views = createTradeViews(stack);
    const past = await stack.confirm({ symbol: 'ABC', shares: '100', entry: '30.00', stop: '28.00', target: '36.00' });
    await stack.fill(past, ELEVEN_AM, '100', '30.00');
    const broken = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    await stack.fill(broken, TEN_AM, '100', '50.00');
    await stack.saveMark('ABC', '27.50');
    await breakFirstExecution(stack, broken.tradeId);

    const items = await openIds(views);

    expect(items.map((i) => i.tradeId)).toEqual([broken.tradeId, past.tradeId]);
    expect(items[0]).toMatchObject({ integrity: 'Disagrees', attention: { band: 'Blocker', reasons: [{ code: 'Unavailable', reason: 'FactsIncoherent', findings: expect.any(Array) as unknown }] } });
    expect(items[0]).not.toHaveProperty('meter');
  }, 60_000);

  it("should give the same order as the Review walk for the same Trades when the Review Date is the Expected Mark Date", async () => {
    const stack = await reviewStack(MONDAY_1700);
    await fiveTradeFixture(stack);
    const items = await openIds(createTradeViews(stack));

    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);
    const walk = review.families.find((f) => f.family === 'Trades')!.trades;

    expect(items.length).toBeGreaterThan(1);
    expect(items.map((i) => i.tradeId)).toEqual(walk.map((t) => t.tradeId));
  }, 60_000);

  it("should carry each item band, reasons and meter reading", async () => {
    const { stack, views, tradeId } = await seriesStack(R_BREN_U, 'strategy.long-call', MON_1116_1700, { marksThrough: 10 });

    const item = (await openIds(views)).find((i) => i.tradeId === tradeId)!;
    if (!('meter' in item)) throw new Error('expected a replayed Open item');

    // The Target is passed by $32.00 on Mon 11-16; the reading is the Review's own.
    expect(item.attention).toMatchObject({ band: 'TargetReached', reasons: [{ code: 'TargetReached', overrun: Rational.of(32n) }] });
    expect(item).toHaveProperty('lastActivity');
    expect(item).toHaveProperty('current');
    expect(item.meter).toMatchObject({ stop: { kind: 'Value', value: Rational.of(316n) }, now: { kind: 'Value', value: { pnl: Rational.of(988n), zone: 'PastTarget' } }, previous: { tradingDate: '2026-11-13', pnl: Rational.of(1138n), direction: 'Down' } });
    const review = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MON_1116_1700 });
    if (review.kind !== 'Ready') throw new Error(`expected Ready, got ${review.kind}`);
    expect(item.meter).toEqual(review.families.find((f) => f.family === 'Trades')!.trades.find((t) => t.tradeId === tradeId)!.meter);
  }, 60_000);

  it('should leave the Planned and Closed lists in their orders', async () => {
    const planned = await reviewStack(MONDAY_1700);
    for (const symbol of ['AAA', 'BBB', 'CCC']) await planned.confirm({ symbol, shares: '100', entry: '50.00', stop: '47.50', target: '56.00' });
    const book = async (stack: typeof planned, lifecycle: 'Planned' | 'Closed') => {
      const page = await stack.tradeRecord.queryRecords({ lifecycle, projection: 'Browse' });
      if (page.kind === 'CursorExpired') throw new Error('cursor expired');
      return page.items.map((r) => (r as { summary: { tradeId: string } }).summary.tradeId);
    };
    const plannedList = await createTradeViews(planned).browseTrades({ lifecycle: 'Planned' });
    if (plannedList.kind !== 'Ready') throw new Error(`expected Ready, got ${plannedList.kind}`);
    expect(plannedList.view.items.map((i) => i.tradeId)).toEqual(await book(planned, 'Planned'));
    expect(plannedList.view.items).toHaveLength(3);

    const { stack, trades } = await closedTradeReviewFixture();
    const closedList = await createTradeViews(stack).browseTrades({ lifecycle: 'Closed' });
    if (closedList.kind !== 'Ready') throw new Error(`expected Ready, got ${closedList.kind}`);
    expect(closedList.view.items.map((i) => i.tradeId)).toEqual([trades.N, trades.L, trades.K, trades.M, trades.P]);
    for (const item of [...plannedList.view.items, ...closedList.view.items]) {
      expect(item).not.toHaveProperty('attention');
      expect(item).not.toHaveProperty('meter');
    }
  }, 60_000);

  it("should read one more date of Marks for the page and none per Trade", async () => {
    const stack = await reviewStack(MONDAY_1700);
    for (const [symbol, friday, monday] of [['XYZ', '51.00', '52.00'], ['ABC', '29.00', '27.50'], ['GHI', '61.00', '62.00']] as const) {
      const trade = await stack.confirm({ symbol, shares: '100', entry: '50.00', stop: '25.00', target: '70.00', planTime: '2026-10-09T13:00:00Z' });
      await stack.fill(trade, '2026-10-09T14:00:00Z', '100', '50.00');
      await stack.saveMark(symbol, friday, '2026-10-09');
      await stack.saveMark(symbol, monday);
    }
    const views = createTradeViews(stack);

    const { result, requests } = await countRequests(() => views.browseTrades({ lifecycle: 'Open' }));

    if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
    expect(result.view.items.map((i) => (i as { meter?: { previous?: { tradingDate: string } } }).meter?.previous?.tradingDate)).toEqual(['2026-10-09', '2026-10-09', '2026-10-09']);
    // Monday's date-wide read and Friday's, whatever the number of Trades; no earlier-Mark lookup.
    expect(requests.filter((r) => r.store === 'observations' && r.on === 'store' && r.method === 'getAll')).toHaveLength(2);
    expect(requests.filter((r) => r.store === 'observations' && r.method === 'openCursor')).toHaveLength(0);
  }, 60_000);
});
