// I7.5: the Close Review of an Expiration is put off without blocking the closure, and an Expiration takes no Close
// Reason (AC-POS-004, A107, D9.5 A312). A sale's Close Review answered or declined through its Debt is the other two
// outcomes (T95.48: an expiration no longer completes or declines its Close Review at the change). The Review's owed
// group classifies the deferred one by the Review it is read in.
import { describe, expect, it } from 'vitest';
import {
  attemptExpiration, closeReasonId, closeReviewDisposition, confirmOption, detailOf, dumpAll, FRIDAY_1600, FRIDAY_1700, MONDAY_NEXT_1700, OC_PC1, OC_X1, onboardedAt, outstandingDebts, recordOption, restart, reviewAt,
  recordExpiration, workspaceStores, type CloseReviewKind, type StoredTradeDoc,
} from './support.ts';

describe('I7.5 Expiration Close Review dispositions', () => {
  it('should close three Long Calls, two by a sale whose Close Review is answered and declined through its Debt and one by an expiration with no Close Reason and an Outstanding Debt due Friday 16:00, reject a fourth expiration with a Close Reason writing nothing, and classify the deferred one as DueInNextReview on Friday and Due on Monday', async () => {
    const { d, app } = await onboardedAt(FRIDAY_1700);
    const trades = {} as Record<CloseReviewKind, string>;
    for (const kind of ['Complete', 'Decline', 'Defer'] as const) {
      const tradeId = (await confirmOption(app, 'O-C')).receipt.tradeId;
      await recordOption(app, tradeId, 'Buy', OC_PC1);
      const result = kind === 'Defer'
        ? await recordExpiration(app, tradeId, '1', FRIDAY_1600)
        : await recordOption(app, tradeId, 'Sell', OC_X1, { closeReasonId: await closeReasonId(app, 'Target Reached'), closeReview: await closeReviewDisposition(app, kind) });
      expect(result.receipt.lifecycleTransitions).toEqual([{ tradeId, from: 'Open', to: 'Closed' }]);
      expect(result.receipt.closeReview?.kind).toBe('Debt');
      trades[kind] = tradeId;
    }

    // The fourth carries a Close Reason: CloseReasonNotApplicable, and the dump is unchanged.
    const fourth = (await confirmOption(app, 'O-C')).receipt.tradeId;
    await recordOption(app, fourth, 'Buy', OC_PC1);
    const before = await dumpAll(d.factory);
    const rejected = await attemptExpiration(app, fourth, '1', FRIDAY_1600, { closeReasonId: await closeReasonId(app, 'Time-Based Exit'), closeReview: await closeReviewDisposition(app, 'Defer') });
    expect(rejected).toEqual(expect.objectContaining({ kind: 'Rejected', issues: [{ source: 'TradeWorkflows', field: 'closeReasonId', code: 'CloseReasonNotApplicable' }] }));
    expect(await dumpAll(d.factory)).toEqual(before);
    expect((await detailOf(app, fourth)).lifecycle).toEqual({ stored: 'Open', agreement: { kind: 'Agrees' } });

    // Restart: three Closed with no Close Reason, and the outcomes each disposition leaves.
    const friday = await restart(app, d);
    for (const tradeId of Object.values(trades)) {
      const detail = await detailOf(friday, tradeId);
      if (!('terminalDisposition' in detail)) throw new Error('expected the Closed form of Detail');
      expect(detail.lifecycle).toEqual({ stored: 'Closed', agreement: { kind: 'Agrees' } });
      if (tradeId === trades.Defer) expect(detail.closeReason).toBeUndefined();
    }
    const stores = workspaceStores(await dumpAll(d.factory));
    const storedTrades = stores['trades'] as StoredTradeDoc[];
    for (const tradeId of Object.values(trades)) {
      const stored = storedTrades.find((t) => t.tradeId === tradeId);
      expect(stored?.lifecycle).toBe('Closed');
      // The stored document omits the field when the Trade has no Close Reason fact.
      if (tradeId === trades.Defer) expect(stored?.closeReasonFacts ?? []).toEqual([]);
    }
    const obligations = stores['journalObligations'] as { obligationKey: string; outcome: { kind: string } }[];
    const outcomeOf = (tradeId: string) => obligations.find((o) => o.obligationKey === `CloseReview:${tradeId}`)?.outcome.kind;
    expect([outcomeOf(trades.Complete), outcomeOf(trades.Decline), outcomeOf(trades.Defer)]).toEqual(['Entry', 'Decline', 'Debt']);
    const debts = await outstandingDebts(friday);
    expect(debts.filter((debt) => debt.entryTypeKey === 'entry-type.close-review').map((debt) => [debt.anchor, debt.dueAnchor])).toEqual([[{ kind: 'Trade', tradeId: trades.Defer }, FRIDAY_1600]]);

    // Friday 17:00: the deferred reflection is owed and due in the next Review; the Review is not complete for it.
    const fridayReview = await reviewAt(friday, FRIDAY_1700);
    if (fridayReview.kind !== 'Ready') throw new Error(`open: ${fridayReview.kind}`);
    expect(fridayReview.owed.map((o) => [o.tradeId, o.lifecycle, o.owed.map((item) => [item.entryTypeKey, item.dueAnchor, item.classification])])).toEqual([
      [trades.Defer, 'Closed', [['entry-type.close-review', FRIDAY_1600, 'DueInNextReview']]],
    ]);
    expect(fridayReview.completion.kind).toBe('Incomplete');
    const fridayReasons = fridayReview.completion.kind === 'Incomplete' ? fridayReview.completion.reasons : [];
    expect(fridayReasons.filter((r) => r.code === 'ReflectionDue')).toEqual([]);

    // Monday 17:00: the same Debt is Due, and the Review is Incomplete until it is answered.
    const mondayDevice = { ...d, now: MONDAY_NEXT_1700 };
    const monday = await restart(friday, mondayDevice);
    const mondayReview = await reviewAt(monday, MONDAY_NEXT_1700);
    if (mondayReview.kind !== 'Ready') throw new Error(`open: ${mondayReview.kind}`);
    expect(mondayReview.owed.map((o) => [o.tradeId, o.owed.map((item) => [item.dueAnchor, item.classification])])).toEqual([[trades.Defer, [[FRIDAY_1600, 'Due']]]]);
    expect(mondayReview.completion.kind).toBe('Incomplete');
    if (mondayReview.completion.kind !== 'Incomplete') throw new Error('expected Incomplete');
    expect(mondayReview.completion.reasons).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ReflectionDue', tradeId: trades.Defer })]));
  }, 60_000);
});
