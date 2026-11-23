// I95.2 Daily Review: the day summary through a day (A300), through the real facade on fake-indexeddb.
import { describe, expect, it } from 'vitest';
import { instrumentKey } from '../../../src/domain/instrument/index.ts';
import { optionPlanCommand, planStock, record, recordOption, restart, onboardedAt, XYZ_CALL } from '../d7/support.ts';
import { MON_1700, MONDAY, openOn, saveActionOn, saveMark, sixTradeBook } from './support.ts';

describe('I95.2 The day summary through a day (A300)', () => {
  it('should let the counts fall as Marks and Actions are saved', { timeout: 120_000 }, async () => {
    const book = await sixTradeBook({ withoutMonday: ['inside'] });
    const opened = await openOn(book.app, MON_1700);
    // Six Trades; JKL's Mark to go; the expired contract owes no Action and is one expiration; one due reflection.
    expect(opened.day).toMatchObject({ trades: 6, toGo: { marks: 1, actions: 5, expirations: 1, closeReviews: 0, reflections: 1 } });

    const marks = await book.app.DailyReview.save({
      kind: 'SaveReviewMarks',
      reviewDate: opened.reviewDate,
      binding: opened.binding,
      entries: [{ key: { instrumentKey: 'JKL', tradingDate: MONDAY }, expectedRevision: 'None', intention: { kind: 'RecordInitialManualMark', price: '20.50' } }],
    });
    if (marks.kind !== 'MarksSaved' || marks.review.kind !== 'Ready') throw new Error(`save: ${marks.kind}`);
    // Catches a Marks save that leaves the Mark count, or touches the Action count.
    expect(marks.review.day?.toGo).toMatchObject({ marks: 0, actions: 5 });

    const action = await saveActionOn(book.app, MON_1700, book.ids.deep, 'Hold');
    // Catches an Action save that leaves the count, and the saved result's day against a fresh open's.
    expect(action.review.kind === 'Ready' && action.review.day?.toGo).toMatchObject({ marks: 0, actions: 4 });
    expect((await openOn(book.app, MON_1700)).day?.toGo).toMatchObject({ marks: 0, actions: 4, expirations: 1 });
  });

  it('should list what is past a line, what was chosen, what comes due and the next Review Date on the finished day', { timeout: 120_000 }, async () => {
    const { d, app: first } = await onboardedAt(MON_1700);
    // ABC is past its Stop on Thursday, Friday and Monday, after Wednesday's recovery; DEF ends Monday past its Target.
    const past = await planStock(first, 'ABC', '30.00', '28.00', '36.00', '100', '2026-10-05T13:00:00Z');
    await record(first, past, { quantity: '100', price: '30.00', economicTime: '2026-10-05T14:00:00Z' });
    for (const [date, price] of [['2026-10-05', '29.00'], ['2026-10-06', '27.00'], ['2026-10-07', '29.00'], ['2026-10-08', '27.00'], ['2026-10-09', '27.00'], [MONDAY, '27.00']] as const) await saveMark(first, 'ABC', date, price);
    const at = await planStock(first, 'DEF', '50.00', '47.50', '56.00', '100', '2026-10-12T13:00:00Z');
    await record(first, at, { quantity: '100', price: '50.00', economicTime: '2026-10-12T14:00:00Z' });
    await saveMark(first, 'DEF', MONDAY, '57.00');
    const selling = await planStock(first, 'GHI', '20.00', '18.00', '26.00', '100', '2026-10-12T13:00:00Z');
    await record(first, selling, { quantity: '100', price: '20.00', economicTime: '2026-10-12T14:00:00Z' });
    await saveMark(first, 'GHI', MONDAY, '21.00');
    // A call expiring Friday 10-16: four sessions left after Monday.
    const call = { ...XYZ_CALL, expiration: '2026-10-16' } as const;
    const base = await optionPlanCommand(first, 'O-C', '2026-10-12T13:00:00Z');
    const confirmed = await first.TradeWorkflows.confirmPlan({ ...base, plan: { ...base.plan, legs: [{ ...base.plan.legs[0]!, instrument: call, quantity: '1' }] } });
    if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${confirmed.kind}`);
    const later = confirmed.receipt.tradeId;
    await recordOption(first, later, 'Buy', { quantity: '1', price: '2.10', economicTime: '2026-10-12T14:00:00Z', fee: '0.65' });
    await saveMark(first, 'XYZ', MONDAY, '52.00');
    await saveMark(first, instrumentKey(call), MONDAY, '3.00');
    const app = await restart(first, d);

    // Catches a finished day shown while Actions are still to go.
    expect((await openOn(app, MON_1700)).day?.finished).toBeUndefined();
    await saveActionOn(app, MON_1700, past, 'Hold');
    await saveActionOn(app, MON_1700, at, 'Hold');
    await saveActionOn(app, MON_1700, later, 'Hold');
    const last = await saveActionOn(app, MON_1700, selling, 'Exit', 'The thesis is done.');
    const { day } = await openOn(app, MON_1700);

    expect(day?.toGo).toMatchObject({ marks: 0, actions: 0, expirations: 0 });
    // The run past the Stop began Thursday, not Tuesday's first crossing: Thursday, Friday and the Review Date make three.
    expect(day?.finished?.pastLine).toEqual({ stop: [{ tradeId: past, sessions: 3 }], target: [{ tradeId: at, sessions: 1 }] });
    // Each Trade's Action saved for the Review Date.
    expect(Object.fromEntries((day?.finished?.chosen ?? []).map((c) => [c.tradeId, c.action]))).toEqual({ [past]: 'Hold', [at]: 'Hold', [later]: 'Hold', [selling]: 'Exit' });
    // Only the Trade told to Exit is a sale to record; the call expires on 10-16 with Tuesday to Friday left.
    expect(day?.finished?.due.sales).toEqual([selling]);
    expect(day?.finished?.due.expirations).toEqual([{ expiration: '2026-10-16', sessionsLeft: 4, contracts: [{ tradeId: later, instrument: call }] }]);
    expect(day?.nextReviewDate).toBe('2026-10-13');
    // The save that finished the day returns the same finished day.
    expect(last.review.kind === 'Ready' && last.review.day?.finished).toEqual(day?.finished);
  });
});
