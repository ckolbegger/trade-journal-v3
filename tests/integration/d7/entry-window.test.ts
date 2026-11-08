// An option exit cuts the Entry window and discloses the Entry Size shortfall (D6's Entry window rules applied to an
// option Plan; the case I7.4 could not build). With O-S's S1 selling both planned contracts, no exit can precede the
// Plan's last entry, and with O-C's two contracts an exit between the entries would leave the Position flat
// (FlatBeforeLaterFacts) or close the Trade. So this case uses the O-C terms with 3 contracts: PC1 Buy 2, PC2 Buy 1 and
// an exit Sell 1 dated between them. The Plan quantity 3 is this test's reading of "the nearest reading".
import { describe, expect, it } from 'vitest';
import type { Application } from '../../../src/app/compose.ts';
import { Rational } from '../../../src/domain/values/index.ts';
import {
  dec, detailOf, dumpAll, MONDAY_1030, onboardedAt, optionPlanCommand, recordOption, restart, TUESDAY_1700, workspaceStores, type Device, type Fill,
} from './support.ts';

// 3 planned contracts; PC1 buys 2 (Monday 10:00) and PC2 buys 1 (Monday 11:00); the exit sells 1 at Monday 10:30, between them.
const PC1: Fill = { quantity: '2', price: '2.10', economicTime: '2026-10-12T14:00:00Z', fee: '0.65' };
const PC2: Fill = { quantity: '1', price: '1.90', economicTime: '2026-10-12T15:00:00Z', fee: '0.65' };
const EXIT: Fill = { quantity: '1', price: '3.00', economicTime: MONDAY_1030, fee: '0.65' };
const value = (text: string) => ({ kind: 'Value', value: dec(text) });

// Entry Quality over PC1 alone: 2 of 3 contracts at 2.10, fee 0.65, against the Stop value 0 and the Target value 5.00.
const PC1_ONLY_QUALITY = {
  kind: 'Value',
  value: expect.objectContaining({
    windowQuantity: value('2'),
    windowFees: value('0.65'),
    actualInitialRisk: value('420.65'),
    actualInitialReward: value('579.35'),
    sizeRatio: { kind: 'Value', value: Rational.of(2n, 3n) },
    riskInPlanR: { kind: 'Value', value: Rational.of(8413n, 12000n) },
    slippage: value('20.00'),
  }) as unknown,
};
// Over PC1 and PC2: all 3 contracts, average entry 61/30, risk 611.30, reward 888.70.
const ALL_THREE_QUALITY = {
  kind: 'Value',
  value: expect.objectContaining({
    windowQuantity: value('3'),
    windowFees: value('1.30'),
    actualInitialRisk: value('611.30'),
    actualInitialReward: value('888.70'),
    sizeRatio: { kind: 'Value', value: Rational.of(1n) },
    riskInPlanR: { kind: 'Value', value: Rational.of(6113n, 6000n) },
  }) as unknown,
};

// A confirmed 3-contract Long Call on Tuesday 17:00.
async function threeContractCall() {
  const { d, app } = await onboardedAt(TUESDAY_1700);
  const command = await optionPlanCommand(app, 'O-C');
  const confirmed = await app.TradeWorkflows.confirmPlan({ ...command, plan: { ...command.plan, legs: [{ ...command.plan.legs[0]!, quantity: '3' }] } });
  if (confirmed.kind !== 'Confirmed') throw new Error(`confirmPlan: ${JSON.stringify(confirmed)}`);
  return { d, app, tradeId: confirmed.receipt.tradeId };
}

// The recorded Deviation occurrences of the stored Trade, with every version.
async function storedDeviations(d: Device, tradeId: string) {
  const trades = workspaceStores(await dumpAll(d.factory))['trades'] as { tradeId: string; deviations: { occurrenceId: string; versions: Record<string, unknown>[] }[] }[];
  return trades.find((t) => t.tradeId === tradeId)!.deviations;
}

async function openDetail(app: Application, tradeId: string) {
  const view = await detailOf(app, tradeId);
  if (!('entryQuality' in view)) throw new Error('expected an Open or Closed Detail');
  return view;
}

