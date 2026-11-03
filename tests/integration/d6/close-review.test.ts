// I6.4: the Close Review dispositions Complete, Decline and Defer, none of which blocks closure
// (AC-POS-004), and how a deferred Close Review shows in the Daily Review (AC-REV-006 partial, A86).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import {
  closeReasonId, closeReviewDisposition, device, dumpAll, journalStores, onboarded, outstandingDebts, PC1_TIME, planStock, record, recordExit, restart, TUESDAY_1400, TUESDAY_1700, WEDNESDAY_1700,
  type CloseReviewKind, type Fill,
} from './support.ts';

const BUY: Fill = { quantity: '100', price: '50.00', economicTime: PC1_TIME };
const SELL: Fill = { quantity: '100', price: '52.00', economicTime: TUESDAY_1400, fee: '0.60' };

const DISPOSITIONS = [
  { kind: 'Complete', symbol: 'XYZ' },
  { kind: 'Decline', symbol: 'ABC' },
  { kind: 'Defer', symbol: 'DEF' },
] as const satisfies readonly { kind: CloseReviewKind; symbol: string }[];

async function review(app: Application, asOf: string) {
  const opened = await app.DailyReview.open({ date: { kind: 'LatestCompleted' }, asOf });
  if (opened.kind !== 'Ready' && opened.kind !== 'Empty') throw new Error(`DailyReview.open: ${opened.kind}`);
  return opened;
}

