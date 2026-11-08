// I7.7: the Daily Review end to end with settlement (AC-REV-002, P28, A110 to A112): the Settlement Review fixture at
// Friday 17:00, one XYZ Mark for two Trades, an Expiration recorded from the settlement item with its Close Review
// deferred, the Actions and a reflection answered, and the same Review resumed from facts after the application stops.
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import {
  bindingFor, closeReviewDisposition, complete, device, dumpAll, FRIDAY_1600, FRIDAY_1700, FRIDAY_DATE, MNO_PUT, onboarded, recordExpiration, restart, reviewAt, saveAction, saveMark, SATURDAY_1000,
  settlementTrades, workspaceStores, XYZ_CALL, type Device,
} from './support.ts';

const rowsOf = (review: Awaited<ReturnType<typeof reviewAt>>) => {
  if (review.kind !== 'Ready') throw new Error(`open: ${review.kind}`);
  const marks = review.families.find((f) => f.family === 'Marks');
  if (marks?.family !== 'Marks') throw new Error('no Marks family');
  return marks.today;
};
const settlementOf = (review: Awaited<ReturnType<typeof reviewAt>>) => {
  if (review.kind !== 'Ready') throw new Error(`open: ${review.kind}`);
  const family = review.families.find((f) => f.family === 'Settlement');
  return family?.family === 'Settlement' ? family.items : [];
};
const walkOf = (review: Awaited<ReturnType<typeof reviewAt>>) => {
  if (review.kind !== 'Ready') throw new Error(`open: ${review.kind}`);
  const trades = review.families.find((f) => f.family === 'Trades');
  return trades?.family === 'Trades' ? trades.trades : [];
};

// T-5's card as the Review renders it: its one Outstanding reflection is answered.
async function answerReflection(app: Application, d: Device, tradeId: string) {
  const { opened, form } = await bindingFor(app, d, tradeId);
  const binding = form.reflections[0]!.saveBinding;
  const disposition = await complete(app);
  if (disposition.kind !== 'Complete') throw new Error('expected a Complete disposition');
  const result = await app.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding, resolution: { kind: 'Answer', answers: disposition.form.answers } });
  if (result.kind !== 'DebtResolved') throw new Error(`ResolveReviewDebt: ${result.kind}`);
}

