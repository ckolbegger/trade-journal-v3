// I4.10: rebuilding private state gives equal Review, Open list and Details, and identical indexes (AC-REBUILD-001).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { rebuildPrivateState } from '../../../src/persistence/index.ts';
import { currentDatabase, device, dumpAll, fourTrades, MONDAY, MONDAY_1700, onboarded, openReview, restart, saveAction, saveMark } from './support.ts';
import { readIndex } from '../d2/support.ts';

// The Review without its binding, the Open list, and every Open Trade's Detail.
async function views(app: Application, d: Awaited<ReturnType<typeof device>>) {
  const opened = await openReview(app, d);
  const review = { ...opened, binding: undefined };
  const open = await app.TradeViewsAndReporting.browseTrades({ lifecycle: 'Open' });
  if (open.kind !== 'Ready') throw new Error(`browseTrades: ${open.kind}`);
  const details = [];
  for (const { tradeId } of open.view.items) {
    const result = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (result.kind !== 'Ready') throw new Error(`getTradeDetail: ${result.kind}`);
    details.push(result.view);
  }
  return { review, list: open.view, details };
}

describe('I4.10 rebuild equivalence', () => {
  it('should give equal Review, Open list and Details after rebuildPrivateState, with byInstrumentDate and journalObligations rebuilt identical', async () => {
    const d = await device(undefined, MONDAY_1700);
    const app = await onboarded(d);
    const { a, b, c, e } = await fourTrades(app);
    for (const [symbol, price] of [['XYZ', '52.00'], ['ABC', '27.50'], ['JKL', '21.00']] as const) await saveMark(app, symbol, MONDAY, price);
    await app.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: 'DEF', tradingDate: MONDAY, reason: 'No quote available.', expectedResolutionRevision: 'None' });
    await saveAction(app, d, a);
    await saveAction(app, d, b, 'Exit', 'Stopped out.');
    await saveAction(app, d, c);
    await saveAction(app, d, e);

    const databaseName = await currentDatabase(d.factory);
    const before = await views(app, d);
    const obligations = (await dumpAll(d.factory))[databaseName]!['journalObligations'];
    const instrumentDates = await readIndex(d.factory, databaseName, 'observations', 'byInstrumentDate');

    app.persistence.close();
    await rebuildPrivateState(d.factory, databaseName);
    const again = await restart(app, d);

    expect(before.review.completion.kind).toBe('CompleteWithUnavailableMarks');
    expect(before.list.items).toHaveLength(4);
    expect(await views(again, d)).toEqual(before);
    expect((await dumpAll(d.factory))[databaseName]!['journalObligations']).toEqual(obligations);
    expect(await readIndex(d.factory, databaseName, 'observations', 'byInstrumentDate')).toEqual(instrumentDates);
    // Four observations; four Plan Reflections, five Position Change Reflections and four Actions.
    expect(instrumentDates).toHaveLength(4);
    expect(obligations).toHaveLength(13);
  }, 60_000);
});