describe('I6.4 Close Review dispositions', () => {
  it('should close all three Trades with a completed Entry, a decline, and an Outstanding Debt due at 14:00 with no Entry, and show the deferred one as due in the next Review on Tuesday without blocking and as Due and Incomplete on Wednesday', async () => {
    const d = await device(undefined, TUESDAY_1700);
    const app = await onboarded(d);
    const reason = await closeReasonId(app, 'Target Reached');
    const trades: Record<CloseReviewKind, string> = { Complete: '', Decline: '', Defer: '' };
    for (const { kind, symbol } of DISPOSITIONS) {
      trades[kind] = await planStock(app, symbol, '50.00', '47.50', '56.00');
      await record(app, trades[kind], BUY);
    }
    const results: Record<string, Awaited<ReturnType<typeof recordExit>>> = {};
    for (const { kind } of DISPOSITIONS) results[kind] = await recordExit(app, trades[kind], [SELL], { closeReasonId: reason, closeReview: await closeReviewDisposition(app, kind) });
    // Each result names the one Close Review outcome the disposition produced.
    expect(DISPOSITIONS.map(({ kind }) => results[kind]!.receipt.closeReview?.kind)).toEqual(['Entry', 'Decline', 'Debt']);

    const again = await restart(app, d);
    const details = Object.fromEntries(
      await Promise.all(
        DISPOSITIONS.map(async ({ kind }) => {
          const detail = await again.TradeViewsAndReporting.getTradeDetail({ tradeId: trades[kind] });
          if (detail.kind !== 'Ready') throw new Error(`getTradeDetail: ${detail.kind}`);
          return [kind, detail.view] as const;
        }),
      ),
    );
    // All three are Closed whatever the disposition.
    for (const { kind } of DISPOSITIONS) expect(details[kind]!.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    const closed = await again.TradeViewsAndReporting.browseTrades({ lifecycle: 'Closed' });
    expect(closed.kind === 'Ready' && closed.view.items.map((i) => i.tradeId).sort()).toEqual(Object.values(trades).sort());

    // The stored outcome of each: an Entry (Source Trade Close), a decline, or a Debt with no Entry.
    const stores = journalStores(await dumpAll(d.factory));
    const key = (tradeId: string) => `CloseReview:${tradeId}`;
    const closeEntries = stores.entries.filter((e) => e.entryTypeKey === 'entry-type.close-review');
    expect(closeEntries).toEqual([expect.objectContaining({ obligationKey: key(trades.Complete), sourceKey: 'source.trade-close' })]);
    expect(stores.declines).toEqual([expect.objectContaining({ sourceKey: 'source.trade-close' })]);
    expect(stores.debts.filter((debt) => debt.obligationKey === key(trades.Defer))).toEqual([
      expect.objectContaining({ entryTypeKey: 'entry-type.close-review', dueAnchor: TUESDAY_1400, anchor: { kind: 'Trade', tradeId: trades.Defer }, versions: [expect.objectContaining({ status: 'Outstanding' })] }),
    ]);
    expect(closeEntries.some((e) => JSON.stringify(e).includes(trades.Defer))).toBe(false);
    expect(stores.obligations.filter((o) => o.obligationKey.startsWith('CloseReview:')).map((o) => [o.obligationKey, o.outcome.kind]).sort()).toEqual(
      [[key(trades.Complete), 'Entry'], [key(trades.Decline), 'Decline'], [key(trades.Defer), 'Debt']].sort(),
    );
    const debts = await outstandingDebts(again);
    expect(debts.filter((debt) => debt.entryTypeKey === 'entry-type.close-review')).toEqual([expect.objectContaining({ dueAnchor: TUESDAY_1400, anchor: { kind: 'Trade', tradeId: trades.Defer } })]);

    // The narrative shows the disposition on each Trade's Detail: an Entry, a decline, or an owed Debt.
    const narrative = (kind: CloseReviewKind) => {
      const view = details[kind]!;
      if (!('positionChanges' in view)) throw new Error('expected the Open or Closed form of Detail');
      return view.journal;
    };
    expect(narrative('Complete')).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'Entry', entryTypeKey: 'entry-type.close-review', source: 'Trade Close' })]));
    expect(narrative('Decline').filter((item) => item.kind === 'Decline')).toEqual([expect.objectContaining({ entryTypeKey: 'entry-type.close-review', source: 'Trade Close' })]);
    expect(narrative('Defer').filter((item) => item.kind === 'Debt' && item.entryTypeKey === 'entry-type.close-review')).toHaveLength(1);
    expect(narrative('Defer').some((item) => item.kind === 'Entry' && item.entryTypeKey === 'entry-type.close-review')).toBe(false);

    // Tuesday 17:00: the deferred Close Review is due in the next Review, so it is listed, and nothing is blocked.
    const tuesday = await review(again, TUESDAY_1700);
    expect(tuesday.owed.map((t) => t.tradeId)).toEqual([trades.Defer]);
    expect(tuesday.owed[0]!.lifecycle).toBe('Closed');
    expect(tuesday.owed[0]!.owed.map((o) => [o.entryTypeKey, o.dueAnchor, o.classification])).toEqual([['entry-type.close-review', TUESDAY_1400, 'DueInNextReview']]);
    expect(tuesday.owed[0]!.progress.done).toBe(true);
    expect(tuesday.kind === 'Ready' ? tuesday.completion : { kind: 'Complete' }).toEqual({ kind: 'Complete' });

    // Wednesday 17:00: it is Due, the Review is Incomplete until it is answered, and the completed and declined
    // Close Reviews appear in neither Review.
    const wednesdayApp = await restart(again, { ...d, now: WEDNESDAY_1700 });
    const wednesday = await review(wednesdayApp, WEDNESDAY_1700);
    expect(wednesday.kind).toBe('Ready');
    expect(wednesday.owed.map((t) => t.tradeId)).toEqual([trades.Defer]);
    expect(wednesday.owed[0]!.owed.map((o) => [o.entryTypeKey, o.classification])).toEqual([['entry-type.close-review', 'Due']]);
    expect(wednesday.owed[0]!.progress.done).toBe(false);
    const debt = (await outstandingDebts(wednesdayApp))[0]!;
    expect(wednesday.kind === 'Ready' && wednesday.completion).toEqual({ kind: 'Incomplete', reasons: [{ code: 'ReflectionDue', tradeId: trades.Defer, debtIds: [debt.debtId] }] });
    for (const opened of [tuesday, wednesday]) {
      const walked = opened.kind === 'Ready' ? opened.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => t.tradeId) : [])) : [];
      for (const settled of [trades.Complete, trades.Decline]) {
        expect(walked).not.toContain(settled);
        expect(opened.owed.map((t) => t.tradeId)).not.toContain(settled);
      }
    }
  }, 60_000);
});
