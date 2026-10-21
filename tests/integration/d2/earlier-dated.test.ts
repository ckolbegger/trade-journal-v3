// I2.9: an entry recorded later but dated earlier (P5) moves the Entry Resolution Point, recomputes
// Entry Quality, and gives PC2's Entry Size occurrence a new version, all disclosed in the receipt.
import { describe, expect, it } from 'vitest';
import { complete, confirmReference, dec, device, onboarded, PC1_TIME, PC2_TIME, record, restart } from './support.ts';

describe('I2.9 earlier-dated entry (P5)', () => {
  it('should move the Entry Resolution Point to PC-early, recompute Entry Quality over PC1 and PC-early, version PC2s occurrence to 60, and disclose both changes', async () => {
    const d = await device();
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    const first = await record(app, tradeId, { quantity: '60', price: '50.10', economicTime: PC1_TIME }, await complete(app));
    const second = await record(app, tradeId, { quantity: '60', price: '50.30', economicTime: PC2_TIME }, await complete(app));
    const [pc1, pc2] = [first, second].map((r) => r.postCommit.trade.positionChanges.at(-1)!.factId);
    expect(second.postCommit.derivation.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc2 });
    const occurrence = second.receipt.deviationReconciliation[0]!;
    expect([occurrence.action, occurrence.version.quantityAbovePlan]).toEqual(['Create', '20']);

    // PC-early: 40 at 10:30 New York time, between PC1 and PC2.
    const early = await record(app, tradeId, { quantity: '40', price: '50.20', economicTime: '2026-10-12T14:30:00Z' }, await complete(app));
    const pcEarly = early.receipt.createdFactIds.find((id) => early.postCommit.trade.positionChanges.some((pc) => pc.factId === id))!;
    const quality = early.postCommit.derivation.entryQuality;
    expect(early.postCommit.derivation.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pcEarly });
    // Over PC1 (60 @ 50.10) and PC-early (40 @ 50.20): average 50.14, risk 100 x 2.64 + 2, reward 100 x 5.86 - 2.
    expect(quality.kind === 'Value' && [quality.value.averageEntry, quality.value.actualInitialRisk, quality.value.actualInitialReward]).toEqual([
      { kind: 'Value', value: dec('50.14') },
      { kind: 'Value', value: dec('266') },
      { kind: 'Value', value: dec('584') },
    ]);
    expect(early.receipt.entryChanges).toEqual([
      { kind: 'EntryResolutionMoved', from: pc2, to: pcEarly },
      { kind: 'EntryQualityChanged', from: second.postCommit.derivation.entryQuality, to: quality },
    ]);
    expect(early.receipt.deviationReconciliation).toEqual([
      expect.objectContaining({
        action: 'NewVersion',
        occurrenceId: occurrence.occurrenceId,
        version: expect.objectContaining({ quantityAbovePlan: '60' }) as unknown,
      }),
    ]);

    const again = await restart(app, d);
    const detail = await again.TradeViewsAndReporting.getTradeDetail({ tradeId });
    if (detail.kind !== 'Ready' || !('positionChanges' in detail.view)) throw new Error('expected the Open form of Detail');
    expect(detail.view.positionChanges.map((pc) => pc.factId)).toEqual([pc1, pcEarly, pc2]);
    expect(detail.view.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pcEarly });
    expect(detail.view.entryQuality).toEqual(quality);
    expect(
      detail.view.deviations.map((o) => [o.occurrenceId, o.versions.map((v) => [v.causingPositionChangeId, v.quantityAbovePlan, v.status])]),
    ).toEqual([
      [
        occurrence.occurrenceId,
        [
          [pc2, '20', 'Active'],
          [pc2, '60', 'Active'],
        ],
      ],
    ]);
    expect(detail.view.findings).toEqual([]);
  });
});
