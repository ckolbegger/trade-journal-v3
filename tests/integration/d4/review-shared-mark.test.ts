// I4.6: two Open Trades on one Instrument share one Mark task and one Mark (AC-REV-002 partial).
import { describe, expect, it } from 'vitest';
import { confirmReference, dumpAll, MONDAY, MONDAY_1700, openItem, openReview, PC1, PC2, record, referenceTrade, restart, workspaceStores, type StoredObservation } from './support.ts';

describe('I4.6 shared Instrument', () => {
  it('should list one Mark task naming both Trades, and evaluate both with the one Mark revision from one stored observation', async () => {
    const { d, app, tradeId: first } = await referenceTrade(MONDAY_1700);
    const second = await confirmReference(app);
    await record(app, second, PC1);
    await record(app, second, PC2);

    const opened = await openReview(app, d);
    const marks = opened.families.find((f) => f.family === 'Marks');
    if (marks?.family !== 'Marks') throw new Error('no Marks family');
    expect(opened.families[0]!.family).toBe('Marks');
    expect(marks.today).toHaveLength(1);
    const [row] = marks.today;
    expect(row).toMatchObject({ instrumentKey: 'XYZ', tradingDate: MONDAY, task: 'Manual', resolution: { kind: 'Missing' } });
    expect([...row!.trades].sort()).toEqual([first, second].sort());

    const saved = await app.MarketData.save({
      intention: 'RecordInitialManualMark',
      instrumentKey: 'XYZ',
      tradingDate: MONDAY,
      price: '52.00',
      expectedResolutionRevision: row!.resolutionRevision,
    });
    if (saved.kind !== 'Saved' || saved.resolution.kind !== 'Available') throw new Error(`save: ${JSON.stringify(saved)}`);

    const again = await restart(app, d);
    const reopened = await openReview(again, d);
    const afterMarks = reopened.families.find((f) => f.family === 'Marks');
    expect(afterMarks?.family === 'Marks' && afterMarks.today.map((r) => [r.instrumentKey, r.task])).toEqual([['XYZ', null]]);

    const revisionId = saved.resolution.mark.revisionId;
    for (const tradeId of [first, second]) {
      const current = (await openItem(again, tradeId)).current;
      expect(current.markResolution).toEqual(saved.resolution);
      expect(current.markResolution?.kind === 'Available' && current.markResolution.mark.revisionId).toBe(revisionId);
    }

    const observations = workspaceStores(await dumpAll(d.factory))['observations'] as StoredObservation[];
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ instrumentKey: 'XYZ', tradingDate: MONDAY, effectiveMarkId: revisionId });
  });
});
