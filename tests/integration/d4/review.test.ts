// I4.13: the Review end to end, from facts alone (AC-REV-002, AC-REV-006, AC-MARK-003 partial).
import { describe, expect, it } from 'vitest';
import { bindingFor, dumpAll, device, fourTrades, MONDAY, MONDAY_1700, onboarded, openReview, restart, saveAction, saveMark, workspaceStores, type StoredObservation } from './support.ts';

describe('I4.13 Review end to end', () => {
  it('should walk Marks then Trades, complete with DEF unavailable, resume from facts after restart, and complete when DEF is marked with its acknowledgment kept', async () => {
    const d = await device(undefined, MONDAY_1700);
    const app = await onboarded(d);
    const { a, b, c, e } = await fourTrades(app);

    // First open: the Marks family then the Trades family; Incomplete for every Mark and Action.
    const first = await openReview(app, d);
    expect(first.families.map((f) => f.family)).toEqual(['Marks', 'Trades']);
    const marksFamily = first.families[0]!;
    expect(marksFamily.family === 'Marks' && marksFamily.today.map((r) => [r.instrumentKey, r.task])).toEqual([['ABC', 'Manual'], ['DEF', 'Manual'], ['JKL', 'Manual'], ['XYZ', 'Manual']]);
    const tradesFamily = first.families[1]!;
    expect(tradesFamily.family === 'Trades' && tradesFamily.trades.map((t) => t.tradeId).sort()).toEqual([a, b, c, e].sort());
    expect(first.completion.kind).toBe('Incomplete');
    expect(first.completion.kind === 'Incomplete' && first.completion.reasons.map((r) => r.code)).toEqual([
      'MarkMissing', 'MarkMissing', 'MarkMissing', 'MarkMissing', 'ActionMissing', 'ActionMissing', 'ActionMissing', 'ActionMissing',
    ]);

    // Marks for XYZ, ABC and JKL, and an acknowledgment for DEF.
    await saveMark(app, 'XYZ', MONDAY, '52.00');
    await saveMark(app, 'ABC', MONDAY, '27.50');
    await saveMark(app, 'JKL', MONDAY, '21.00');
    const acknowledged = await app.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: 'DEF', tradingDate: MONDAY, reason: 'No quote available.', expectedResolutionRevision: 'None' });
    expect(acknowledged.kind).toBe('Saved');

    const marked = await openReview(app, d);
    expect(marked.completion.kind === 'Incomplete' && marked.completion.reasons.map((r) => r.code)).toEqual(['ActionMissing', 'ActionMissing', 'ActionMissing', 'ActionMissing']);

    // Actions: Hold for T-A with one save call, Exit with Intent for T-B, Hold for the rest.
    const before = workspaceStores(await dumpAll(d.factory));
    const { binding } = await bindingFor(app, d, a);
    const held = await app.DailyReview.save({ kind: 'SaveTradeAction', binding, action: 'Hold' });
    expect(held.kind === 'Saved' && held.review.kind === 'Ready' && held.review.progress).toEqual({ tradesWithAction: 1, tradesEligible: 4 });
    await saveAction(app, d, b, 'Exit', 'Stopped out.');
    await saveAction(app, d, c);
    await saveAction(app, d, e);

    const expectedCompletion = { kind: 'CompleteWithUnavailableMarks', instruments: ['DEF'], trades: [c] };
    const done = await openReview(app, d);
    expect(done.completion).toMatchObject(expectedCompletion);

    // After restart: the same, derived from the stored facts.
    const again = await restart(app, d);
    const resumed = await openReview(again, d);
    expect(resumed.completion).toEqual(done.completion);
    expect(resumed.families).toEqual(done.families);

    // DEF's Mark replaces the unavailability: Complete, with the acknowledgment kept in DEF's history.
    const row = resumed.families[0]!.family === 'Marks' ? resumed.families[0]!.today.find((r) => r.instrumentKey === 'DEF') : undefined;
    expect(row).toBeDefined();
    await again.MarketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'DEF', tradingDate: MONDAY, price: '40.50', expectedResolutionRevision: row!.resolutionRevision });
    const complete = await openReview(again, d);
    expect(complete.completion).toEqual({ kind: 'Complete' });

    // Durable state: four Action Entries under their obligation keys, no Review-session record, no Trade fact added.
    const after = workspaceStores(await dumpAll(d.factory));
    const entries = after['journalEntries'] as { entryTypeKey: string; obligationKey?: unknown }[];
    const actions = entries.filter((x) => x.entryTypeKey === 'entry-type.daily-trade-review');
    expect(actions.map((x) => x.obligationKey).sort()).toEqual([a, b, c, e].map((id) => ['DailyTradeReview', MONDAY, id]).sort());
    expect(Object.keys(after)).toEqual(Object.keys(before));
    expect(Object.keys(after).filter((name) => /review/i.test(name) && !/^journal/.test(name))).toEqual([]);
    expect(after['trades']).toEqual(before['trades']);
    const def = (after['observations'] as StoredObservation[]).find((o) => o.instrumentKey === 'DEF')!;
    expect(def.acknowledgments).toHaveLength(1);
    expect(def.marks).toHaveLength(1);
    expect(def.marks[0]!.price).toBe('40.5');
  }, 60_000);
});
