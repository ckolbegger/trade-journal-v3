import { describe, expect, it } from 'vitest';
import { MONDAY_1700, reviewStack, type ReviewStack } from '../../../tests/support/review-fixture.ts';
import { dumpAll } from '../../../tests/support/stack.ts';
import type { ActionChoice, SaveDailyReviewResult, TradeSaveBinding } from './index.ts';

// T95.32: the reason rule of SaveTradeAction (A308, P166). Roll and Adjust: always. Hold: when the Plan Call is Out. Exit: unless it is Out.

// A stock Trade bought Mon 10-05 (stop 47.50, target 56.00), reviewed on Monday 10-12 at the Mark given.
async function tradeAt(mark: string) {
  const stack = await reviewStack(MONDAY_1700);
  const planned = await stack.confirm({ symbol: 'XYZ', shares: '100', entry: '50.00', stop: '47.50', target: '56.00', planTime: '2026-10-05T13:00:00Z' });
  await stack.fill(planned, '2026-10-05T14:00:00Z', '100', '50.00');
  if (mark === 'Unavailable') await stack.acknowledge('XYZ');
  else await stack.saveMark('XYZ', mark);
  return { stack, tradeId: planned.tradeId };
}

async function bindingOf(stack: ReviewStack, tradeId: string): Promise<TradeSaveBinding> {
  const opened = await stack.dailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: MONDAY_1700 });
  if (opened.kind !== 'Ready') throw new Error(`expected Ready, got ${opened.kind}`);
  const card = await stack.dailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
  if (card.kind !== 'Ready') throw new Error(`expected Ready, got ${card.kind}`);
  return card.trade.saveBinding;
}

const save = (stack: ReviewStack, binding: TradeSaveBinding, action: ActionChoice, intent?: string): Promise<SaveDailyReviewResult> =>
  stack.dailyReview.save({ kind: 'SaveTradeAction', binding, action, ...(intent === undefined ? {} : { intent }) });

const REQUIRED = { kind: 'Rejected', issues: [{ code: 'IntentRequired' }] };

function saved(result: SaveDailyReviewResult) {
  if (result.kind !== 'Saved') throw new Error(`expected Saved, got ${result.kind}`);
  return result;
}

const intentOf = (result: Extract<SaveDailyReviewResult, { kind: 'Saved' }>) => result.action.responses.find((r) => r.prompt === 'Why?')?.answer;

describe('SaveTradeAction: the reason rule (A308)', () => {
  it('should save a Hold with no reason when the call is Hold', async () => {
    const { stack, tradeId } = await tradeAt('51.00');

    const result = saved(await save(stack, await bindingOf(stack, tradeId), 'Hold'));

    expect(result.action.action).toBe('Hold');
    expect(intentOf(result)).toEqual({ kind: 'Unanswered' });
  }, 60_000);

  it('should refuse a Hold with no reason when the call is Out, with IntentRequired, and write nothing', async () => {
    const { stack, tradeId } = await tradeAt('47.00');
    const binding = await bindingOf(stack, tradeId);
    const before = await dumpAll(stack.factory);

    expect(await save(stack, binding, 'Hold')).toEqual(REQUIRED);

    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 60_000);

  it('should save that Hold with a reason', async () => {
    const { stack, tradeId } = await tradeAt('47.00');

    const result = saved(await save(stack, await bindingOf(stack, tradeId), 'Hold', 'The stop is a mental one.'));

    expect(result.action.action).toBe('Hold');
    expect(intentOf(result)).toEqual({ kind: 'Text', text: 'The stop is a mental one.' });
  }, 60_000);

  it('should save an Exit with no reason when the call is Out', async () => {
    const { stack, tradeId } = await tradeAt('47.00');

    const result = saved(await save(stack, await bindingOf(stack, tradeId), 'Exit'));

    expect(result.action.action).toBe('Exit');
    expect(intentOf(result)).toEqual({ kind: 'Unanswered' });
  }, 60_000);

  it('should refuse an Exit with no reason when the call is Hold', async () => {
    const { stack, tradeId } = await tradeAt('51.00');
    const binding = await bindingOf(stack, tradeId);
    const before = await dumpAll(stack.factory);

    expect(await save(stack, binding, 'Exit')).toEqual(REQUIRED);

    expect(await dumpAll(stack.factory)).toEqual(before);
  }, 60_000);

  it('should refuse Roll and Adjust with no reason at any call', async () => {
    for (const mark of ['47.00', '51.00', 'Unavailable'] as const) {
      const { stack, tradeId } = await tradeAt(mark);
      const binding = await bindingOf(stack, tradeId);
      const before = await dumpAll(stack.factory);
      for (const action of ['Roll', 'Adjust'] as const) expect(await save(stack, binding, action)).toEqual(REQUIRED);
      expect(await dumpAll(stack.factory)).toEqual(before);
      saved(await save(stack, binding, 'Roll', 'Rolling out.'));
    }
  }, 120_000);

  it('should apply the Unknown rule: a Hold with no reason saves and an Exit with none is refused', async () => {
    const { stack, tradeId } = await tradeAt('Unavailable');
    const binding = await bindingOf(stack, tradeId);

    expect(await save(stack, binding, 'Exit')).toEqual(REQUIRED);
    const result = saved(await save(stack, binding, 'Hold'));

    expect(result.action.action).toBe('Hold');
  }, 60_000);

  it('should treat a reason of spaces as none', async () => {
    const { stack, tradeId } = await tradeAt('47.00');
    const binding = await bindingOf(stack, tradeId);

    expect(await save(stack, binding, 'Hold', '   ')).toEqual(REQUIRED);
  }, 60_000);

  it('should apply the rule when a saved Action is changed', async () => {
    const { stack, tradeId } = await tradeAt('47.00');
    saved(await save(stack, await bindingOf(stack, tradeId), 'Exit', 'Stopped out.'));
    const binding = await bindingOf(stack, tradeId);
    expect(binding.expectedEntryRevision).toBe(1);

    expect(await save(stack, binding, 'Hold')).toEqual(REQUIRED);
    const changed = saved(await save(stack, binding, 'Hold', 'Giving it a day.'));

    expect(changed.action).toEqual(expect.objectContaining({ action: 'Hold', entryRevision: 2 }));
  }, 60_000);

  it('should save every Action as intent only: no Trade fact and no Deviation', async () => {
    const { stack, tradeId } = await tradeAt('47.00');
    const before = await dumpAll(stack.factory);
    const stores = (dump: typeof before) => Object.values(dump).find((db) => 'trades' in db)!;

    const result = saved(await save(stack, await bindingOf(stack, tradeId), 'Exit', 'Stopped out.'));

    const after = await dumpAll(stack.factory);
    expect(intentOf(result)).toEqual({ kind: 'Text', text: 'Stopped out.' });
    expect(stores(after)['trades']).toEqual(stores(before)['trades']);
    expect(stores(after)['journalEntries']).toHaveLength(stores(before)['journalEntries']!.length + 1);
    const entries = stores(after)['journalEntries'] as { entryTypeKey?: string }[];
    expect(entries.filter((entry) => entry.entryTypeKey === 'entry-type.daily-trade-review')).toHaveLength(1);
  }, 60_000);
});
