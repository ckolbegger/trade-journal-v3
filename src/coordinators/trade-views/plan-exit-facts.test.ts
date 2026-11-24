import { describe, expect, it } from 'vitest';
import { countRequests } from '../../../tests/support/request-counter.ts';
import { MONDAY_1700, reviewStack } from '../../../tests/support/review-fixture.ts';
import { createTradeViews } from './index.ts';

// T95.37: Trade Detail carries the Plan Exit facts the exit form states and measures a sale with (A309, P165, decision 133).

type Stack = Awaited<ReturnType<typeof reviewStack>>;

// A stock Trade bought Mon 10-05 (stop 47.50, target 56.00), past its Stop from 10-06; each of `holds` saved a Hold while it was, and, with
// `exit`, an Exit saved for Monday 10-12 itself.
async function heldPastTrade(holds: readonly string[], exit = true) {
  const stack = await reviewStack(MONDAY_1700);
  const planned = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-05T13:00:00Z' });
  await stack.fill(planned, '2026-10-05T14:00:00Z', '100', '50.00');
  const prices = { '2026-10-05': '50.00', '2026-10-06': '47.00', '2026-10-07': '47.00', '2026-10-08': '46.00', '2026-10-09': '46.50', '2026-10-12': '46.00' };
  for (const [date, price] of Object.entries(prices)) await stack.saveMark('XYZ', price, date);
  for (const date of holds) await stack.saveAction(planned.tradeId, 'Hold', date);
  if (exit) await stack.saveAction(planned.tradeId, 'Exit', '2026-10-12', 'The thesis is done.');
  return { stack, tradeId: planned.tradeId };
}

async function detail(stack: Stack, tradeId: string) {
  const result = await createTradeViews(stack).getTradeDetail({ tradeId });
  if (result.kind !== 'Ready' || !('positionChanges' in result.view)) throw new Error('expected the Open Trade Detail');
  return result.view;
}

// The reads of each view after T95.8, for a Trade with no saved Hold, as store.index.method, in order (counted before T95.37 changed either view).
const DETAIL_READS = [
  "meta..get",
  "meta..get",
  "trades..get",
  "meta..get",
  "trades..get",
  "meta..get",
  "meta..get",
  "catalog..getAll",
  "meta..get",
  "journalEntries.byAnchorTrade.getAll",
  "journalDeclines.byAnchorTrade.getAll",
  "journalDebts.byAnchorTrade.getAll",
  "journalDefinitions..getAll",
  "journalTypes..getAll",
  "meta..get",
  "meta..get",
  "observations..getAll",
  "meta..get",
  "meta..get",
  "meta..get"
];
const CARD_READS = [
  "meta..get",
  "meta..get",
  "meta..get",
  "meta..get",
  "trades.byLifecycleActivity.getAll",
  "trades.byLifecycleTerminal.getAll",
  "meta..get",
  "meta..get",
  "observations..getAll",
  "meta..get",
  "meta..get",
  "catalog..getAll",
  "meta..get",
  "journalObligations..getAll",
  "journalEntries.byAnchorTrade.getAll",
  "journalDefinitions..getAll",
  "journalTypes..getAll",
  "meta..get",
  "meta..get",
  "observations.byInstrumentDate.getAll",
  "meta..get",
  "journalDebts.byOutstandingDue.getAll",
  "meta..get",
  "meta..get",
  "journalDefinitions..getAll",
  "meta..get",
  "meta..get",
  "meta..get"
];
const reads = (requests: readonly { store: string; index?: string; method: string }[]) => requests.map((r) => [r.store, r.index, r.method].join('.'));

describe('getTradeDetail: the Plan Exit facts (T95.37)', () => {
  it('should add no read to either beyond those they make after T95.8 for a Trade with no saved Hold, and on Trade Detail one read for a Trade with one', async () => {
    const none = await heldPastTrade([], false);
    const held = await heldPastTrade(['2026-10-08', '2026-10-09'], false);
    const opened = await none.stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);

    const card = await countRequests(() => none.stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId: none.tradeId, binding: opened.binding }));
    const withoutHold = await countRequests(() => createTradeViews(none.stack).getTradeDetail({ tradeId: none.tradeId }));
    const withHold = await countRequests(() => createTradeViews(held.stack).getTradeDetail({ tradeId: held.tradeId }));

    expect(card.result.kind).toBe('Ready');
    expect(reads(card.requests)).toEqual(CARD_READS);
    expect(reads(withoutHold.requests)).toEqual(DETAIL_READS);
    // The replay's one series read of the Instrument, with the Market Data snapshot check that follows each such read; nothing else.
    const after = DETAIL_READS.indexOf('observations..getAll') + 2;
    expect(reads(withHold.requests)).toEqual([...DETAIL_READS.slice(0, after), 'observations.byInstrumentDate.getAll', 'meta..get', ...DETAIL_READS.slice(after)]);
    expect(withHold.requests.filter((r) => r.store === 'observations')).toHaveLength(withoutHold.requests.filter((r) => r.store === 'observations').length + 1);
  }, 60_000);

  it('should give equal facts from both for one Trade', async () => {
    const { stack, tradeId } = await heldPastTrade(['2026-10-08', '2026-10-09']);
    const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
    if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
    const card = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);

    const { planExit } = await detail(stack, tradeId);

    expect(planExit).toBeDefined();
    expect(card.trade.planExit).toEqual(planExit);
  }, 60_000);

  it('should carry the same on Trade Detail', async () => {
    const { stack, tradeId } = await heldPastTrade(['2026-10-08', '2026-10-09']);

    const { planExit } = await detail(stack, tradeId);

    expect(planExit).toEqual({
      positions: [
        {
          instrument: { kind: 'Stock', symbol: 'XYZ' },
          quantity: '100.000000',
          conditions: [
            { id: 'stop-1', role: 'Stop', boundary: '47.5', status: 'Breached', pricedInTradedInstrument: true },
            { id: 'target-1', role: 'Target', boundary: '56', status: 'Active', pricedInTradedInstrument: true },
          ],
        },
      ],
      heldPast: [{ conditionId: 'stop-1', line: 'Stop', since: '2026-10-06', sessions: 2 }],
      exit: { reviewDate: '2026-10-12', reason: 'The thesis is done.' },
    });
  }, 60_000);
});
