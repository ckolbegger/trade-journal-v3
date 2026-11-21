// I9R2.3 Correcting an earlier session's Mark (AC-REV-005, ADR 0011): the revision the open listed is the binding. CORV's Mark on Tue 11-10 of
// the shared book, read from the open's earlierMarks.
import { describe, expect, it } from 'vitest';
import { correctMark, marksFamily, openReady, saveMarks, sharedBook } from './support.ts';

const DAY = '2026-11-10';
const listed = async (app: Awaited<ReturnType<typeof sharedBook>>['app']) => {
  const mark = marksFamily(await openReady(app)).earlierMarks.find((g) => g.instrumentKey === 'CORV')?.marks[DAY];
  if (!mark) throw new Error('no listed Mark');
  return mark;
};

describe('I9R2.3 Correct an earlier session Mark at the revision the open listed (AC-REV-005)', () => {
  it('I9R2.3 should save the correction at the listed revision and conflict at an older one', { timeout: 120_000 }, async () => {
    const { app, tradeIds } = await sharedBook();
    const before = await listed(app);

    const saved = await saveMarks(app, tradeIds[0]!, [correctMark('CORV', DAY, '76.50', before.resolutionRevision)]);

    // Catches a listed revision that is not the stored one (a Correct bound to it would conflict or overwrite).
    expect(saved.kind).toBe('MarksSaved');
    const after = await listed(app);
    expect(after.resolution.mark).toEqual(expect.objectContaining({ price: '76.5', revisionNumber: 2 }));
    expect(after.resolutionRevision).toBe(before.resolutionRevision + 1);

    // The older revision the first open listed is now stale: nothing is written.
    const stale = await saveMarks(app, tradeIds[0]!, [correctMark('CORV', DAY, '77.00', before.resolutionRevision)]);

    // Catches a correction applied over a moved Mark.
    expect(stale).toMatchObject({ kind: 'Conflict', keys: [expect.objectContaining({ key: { instrumentKey: 'CORV', tradingDate: DAY }, code: 'StaleRevision', resolutionRevision: after.resolutionRevision })] });
    expect(await listed(app)).toEqual(after);
  });
});
