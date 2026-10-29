// I4.3: valuing the reference Trade with a Monday Mark (AC-CALC-001 partial, AC-RESP-001).
import { describe, expect, it } from 'vitest';
import { dumpAll, detail, MONDAY, openItem, PC3, record, referenceTrade, restart, saveMark, value, workspaceStores, type StoredObservation } from './support.ts';

describe('I4.3 value a Trade', () => {
  it('should show 180.00 profit, 0.72R, risk 450.00, worst case 5200.00, reward 400.00 and unbounded maximum reward from one Mark, then 199.00 and risk 540.00 after PC3, with one stored Mark revision', async () => {
    const { d, app, tradeId } = await referenceTrade();
    const saved = await saveMark(app, 'XYZ', MONDAY, '52.00');
    const again = await restart(app, d);

    const item = await openItem(again, tradeId);
    const current = item.current;
    expect(current.expectedMarkDate).toBe(MONDAY);
    expect(current.markResolution).toEqual(saved.resolution);
    expect(current.currentMarkedPnl).toEqual(value('180'));
    expect(current.currentMarkedPnlInPlanR).toEqual(value('0.72'));
    expect(current.ongoingRiskToStop).toEqual(value('450'));
    expect(current.worstCaseOngoingRisk).toEqual(value('5200'));
    expect(current.incrementalRewardToTarget).toEqual(value('400'));
    expect(current.maximumIncrementalReward).toEqual(expect.objectContaining({ kind: 'Unbounded' }));
    const view = await detail(again, tradeId);
    expect(view.current.evaluation).toEqual(
      expect.objectContaining({
        currentMarkedPnl: value('180'),
        currentMarkedPnlInPlanR: value('0.72'),
        ongoingRiskToStop: value('450'),
        worstCaseOngoingRisk: value('5200'),
        incrementalRewardToTarget: value('400'),
        maximumIncrementalReward: expect.objectContaining({ kind: 'Unbounded' }) as unknown,
      }),
    );

    // PC3 (20 @ 51.00 at 14:00 New York) makes 120 shares; the Mark and the Plan Baseline stay.
    await record(again, tradeId, PC3);
    const after = (await openItem(again, tradeId)).current;
    expect(after.currentMarkedPnl).toEqual(value('199'));
    expect(after.ongoingRiskToStop).toEqual(value('540'));
    const afterDetail = await detail(again, tradeId);
    expect(afterDetail.baseline.oneR).toEqual(view.baseline.oneR);
    expect(afterDetail.entryQuality).toEqual(view.entryQuality);

    // One record with one Mark revision at resolution revision 1, and no module-wide counter (decision 53).
    const stores = workspaceStores(await dumpAll(d.factory));
    const observations = stores['observations'] as StoredObservation[];
    expect(observations).toHaveLength(1);
    expect(observations[0]).toEqual(expect.objectContaining({ instrumentKey: 'XYZ', tradingDate: MONDAY, resolutionRevision: 1 }));
    expect(observations[0]!.marks).toHaveLength(1);
    expect(observations[0]!.marks[0]).toMatchObject({ price: '52', revisionId: saved.resolution.kind === 'Available' ? saved.resolution.mark.revisionId : '' });
    expect((stores['meta'] as { key: string }[]).map((m) => m.key)).not.toContain('marketDataRevision');
  });
});
