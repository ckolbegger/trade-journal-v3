import { describe, expect, it } from 'vitest';
import { MONDAY_1700, reviewStack } from '../../../tests/support/review-fixture.ts';

// T95.37: the card carries the Plan Exit facts the exit form states and measures a sale with (A309, P165).

// A stock Trade bought Mon 10-05 (stop 47.50, target 56.00), past its Stop from 10-06; Hold saved on 10-08 and 10-09 while it was, and an Exit
// saved for the Review Date itself, Monday 10-12.
async function heldPastTrade() {
  const stack = await reviewStack(MONDAY_1700);
  const planned = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-05T13:00:00Z' });
  await stack.fill(planned, '2026-10-05T14:00:00Z', '100', '50.00');
  const prices = { '2026-10-05': '50.00', '2026-10-06': '47.00', '2026-10-07': '47.00', '2026-10-08': '46.00', '2026-10-09': '46.50', '2026-10-12': '46.00' };
  for (const [date, price] of Object.entries(prices)) await stack.saveMark('XYZ', price, date);
  for (const date of ['2026-10-08', '2026-10-09']) await stack.saveAction(planned.tradeId, 'Hold', date);
  await stack.saveAction(planned.tradeId, 'Exit', '2026-10-12', 'The thesis is done.');
  return { stack, tradeId: planned.tradeId };
}

async function card(stack: Awaited<ReturnType<typeof reviewStack>>, tradeId: string) {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const result = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.trade;
}

describe('getTrade: the Plan Exit facts (T95.37)', () => {
  it('should carry on the Review card what the form needs to state the Plan exit, what is held, each headline condition and its status at the latest Marks, the Holds saved past a line, and the most recent Exit reason', async () => {
    const { stack, tradeId } = await heldPastTrade();

    const { planExit } = await card(stack, tradeId);

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
