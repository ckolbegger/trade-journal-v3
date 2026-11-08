// I7.6: Settlement Due is derived from the date and the open quantity and never inferred into a fact
// (AC-SET-003, P25, A110 to A112): the Detail and the Review show it on and after the expiration date, the
// dump holds no Expiration fact and no lifecycle change until the trader records one, and recording E-S at the
// settlement time takes the Trade out of the Review.
import { describe, expect, it } from 'vitest';
import { dec } from '../d2/support.ts';
import {
  closeReviewDisposition, complete, confirmOption, detailOf, dumpAll, FRIDAY_1600, FRIDAY_1700, MONDAY_NEXT_1700, MONDAY_NEXT_1705, onboardedAt, OS_S1, recordExpiration, recordOption, restart, reviewAt,
  THURSDAY_1700, workspaceStores, type StoredTradeDoc,
} from './support.ts';

const SETTLEMENT = { quantity: dec('-2'), expiration: '2026-11-20', settlementTime: { kind: 'Value', value: FRIDAY_1600 } };

describe('I7.6 Settlement Due is never inferred', () => {
  it('should show Settlement Due on Detail and in the Review on Friday and Monday and nothing on Thursday, keep the dump free of an Expiration fact and a lifecycle change, then close at Friday 16:00 on E-S and leave Monday out of the walk and the settlement family', async () => {
    const { d, app } = await onboardedAt(FRIDAY_1700);
    const tradeId = (await confirmOption(app, 'O-S')).receipt.tradeId;
    await recordOption(app, tradeId, 'Sell', OS_S1);
    const baseline = await dumpAll(d.factory);
    const expectUnchanged = async () => {
      const dump = await dumpAll(d.factory);
      expect(dump).toEqual(baseline);
      const trade = (workspaceStores(dump)['trades'] as StoredTradeDoc[])[0]!;
      expect(trade.lifecycle).toBe('Open');
      expect(trade.facts.filter((f) => f.kind === 'Expiration')).toEqual([]);
    };
    const settlementFamily = (review: Awaited<ReturnType<typeof reviewAt>>) => (review.kind === 'Ready' ? review.families.filter((f) => f.family === 'Settlement') : []);
    const walkedBands = (review: Awaited<ReturnType<typeof reviewAt>>) =>
      review.kind === 'Ready' ? review.families.flatMap((f) => (f.family === 'Trades' ? f.trades.map((t) => [t.tradeId, t.band, t.reasons.map((r) => r.code)]) : [])) : [];

    // Thursday 17:00: the contract expires 2026-11-20, and nothing is due.
    const thursday = await restart(app, { ...d, now: THURSDAY_1700 });
    const thursdayDetail = await detailOf(thursday, tradeId);
    if (!('current' in thursdayDetail)) throw new Error('expected an Open Detail');
    expect(thursdayDetail.summary).toEqual(expect.objectContaining({ kind: 'Option', expiration: '2026-11-20' }));
    expect(thursdayDetail.current.evaluation.settlement.map((s) => [s.status, s.expiration])).toEqual([['NotYetDue', '2026-11-20']]);
    expect(thursdayDetail.settlement).toEqual([]);
    expect(thursdayDetail.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
    const thursdayReview = await reviewAt(thursday, THURSDAY_1700);
    expect(settlementFamily(thursdayReview)).toEqual([]);
    expect(JSON.stringify(walkedBands(thursdayReview))).not.toContain('SettlementDue');
    await expectUnchanged();

    // Friday 17:00 and Monday 17:00: Settlement Due on Detail and in the Review, the Review Incomplete, the Trade Open.
    let current = thursday;
    for (const [now, asOf] of [[FRIDAY_1700, FRIDAY_1700], [MONDAY_NEXT_1700, MONDAY_NEXT_1700]] as const) {
      current = await restart(current, { ...d, now });
      const detail = await detailOf(current, tradeId);
      if (!('current' in detail)) throw new Error('expected an Open Detail');
      expect(detail.settlement).toEqual([expect.objectContaining(SETTLEMENT)]);
      expect(detail.lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });
      const review = await reviewAt(current, asOf);
      if (review.kind !== 'Ready') throw new Error(`open: ${review.kind}`);
      expect(settlementFamily(review)).toEqual([{ family: 'Settlement', items: [expect.objectContaining({ tradeId, ...SETTLEMENT })] }]);
      expect(walkedBands(review)).toEqual([[tradeId, 'Blocker', ['SettlementDue']]]);
      expect(review.completion.kind).toBe('Incomplete');
      expect(review.completion.kind === 'Incomplete' && review.completion.reasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'SettlementDue', tradeId })]));
      await expectUnchanged();
    }

    // E-S at Monday 17:05, dated at the settlement time: Closed at Friday 16:00.
    current = await restart(current, { ...d, now: MONDAY_NEXT_1705 });
    const expired = await recordExpiration(current, tradeId, '2', FRIDAY_1600, { reflection: await complete(current), closeReview: await closeReviewDisposition(current, 'Defer') });
    expect(expired.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Open', to: 'Closed' }]);
    const closed = await detailOf(current, tradeId);
    if (!('terminalDisposition' in closed)) throw new Error('expected the Closed form of Detail');
    expect(closed.terminalTime).toBe(FRIDAY_1600);
    expect(closed.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
    expect(closed.settlement).toEqual([]);

    // Monday's Review no longer walks O-S or lists its settlement; its deferred Close Review (A107) is owed and Due.
    const after = await reviewAt(current, MONDAY_NEXT_1705);
    if (after.kind !== 'Ready') throw new Error(`open: ${after.kind}`);
    expect(settlementFamily(after)).toEqual([]);
    expect(walkedBands(after)).toEqual([]);
    expect(after.owed.map((o) => [o.tradeId, o.lifecycle, o.owed.map((item) => [item.entryTypeKey, item.dueAnchor, item.classification])])).toEqual([
      [tradeId, 'Closed', [['entry-type.close-review', FRIDAY_1600, 'Due']]],
    ]);
    expect(after.completion.kind === 'Incomplete' && after.completion.reasons.filter((r) => r.code === 'SettlementDue')).toEqual([]);
  }, 60_000);
});
