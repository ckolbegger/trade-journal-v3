// I5R.1: Marks saved together from the cards, with the results equal to the stored records and to a fresh `open`,
// and the durable state after a restart (AC-REV-002, AC-RESP-001, P37). The card fixture is built through the facade.
import { describe, expect, it } from 'vitest';
import { bindingFor, dumpAll, MONDAY, openReview, reflectionForm, restart, saveAction, saveMark, workspaceStores, type StoredObservation } from '../d5/support.ts';
import { cardApp, FRIDAY_DATE, initialMark, marksSaved, saveMarksFrom, unavailable } from './support.ts';

const observations = async (factory: IDBFactory) => workspaceStores(await dumpAll(factory))['observations'] as (StoredObservation & { acknowledgments: unknown[] })[];
const keyOf = (o: StoredObservation) => `${o.instrumentKey} ${o.tradingDate}`;

describe('I5R.1 Save Marks together', () => {
  it('should save XYZ Monday and Friday from T-A then DEF unavailable from T-C, with each result equal to the stored records and a fresh open, and the state after a restart', async () => {
    const { d, app, trades } = await cardApp({ withMarks: false });
    await saveMark(app, 'ABC', MONDAY, '27.50');
    await saveMark(app, 'JKL', MONDAY, '21.00');
    const seeded = (await observations(d.factory)).map(keyOf).sort();
    expect(seeded).toEqual([`ABC ${MONDAY}`, `JKL ${MONDAY}`]);

    // T-A's card: XYZ for Monday and Friday, one commit.
    const first = marksSaved(await saveMarksFrom(app, d, trades.a, [initialMark('XYZ', MONDAY, '52.00'), initialMark('XYZ', FRIDAY_DATE, '51.00')]));
    expect(first.marks.map((m) => m.key)).toEqual([
      { instrumentKey: 'XYZ', tradingDate: MONDAY },
      { instrumentKey: 'XYZ', tradingDate: FRIDAY_DATE },
    ]);
    const stored = await observations(d.factory);
    for (const mark of first.marks) {
      const record = stored.find((o) => o.instrumentKey === mark.key.instrumentKey && o.tradingDate === mark.key.tradingDate)!;
      expect(mark.resolutionRevision).toBe(record.resolutionRevision);
      expect(mark.classification).toBe('InitialManual');
      expect(mark.resolution.kind).toBe('Available');
    }
    expect(stored.find((o) => keyOf(o) === `XYZ ${MONDAY}`)!.marks.map((m) => m.price)).toEqual(['52']);
    expect(stored.find((o) => keyOf(o) === `XYZ ${FRIDAY_DATE}`)!.marks.map((m) => m.price)).toEqual(['51']);
    // The revised items equal a fresh open's, and the card equals a fresh card.
    if (first.review.kind !== 'Ready') throw new Error(first.review.kind);
    const afterFirst = await openReview(app, d);
    const walkedAfterFirst = afterFirst.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
    expect(first.review.trades).toEqual(walkedAfterFirst);
    expect(first.review.completion).toEqual(afterFirst.completion);
    expect(first.review.binding).toEqual(afterFirst.binding);
    const freshA = await app.DailyReview.getTrade({ reviewDate: afterFirst.reviewDate, tradeId: trades.a, binding: afterFirst.binding });
    if (freshA.kind !== 'Ready') throw new Error(freshA.kind);
    expect(first.review.trade).toEqual(freshA.trade);

    // T-C's card: DEF unavailable with a reason.
    const second = marksSaved(await saveMarksFrom(app, d, trades.c, [unavailable('DEF', MONDAY, 'No quote available.')]));
    expect(second.marks.map((m) => [m.key, m.classification, m.resolution.kind])).toEqual([[{ instrumentKey: 'DEF', tradingDate: MONDAY }, 'Asserted', 'AcknowledgedUnavailable']]);
    const afterSecond = await openReview(app, d);
    if (second.review.kind !== 'Ready') throw new Error(second.review.kind);
    expect(second.review.trades).toEqual(afterSecond.families.flatMap((f) => (f.family === 'Trades' ? f.trades : [])));
    const defStored = (await observations(d.factory)).find((o) => keyOf(o) === `DEF ${MONDAY}`)!;
    expect(second.marks[0]!.resolutionRevision).toBe(defStored.resolutionRevision);

    // After a restart: Review-date rows resolved, the XYZ Friday gap gone, T-C's position not placed.
    const live = await restart(app, d);
    const reopened = await openReview(live, d);
    const marksFamily = reopened.families.find((f) => f.family === 'Marks');
    if (marksFamily?.family !== 'Marks') throw new Error('no Marks family');
    expect(marksFamily.today.map((r) => [r.instrumentKey, r.resolution.kind, r.task])).toEqual([
      ['ABC', 'Available', null],
      ['DEF', 'AcknowledgedUnavailable', null],
      ['JKL', 'Available', null],
      ['XYZ', 'Available', null],
    ]);
    expect(marksFamily.earlier.some((g) => g.instrumentKey === 'XYZ')).toBe(false);
    const walked = reopened.families.flatMap((f) => (f.family === 'Trades' ? f.trades : []));
    const c = walked.find((t) => t.tradeId === trades.c)!;
    expect(c.rangePosition).toEqual({ kind: 'NotPlaced', reason: 'MissingInput', instrumentKey: 'DEF', date: MONDAY });
    expect(c.reasons).toContainEqual({ code: 'AcknowledgedUnavailable', instrumentKey: 'DEF', date: MONDAY });

    // Actions for the five Trades and D-1 resolved: the Review completes with DEF unavailable.
    const { form } = await bindingFor(live, d, trades.a);
    const due = form.reflections.find((r) => r.classification === 'Due')!;
    const resolved = await live.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: reopened.reviewDate, binding: due.saveBinding, resolution: { kind: 'Answer', answers: (await reflectionForm(live)).answers } });
    expect(resolved.kind).toBe('DebtResolved');
    expect((await openReview(live, d)).completion.kind).toBe('Incomplete');
    for (const tradeId of [trades.a, trades.b, trades.c, trades.e, trades.f]) await saveAction(live, d, tradeId);
    const done = await openReview(live, d);
    expect(done.completion).toMatchObject({ kind: 'CompleteWithUnavailableMarks', instruments: ['DEF'], trades: [trades.c] });

    // Durable state: the three records the saves wrote, one acknowledgment among all records.
    const final = (await observations(d.factory)).filter((o) => !seeded.includes(keyOf(o)));
    expect(final.map(keyOf).sort()).toEqual([`DEF ${MONDAY}`, `XYZ ${FRIDAY_DATE}`, `XYZ ${MONDAY}`]);
    expect((await observations(d.factory)).flatMap((o) => o.acknowledgments)).toHaveLength(1);
    expect(final.find((o) => o.instrumentKey === 'DEF')!.acknowledgments).toHaveLength(1);
  }, 120_000);
});
