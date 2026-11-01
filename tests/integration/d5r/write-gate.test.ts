// I5R.6: the write gate refuses a Marks save and a single-key Mark save while the inventory check fails, and the
// Review stays readable (AC-DEL-006). Two layers refuse: the mutation guard before the save, and `Persistence.commit`
// inside it (T5R.1's red note, T5R.5's open question). With the guard defeated these cases still pass, and only with
// the commit's refusal also unhandled do they fail (the mutation checks in the T5R.14 record).
import { describe, expect, it } from 'vitest';
import { dumpAll, MONDAY, openReview, restart } from '../d5/support.ts';
import { cardApp, initialMark, unavailable } from './support.ts';

const notWritable = expect.objectContaining({
  kind: 'RuntimeNotWritable',
  failedChecks: expect.arrayContaining([expect.objectContaining({ check: 'inventory' })]) as unknown,
}) as unknown;

// The command is prepared against a Review opened while the host is healthy; then the host fails the inventory
// check and the application restarts into recovery.
async function failedHost() {
  const { d, app, trades } = await cardApp({ withMarks: false });
  const live = await restart(app, d);
  const opened = await openReview(live, d);
  d.testHost.fail(['inventory']);
  const recovery = await restart(live, d);
  const before = await dumpAll(d.factory);
  return { d, recovery, trades, opened, before };
}

describe('I5R.6 Write gate', () => {
  it('should return RuntimeNotWritable from SaveReviewMarks for a Mark and for an acknowledgment, leave the dump unchanged, and still open the Review', async () => {
    const { d, recovery, trades, opened, before } = await failedHost();

    const marks = await recovery.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId: trades.a, binding: opened.binding, entries: [initialMark('XYZ', MONDAY, '52.00')] });
    const acknowledgment = await recovery.DailyReview.save({ kind: 'SaveReviewMarks', reviewDate: opened.reviewDate, tradeId: trades.c, binding: opened.binding, entries: [unavailable('DEF', MONDAY, 'No quote available.')] });

    expect(marks).toEqual(notWritable);
    expect(acknowledgment).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
    expect((await recovery.Workspace.getStatus()).kind).toBe('RecoveryOnly');
    const reopened = await openReview(recovery, d);
    expect(reopened.families.map((f) => f.family)).toEqual(['Marks', 'Trades']);
  }, 60_000);

  it('should return RuntimeNotWritable from MarketData.save and leave the dump unchanged', async () => {
    const { d, recovery, before } = await failedHost();

    const initial = await recovery.MarketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'XYZ', tradingDate: MONDAY, price: '52.00', expectedResolutionRevision: 'None' });
    const asserted = await recovery.MarketData.save({ intention: 'AssertUnavailable', instrumentKey: 'DEF', tradingDate: MONDAY, reason: 'No quote available.', expectedResolutionRevision: 'None' });

    expect(initial).toEqual(notWritable);
    expect(asserted).toEqual(notWritable);
    expect(await dumpAll(d.factory)).toEqual(before);
  }, 60_000);
});
