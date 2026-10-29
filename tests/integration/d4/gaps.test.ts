// I4.17: skipped sessions are visible, optional and fillable, and never block the Review (AC-MARK-004 partial, P15).
import { describe, expect, it } from 'vitest';
import { device, dumpAll, FRIDAY, MONDAY, MONDAY_1700, onboarded, openReview, planStock, record, restart, saveAction, saveMark, workspaceStores, type StoredObservation } from './support.ts';

const WEDNESDAY = '2026-10-07';
const THURSDAY = '2026-10-08';

function gapGroup(opened: Awaited<ReturnType<typeof openReview>>) {
  const marks = opened.families.find((f) => f.family === 'Marks');
  if (marks?.family !== 'Marks') throw new Error('no Marks family');
  return marks.earlier;
}

describe('I4.17 skipped sessions', () => {
  it('should list Friday as an optional gap while the Review is Complete, and fill it from the gap list', async () => {
    const d = await device(undefined, MONDAY_1700);
    const app = await onboarded(d);
    const mno = await planStock(app, 'MNO', '25.00', '23.00', '30.00', '100', '2026-10-07T13:00:00Z');
    await record(app, mno, { quantity: '100', price: '25.00', economicTime: '2026-10-07T14:00:00Z' });
    await saveMark(app, 'MNO', WEDNESDAY, '25.50');
    await saveMark(app, 'MNO', THURSDAY, '25.80');

    // Monday's Mark and an Action complete the Review although Friday has no Mark.
    await saveMark(app, 'MNO', MONDAY, '26.10');
    await saveAction(app, d, mno);
    const opened = await openReview(app, d);
    expect(opened.completion).toEqual({ kind: 'Complete' });
    expect(gapGroup(opened)).toEqual([expect.objectContaining({ instrumentKey: 'MNO', missing: [FRIDAY], acknowledged: [], blocking: false })]);

    // The same after restart.
    const again = await restart(app, d);
    const resumed = await openReview(again, d);
    expect(resumed.completion).toEqual({ kind: 'Complete' });
    const [group] = gapGroup(resumed);
    expect(group).toMatchObject({ instrumentKey: 'MNO', missing: [FRIDAY], blocking: false });

    // Friday's Mark is entered from the gap list.
    const saved = await again.MarketData.save({ intention: 'RecordInitialManualMark', instrumentKey: 'MNO', tradingDate: FRIDAY, price: '25.90', expectedResolutionRevision: group!.revisions[FRIDAY]! });
    expect(saved.kind).toBe('Saved');
    const filled = await openReview(again, d);
    expect(filled.completion).toEqual({ kind: 'Complete' });
    expect(gapGroup(filled)).toEqual([]);
    const observations = workspaceStores(await dumpAll(d.factory))['observations'] as StoredObservation[];
    expect(observations.find((o) => o.instrumentKey === 'MNO' && o.tradingDate === FRIDAY)).toMatchObject({ resolutionRevision: 1, marks: [{ price: '25.9' }] });
    expect(observations).toHaveLength(4);
  }, 30_000);
});
