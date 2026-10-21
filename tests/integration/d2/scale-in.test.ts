// I2.6: scaling in with PC2 and PC3 of the reference Trade (AC-POS-005, AC-CALC-001).
import { describe, expect, it } from 'vitest';
import {
  complete,
  confirmReference,
  decline,
  device,
  dumpAll,
  onboarded,
  PC1,
  PC2,
  PC3,
  record,
  REFERENCE_ENTRY_QUALITY,
  restart,
  workspaceStores,
} from './support.ts';

describe('I2.6 scale-in, Entry Quality, Entry Size', () => {
  it('should resolve Entry Quality at PC2 with the T2.2 figures, keep it after PC3, and hold one Entry Size occurrence of 20 for PC3, FilledWithDeviation, one decline, and three obligations', async () => {
    const d = await device();
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    await record(app, tradeId, PC1, await complete(app));
    const second = await record(app, tradeId, PC2, await complete(app));
    const pc2 = second.postCommit.trade.positionChanges.at(-1)!.factId;
    expect(second.postCommit.derivation.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc2 });
    expect(second.postCommit.derivation.entryQuality).toEqual(REFERENCE_ENTRY_QUALITY);
    const third = await record(app, tradeId, PC3, await decline(app, 'Added on strength; reflecting later.'));
    const pc3 = third.postCommit.trade.positionChanges.at(-1)!.factId;
    if (third.postCommit.reflection.kind !== 'Decline') throw new Error('expected a decline');

    const again = await restart(app, d);
    const detail = await again.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready' || !('positionChanges' in detail.view)) throw new Error('expected the Open form of Detail');
    const view = detail.view;
    expect(view.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc2 });
    expect(view.entryQuality).toEqual(REFERENCE_ENTRY_QUALITY);
    expect(view.legFulfillment).toEqual([{ plannedLegId: view.plan.legs[0]!.factId, fulfillment: 'FilledWithDeviation' }]);
    expect(view.deviations).toEqual([
      {
        occurrenceId: expect.any(String) as string,
        versions: [
          {
            fingerprint: { tradeId, plannedLegId: view.plan.legs[0]!.factId, positionChangeId: pc3 },
            type: 'EntrySize',
            form: 'Excess',
            quantityAbovePlan: '20',
            causingPositionChangeId: pc3,
            economicTime: PC3.economicTime,
            status: 'Active',
          },
        ],
      },
    ]);
    expect(view.findings).toEqual([]);

    const stores = workspaceStores(await dumpAll(d.factory));
    const declines = stores['journalDeclines'] as { id: string; reason?: string }[];
    expect(declines.map((r) => [r.id, r.reason])).toEqual([[third.postCommit.reflection.decline.id, 'Added on strength; reflecting later.']]);
    const obligations = stores['journalObligations'] as { obligationKey: string; outcome: { kind: string } }[];
    const reflections = obligations.filter((o) => o.obligationKey.startsWith('PositionChangeReflection:'));
    expect(reflections.map((o) => o.outcome.kind).sort()).toEqual(['Decline', 'Entry', 'Entry']);
  });
});