describe('I7.7 Review end to end with settlement', () => {
  it('should open as the task families, take T-1 out of the walk and the settlement family when E1 is recorded with its Close Review deferred, and after the application stops show the same Friday Review incomplete for T-3 alone, with no Review-session record', async () => {
    const d = await device(undefined, FRIDAY_1700);
    let app = await onboarded(d);
    const { t1, t2, t3, t4, t5 } = await settlementTrades(app, true);

    // First open: Marks (XYZ naming T-1 and T-2), settlement (T-1 then T-3), the walk with both in the blocker band, nothing owed.
    const first = await reviewAt(app, FRIDAY_1700);
    if (first.kind !== 'Ready') throw new Error(`open: ${first.kind}`);
    expect(first.reviewDate).toBe(FRIDAY_DATE);
    expect(first.families.map((f) => f.family)).toEqual(['Marks', 'Settlement', 'Trades']);
    expect(rowsOf(first).find((row) => row.instrumentKey === 'XYZ')).toEqual(expect.objectContaining({ trades: [t1, t2], task: 'Manual', resolution: { kind: 'Missing' } }));
    expect(settlementOf(first).map((item) => [item.tradeId, item.settlementTime])).toEqual([[t1, { kind: 'Value', value: FRIDAY_1600 }], [t3, { kind: 'Value', value: FRIDAY_1600 }]]);
    expect(walkOf(first).filter((t) => t.band === 'Blocker').map((t) => t.tradeId).sort()).toEqual([t1, t3].sort());
    expect(first.owed).toEqual([]);

    // One Mark for XYZ resolves it for T-1 and T-2.
    await saveMark(app, 'XYZ', FRIDAY_DATE, '52.00');
    const marked = await reviewAt(app, FRIDAY_1700);
    expect(rowsOf(marked).find((row) => row.instrumentKey === 'XYZ')).toEqual(expect.objectContaining({ trades: [t1, t2], resolution: expect.objectContaining({ kind: 'Available' }) as unknown }));
    expect(rowsOf(marked).find((row) => row.instrumentKey === instrumentKey(XYZ_CALL))).toBeDefined();

    // E1 for T-1 from its item, the Close Review deferred.
    const item = settlementOf(marked).find((candidate) => candidate.tradeId === t1)!;
    const expired = await recordExpiration(app, t1, item.quantity.numerator.toString(), item.settlementTime.kind === 'Value' ? item.settlementTime.value : '', { reflection: await complete(app), closeReview: await closeReviewDisposition(app, 'Defer') });
    expect(expired.receipt.lifecycleTransitions).toEqual([{ tradeId: t1, from: 'Open', to: 'Closed' }]);

    // After E1: T-1 is out of the walk and the settlement family, its contract's Mark task is gone, XYZ's task names T-2
    // only and stays resolved, and T-1 is owed its Close Review in the next Review.
    const after = await reviewAt(app, FRIDAY_1700);
    if (after.kind !== 'Ready') throw new Error(`open: ${after.kind}`);
    expect(walkOf(after).map((t) => t.tradeId)).not.toContain(t1);
    expect(settlementOf(after).map((i) => i.tradeId)).toEqual([t3]);
    expect(rowsOf(after).map((row) => row.instrumentKey)).not.toContain(instrumentKey(XYZ_CALL));
    expect(rowsOf(after).find((row) => row.instrumentKey === 'XYZ')).toEqual(expect.objectContaining({ trades: [t2], resolution: expect.objectContaining({ kind: 'Available' }) as unknown }));
    expect(after.owed.map((o) => [o.tradeId, o.lifecycle, o.owed.map((x) => [x.entryTypeKey, x.dueAnchor, x.classification])])).toEqual([
      [t1, 'Closed', [['entry-type.close-review', FRIDAY_1600, 'DueInNextReview']]],
    ]);

    // Actions for T-2 to T-5, and T-5's reflection answered.
    for (const tradeId of [t2, t3, t4, t5]) await saveAction(app, d, tradeId);
    await answerReflection(app, d, t5);
    const worked = await reviewAt(app, FRIDAY_1700);
    if (worked.kind !== 'Ready') throw new Error(`open: ${worked.kind}`);
    expect(worked.completion.kind === 'Incomplete' && worked.completion.reasons.map((r) => r.code)).toEqual(['SettlementDue']);

    // The application stops; Saturday 10:00 opens the same Friday Review, resumed from facts.
    const saturday = { ...d, now: SATURDAY_1000 };
    app = await restart(app, saturday);
    const resumed = await reviewAt(app, SATURDAY_1000);
    if (resumed.kind !== 'Ready') throw new Error(`open: ${resumed.kind}`);
    expect(resumed.reviewDate).toBe(FRIDAY_DATE);
    expect(resumed.completion.kind).toBe('Incomplete');
    if (resumed.completion.kind !== 'Incomplete') throw new Error('expected Incomplete');
    // Only T-3's settlement remains, a short Cash-Secured Put whose assignment this release can't record (decision 10).
    expect(resumed.completion.reasons).toEqual([expect.objectContaining({ code: 'SettlementDue', tradeId: t3, instrument: MNO_PUT })]);
    const item3 = resumed.completion.reasons[0]!;
    expect(item3.code === 'SettlementDue' && item3.quantity.numerator < 0n).toBe(true);
    expect({ ...resumed, binding: undefined }).toEqual({ ...worked, binding: undefined });

    // No Review-session record, flag or placeholder in any store.
    const dump = await dumpAll(d.factory);
    expect(Object.keys(workspaceStores(dump)).filter((name) => /session|review|finish|placeholder/i.test(name))).toEqual([]);
    expect(JSON.stringify(dump, (_k, v: unknown) => (typeof v === 'bigint' ? String(v) : v))).not.toMatch(/reviewSession|finishFlag|placeholder|reviewFinished/i);
  }, 120_000);
});
