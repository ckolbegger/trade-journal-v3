// I5R.5: the historical gap group names the Trades it concerns, and no gap blocks completion (A153, AC-MARK-004).
import { describe, expect, it } from 'vitest';
import { bindingFor, MONDAY, openReview, reflectionForm, saveAction } from '../d5/support.ts';
import { cardApp, FRIDAY_DATE } from './support.ts';

describe('I5R.5 Gap Trades', () => {
  it('should name T-A from Friday and T-F from Monday in XYZ gap group, and complete the Review with that gap still open', async () => {
    const { d, app, trades } = await cardApp({ withMarks: true });

    const opened = await openReview(app, d);
    const marksFamily = opened.families.find((f) => f.family === 'Marks');
    if (marksFamily?.family !== 'Marks') throw new Error('no Marks family');
    expect(marksFamily.earlier).toHaveLength(1);
    expect(marksFamily.earlier[0]).toMatchObject({ instrumentKey: 'XYZ', missing: [FRIDAY_DATE], blocking: false });
    // In the walk's order (T-F ranks before T-A), each with the first session it is relevant from.
    expect(marksFamily.earlier[0]!.trades).toEqual([
      { tradeId: trades.f, from: MONDAY },
      { tradeId: trades.a, from: FRIDAY_DATE },
    ]);
    // The gap is not among the reasons the Review is incomplete: DEF's Monday Mark, the five Actions and D-1 are.
    const reasons = opened.completion.kind === 'Incomplete' ? opened.completion.reasons : [];
    expect(reasons.map((reason) => reason.code).sort()).toEqual(['ActionMissing', 'ActionMissing', 'ActionMissing', 'ActionMissing', 'ActionMissing', 'MarkMissing', 'ReflectionDue']);
    expect(reasons.filter((reason) => reason.code === 'MarkMissing')).toEqual([expect.objectContaining({ instrumentKey: 'DEF', tradingDate: MONDAY })]);

    // Resolve every obligation of the Review date: the Review completes, and the Friday gap is still listed.
    const unavailable = await app.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: 'DEF', tradingDate: MONDAY, reason: 'No quote available.', expectedResolutionRevision: 'None' });
    expect(unavailable.kind).toBe('Saved');
    const { form } = await bindingFor(app, d, trades.a);
    const due = form.reflections.find((reflection) => reflection.classification === 'Due')!;
    const resolved = await app.DailyReview.save({ kind: 'ResolveReviewDebt', reviewDate: opened.reviewDate, binding: due.saveBinding, resolution: { kind: 'Answer', answers: (await reflectionForm(app)).answers } });
    expect(resolved.kind).toBe('DebtResolved');
    for (const tradeId of [trades.a, trades.b, trades.c, trades.e, trades.f]) await saveAction(app, d, tradeId);

    const done = await openReview(app, d);
    expect(done.completion).toMatchObject({ kind: 'CompleteWithUnavailableMarks', instruments: ['DEF'] });
    const stillOpen = done.families.find((f) => f.family === 'Marks');
    expect(stillOpen?.family === 'Marks' && stillOpen.earlier.map((g) => [g.instrumentKey, g.missing])).toEqual([['XYZ', [FRIDAY_DATE]]]);
  }, 60_000);
});
