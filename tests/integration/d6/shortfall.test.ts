// I6.7: the Entry Size shortfall at Entry Resolution and the moving cutoff (AC-POS-005 partial). An
// earlier-dated Sell moves the cutoff and creates a shortfall; an earlier-dated Buy that completes the
// plan before the cutoff supersedes it. Both changes are disclosed in the receipt (P5, A26).
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import {
  confirmReference, dec, device, dumpAll, MONDAY_1030, onboarded, PC1, PC2, planStock, record, recordExit, REFERENCE_ENTRY_QUALITY, restart, TUESDAY_1000, TUESDAY_1700, workspaceStores,
  type Device, type Fill,
} from './support.ts';

const SELL_30: Fill = { quantity: '30', price: '52.00', economicTime: TUESDAY_1000, fee: '0.60' };
const EARLY_SELL_30: Fill = { quantity: '30', price: '51.50', economicTime: MONDAY_1030, fee: '0.60' };
const value = (text: string) => ({ kind: 'Value', value: dec(text) });

async function detailOf(app: Application, tradeId: string) {
  const result = await app.TradeViewsAndReporting.getTradeDetail({ tradeId });
  if (result.kind !== 'Ready' || !('entryQuality' in result.view)) throw new Error(`getTradeDetail: ${result.kind}`);
  return result.view;
}

// The recorded Deviation occurrences of the stored Trade, with every version.
async function storedDeviations(d: Device, tradeId: string) {
  const trades = workspaceStores(await dumpAll(d.factory))['trades'] as { tradeId: string; deviations: { occurrenceId: string; versions: Record<string, unknown>[] }[] }[];
  return trades.find((t) => t.tradeId === tradeId)!.deviations;
}

// The Entry Quality of a Trade entered by PC1 alone, with the Plan's terms: 60 shares at 50.10 and fee 1.00.
const PC1_ONLY_QUALITY = {
  kind: 'Value',
  value: expect.objectContaining({
    windowQuantity: value('60'),
    windowFees: value('1.00'),
    actualInitialRisk: value('157.00'),
    actualInitialReward: value('353.00'),
    sizeRatio: { kind: 'Value', value: Rational.of(3n, 5n) },
    riskInPlanR: { kind: 'Value', value: Rational.of(157n, 250n) },
    slippage: value('6.00'),
  }) as unknown,
};

describe('I6.7 shortfall and the moving cutoff', () => {
  it('should resolve T-S before XS with one Shortfall of 40 caused by XS and Filled with Deviation, then on an earlier-dated PC-early Buy resolve at PC-early over 100 shares and supersede the Shortfall, disclosing both', async () => {
    const d = await device(undefined, TUESDAY_1700);
    const app = await onboarded(d);
    const tradeId = await planStock(app, 'QRS', '50.00', '47.50', '56.00');
    const pc1 = (await record(app, tradeId, PC1)).receipt.createdFactIds[0]!;
    const xs = (await recordExit(app, tradeId, [SELL_30])).receipt.createdFactIds[0]!;

    const again = await restart(app, d);
    const detail = await detailOf(again, tradeId);
    // The window is cut at XS with 60 entered, so the Entry Quality is over PC1 only.
    expect(detail.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc1 });
    expect(detail.entryQuality).toEqual(PC1_ONLY_QUALITY);
    const leg = detail.plan.legs[0]!;
    expect(detail.legFulfillment).toEqual([{ plannedLegId: leg.factId, fulfillment: 'FilledWithDeviation' }]);
    const shortfall = (await storedDeviations(d, tradeId)).flatMap(({ occurrenceId, versions }) => versions.map((version) => ({ occurrenceId, ...version })));
    expect(shortfall).toEqual([
      expect.objectContaining({
        fingerprint: { tradeId, plannedLegId: leg.factId, form: 'Shortfall' },
        type: 'EntrySize',
        form: 'Shortfall',
        quantityBelowPlan: '40',
        causingPositionChangeId: xs,
        economicTime: TUESDAY_1000,
        status: 'Active',
      }),
    ]);
    expect(detail.deviations).toEqual(await storedDeviations(d, tradeId));
    const occurrenceId = shortfall[0]!.occurrenceId;

    // PC-early: a Buy of 40 dated Monday 11:00, recorded after XS, completes the plan before the cutoff.
    const early = await record(again, tradeId, PC2);
    const pcEarly = early.receipt.createdFactIds[0]!;
    expect(early.receipt.entryChanges).toEqual([
      { kind: 'EntryResolutionMoved', from: pc1, to: pcEarly },
      { kind: 'EntryQualityChanged', from: PC1_ONLY_QUALITY, to: REFERENCE_ENTRY_QUALITY },
    ]);
    expect(early.receipt.deviationReconciliation).toEqual([
      { action: 'Supersede', occurrenceId, version: expect.objectContaining({ form: 'Shortfall', status: 'Superseded', reason: 'NoLongerExpected' }) as unknown },
    ]);

    const afterRestart = await restart(again, d);
    const after = await detailOf(afterRestart, tradeId);
    expect(after.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pcEarly });
    expect(after.entryQuality).toEqual(REFERENCE_ENTRY_QUALITY);
    const versions = (await storedDeviations(d, tradeId)).flatMap(({ versions: v }) => v);
    expect(versions.map((v) => v['status'])).toEqual(['Active', 'Superseded']);
    expect(versions.at(-1)).toEqual(expect.objectContaining({ reason: 'NoLongerExpected', quantityBelowPlan: '40' }));
  }, 60_000);

  it('should cut the window at 10:30 with 60 entered when a Sell of 30 dated Monday 10:30 follows PC1 and PC2, put PC2 outside it, create a Shortfall of 40, and disclose the moved Entry Resolution Point', async () => {
    const d = await device(undefined, TUESDAY_1700);
    const app = await onboarded(d);
    const tradeId = await confirmReference(app);
    const pc1 = (await record(app, tradeId, PC1)).receipt.createdFactIds[0]!;
    const pc2 = (await record(app, tradeId, PC2)).receipt.createdFactIds[0]!;
    expect((await detailOf(app, tradeId)).entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc2 });

    const sold = await recordExit(app, tradeId, [EARLY_SELL_30]);
    const sellChange = sold.receipt.createdFactIds[0]!;
    expect(sold.receipt.entryChanges).toEqual([
      { kind: 'EntryResolutionMoved', from: pc2, to: pc1 },
      { kind: 'EntryQualityChanged', from: REFERENCE_ENTRY_QUALITY, to: PC1_ONLY_QUALITY },
    ]);
    expect(sold.receipt.deviationReconciliation).toEqual([
      { action: 'Create', occurrenceId: expect.any(String) as unknown, version: expect.objectContaining({ form: 'Shortfall', quantityBelowPlan: '40', causingPositionChangeId: sellChange, economicTime: MONDAY_1030, status: 'Active' }) as unknown },
    ]);

    const again = await restart(app, d);
    const detail = await detailOf(again, tradeId);
    expect(detail.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc1 });
    expect(detail.entryQuality).toEqual(PC1_ONLY_QUALITY);
    expect(detail.legFulfillment).toEqual([{ plannedLegId: detail.plan.legs[0]!.factId, fulfillment: 'FilledWithDeviation' }]);
    expect(detail.deviations).toEqual(await storedDeviations(d, tradeId));
    expect((await storedDeviations(d, tradeId)).map(({ versions }) => versions.map((v) => v['causingPositionChangeId']))).toEqual([[sellChange]]);
  }, 60_000);
});