describe('Entry window cut by an option exit', () => {
  it('should cut the window at an exit Sell 1 dated Monday 10:30 after PC1 and PC2, put PC2 outside it, create a Shortfall of 1 contract, and disclose the moved Entry Resolution Point, the Entry Quality and the Lot Match in the receipt', async () => {
    const { d, app, tradeId } = await threeContractCall();
    const pc1 = (await recordOption(app, tradeId, 'Buy', PC1)).receipt.createdFactIds[0]!;
    const pc2 = (await recordOption(app, tradeId, 'Buy', PC2)).receipt.createdFactIds[0]!;
    expect((await openDetail(app, tradeId)).entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc2 });
    expect((await openDetail(app, tradeId)).entryQuality).toEqual(ALL_THREE_QUALITY);

    const sold = await recordOption(app, tradeId, 'Sell', EXIT);
    const exit = sold.receipt.createdFactIds[0]!;
    expect(sold.receipt.entryChanges).toEqual([
      { kind: 'EntryResolutionMoved', from: pc2, to: pc1 },
      { kind: 'EntryQualityChanged', from: ALL_THREE_QUALITY, to: PC1_ONLY_QUALITY },
    ]);
    expect(sold.receipt.deviationReconciliation).toEqual([
      {
        action: 'Create',
        occurrenceId: expect.any(String) as unknown,
        version: expect.objectContaining({ type: 'EntrySize', form: 'Shortfall', quantityBelowPlan: '1', causingPositionChangeId: exit, economicTime: MONDAY_1030, status: 'Active' }) as unknown,
      },
    ]);
    // The exit sells from PC1's Lot first (FIFO over the effective facts), so one link is created.
    expect(sold.receipt.lotMatchChanges).toEqual([
      expect.objectContaining({ kind: 'Created', openingExecutionId: expect.any(String) as unknown, quantity: { before: null, after: dec('1') } }),
    ]);

    // After restart the Detail says the same: resolved at PC1, filled with a Deviation, the stored Shortfall equal to the Detail's.
    const detail = await openDetail(await restart(app, d), tradeId);
    expect(detail.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc1 });
    expect(detail.entryQuality).toEqual(PC1_ONLY_QUALITY);
    expect(detail.legFulfillment).toEqual([{ plannedLegId: detail.plan.legs[0]!.factId, fulfillment: 'FilledWithDeviation' }]);
    expect(detail.deviations).toEqual(await storedDeviations(d, tradeId));
    expect((await storedDeviations(d, tradeId)).map(({ versions }) => versions.map((v) => v['causingPositionChangeId']))).toEqual([[exit]]);
  }, 60_000);

  it('should create the Shortfall of 1 when the exit Sell 1 follows PC1, and leave it and the window unmoved when PC2, dated after the exit, is recorded later', async () => {
    const { d, app, tradeId } = await threeContractCall();
    const pc1 = (await recordOption(app, tradeId, 'Buy', PC1)).receipt.createdFactIds[0]!;
    expect((await openDetail(app, tradeId)).entryResolution).toEqual({ kind: 'Unresolved' });

    const sold = await recordOption(app, tradeId, 'Sell', EXIT);
    const exit = sold.receipt.createdFactIds[0]!;
    expect(sold.receipt.deviationReconciliation).toEqual([
      { action: 'Create', occurrenceId: expect.any(String) as unknown, version: expect.objectContaining({ form: 'Shortfall', quantityBelowPlan: '1', causingPositionChangeId: exit, status: 'Active' }) as unknown },
    ]);
    const cut = await openDetail(app, tradeId);
    expect(cut.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc1 });
    expect(cut.entryQuality).toEqual(PC1_ONLY_QUALITY);

    // PC2 is dated after the exit, so it falls outside the window: nothing in the entry or the Deviations moves.
    const later = await recordOption(app, tradeId, 'Buy', PC2);
    expect(later.receipt.entryChanges).toEqual([]);
    // The reconciliation restates the one Shortfall as retained: nothing created, superseded or moved.
    const created = sold.receipt.deviationReconciliation[0]!;
    expect(later.receipt.deviationReconciliation).toEqual([{ action: 'Retain', occurrenceId: created.occurrenceId, version: created.version }]);
    const detail = await openDetail(await restart(app, d), tradeId);
    expect(detail.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: pc1 });
    expect(detail.entryQuality).toEqual(PC1_ONLY_QUALITY);
    expect(detail.deviations).toEqual(await storedDeviations(d, tradeId));
    expect(detail.deviations).toHaveLength(1);
  }, 60_000);
});
