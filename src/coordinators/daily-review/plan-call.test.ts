import { describe, expect, it } from 'vitest';
import { MONDAY_1700, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';

// T95.31: the Plan Call on the card and the page, and the new Action's view state (A306, A307, W120).

// A stock Trade bought Mon 10-05 (stop 47.50, target 56.00), reviewed on Monday 10-12.
async function heldTrade() {
  const stack = await reviewStack(MONDAY_1700);
  const planned = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-05T13:00:00Z' });
  await stack.fill(planned, '2026-10-05T14:00:00Z', '100', '50.00');
  return { stack, tradeId: planned.tradeId };
}

async function open(stack: ReviewStack) {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  return opened;
}

async function card(stack: ReviewStack, tradeId: string) {
  const opened = await open(stack);
  const result = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (result.kind !== 'Ready') throw new Error(`expected Ready, got ${result.kind}`);
  return result.trade;
}

function walked(opened: Awaited<ReturnType<typeof open>>, tradeId: string) {
  const family = opened.families.find((f) => f.family === 'Trades');
  if (!family) throw new Error('no Trades family');
  return family.trades.find((t) => t.tradeId === tradeId)!;
}

describe('getTrade: the Plan Call and the new Action view state (A306, A307)', () => {
  it('should carry the Plan Call and its condition on the card and on each page item', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.saveMark('XYZ', '47.00');

    const trade = await card(stack, tradeId);
    const item = walked(await open(stack), tradeId);

    expect(trade.planCall).toMatchObject({ call: 'Out', condition: { id: 'stop-1', role: 'Stop' } });
    expect(item.planCall).toEqual(trade.planCall);
  }, 60_000);

  it('should return Hold selected for a new Action when the call is Hold', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.saveMark('XYZ', '51.00');

    const trade = await card(stack, tradeId);

    expect(trade.planCall).toEqual({ call: 'Hold' });
    expect(trade.form).toEqual({ kind: 'New', viewState: { selectedAction: 'Hold' } });
  }, 60_000);

  it('should return nothing selected when the call is Out', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.saveMark('XYZ', '57.00');

    const trade = await card(stack, tradeId);

    expect(trade.planCall?.call).toBe('Out');
    expect(trade.form).toEqual({ kind: 'New', viewState: {} });
  }, 60_000);

  it('should return nothing selected when the call is Unknown', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.acknowledge('XYZ');

    const trade = await card(stack, tradeId);

    expect(trade.planCall?.call).toBe('Unknown');
    expect(trade.form).toEqual({ kind: 'New', viewState: {} });
  }, 60_000);

  it('should return a saved Action as saved, whatever the call', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.saveMark('XYZ', '47.00');
    await stack.saveAction(tradeId, 'Exit');

    const trade = await card(stack, tradeId);

    expect(trade.planCall?.call).toBe('Out');
    expect(trade.form).toMatchObject({ kind: 'Saved', action: { action: 'Exit' } });
  }, 60_000);

  it('should record nothing when the card is opened', async () => {
    const { stack, tradeId } = await heldTrade();
    await stack.saveMark('XYZ', '51.00');
    const opened = await open(stack);
    const bindingNow = async () => (await stack.persistence.readSnapshot(['meta'], async (tx) => await tx.get('meta', 'catalog'))).binding;
    const before = await bindingNow();

    await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });

    expect(await bindingNow()).toEqual(before);
    expect((await stack.journal.queryActions({ reviewDate: opened.reviewDate, tradeId })).actions[tradeId]).toBeUndefined();
  }, 60_000);
});
