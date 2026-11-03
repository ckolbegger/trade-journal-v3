// I6.11: the Exit Action records intent only (AC-REV-003, decision 72). The Review offers no route to the exit;
// recording it is a separate Trade Workflow, and Monday's Review still walks the Trade with its saved Exit Action,
// evaluated at Monday's cutoff, after the exit dated Tuesday 10:00 is recorded.
import { describe, expect, it } from 'vitest';
import { Rational } from '../../../src/domain/values/index.ts';
import { dumpAll, MONDAY_DATE, MONDAY_1700, recordExit, referenceTrade, restart, saveAction, saveMark, workspaceStores, X1, type Device } from './support.ts';

const TUESDAY_1005 = '2026-10-13T14:05:00Z';

describe('I6.11 Exit Action and its route', () => {
  it('should create no Position Change when the Exit Action is saved, and walk T-A in Monday Review with its saved Exit Action at Monday cutoff, Position 100 and realized 0.00, after X1 is recorded', async () => {
    const { d: monday, app, tradeId } = await referenceTrade(MONDAY_1700);

    // Monday 17:00: the Exit with Intent is saved in the Review.
    await saveMark(app, 'XYZ', MONDAY_DATE, '52.00');
    const before = workspaceStores(await dumpAll(monday.factory));
    await saveAction(app, monday, tradeId, 'Exit', 'Take the profit tomorrow.');
    const after = workspaceStores(await dumpAll(monday.factory));
    // The Trade's facts and index entries are untouched: no Position Change, no Execution.
    expect(after['trades']).toEqual(before['trades']);
    const saved = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (saved.kind !== 'Ready' || !('positionChanges' in saved.view)) throw new Error('expected the Open form of Detail');
    expect(saved.view.positionChanges).toHaveLength(2);

    // Recording the exit is a separate step, dated Tuesday 10:00 and entered at Tuesday 10:05.
    const tuesday: Device = { ...monday, now: TUESDAY_1005 };
    const later = await restart(app, tuesday);
    await recordExit(later, tradeId, [X1]);

    // Monday's Review again: T-A is walked with its saved Exit Action, evaluated at Monday's cutoff.
    const opened = await later.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf: tuesday.now });
    if (opened.kind !== 'Ready') throw new Error(`DailyReview.open: ${opened.kind}`);
    expect(opened.reviewDate).toBe(MONDAY_DATE);
    expect(opened.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => t.tradeId) : []))).toEqual([tradeId]);
    const card = await later.DailyReview.getTrade({ reviewDate: opened.reviewDate, tradeId, binding: opened.binding });
    if (card.kind !== 'Ready') throw new Error(`getTrade: ${card.kind}`);
    expect(card.trade.form).toEqual({ kind: 'Saved', action: expect.objectContaining({ action: 'Exit' }) as unknown });
    expect(card.trade.evaluation).toEqual(
      expect.objectContaining({ openQuantity: { kind: 'Value', value: Rational.of(100n) }, realizedToDate: { kind: 'Value', value: Rational.of(0n) } }),
    );
  }, 60_000);
});
