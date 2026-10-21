// AC-CALC-001 for I2.6 (acceptance matrix): 1R stays frozen and Entry Quality resolves once and is
// not rewritten by a later add, for the reference Trade and for a 200-share Plan (1R $500).
import { describe, expect, it } from 'vitest';
import { complete, confirmReference, dec, decline, device, onboarded, PC1, PC2, PC3, record, REFERENCE_ENTRY_QUALITY, restart } from './support.ts';

// The 200-share Plan filled with twice each reference fill: 120, then 80, then 40 outside the window.
const DOUBLED_ENTRY_QUALITY = {
  kind: 'Value',
  value: {
    averageEntry: { kind: 'Value', value: dec('50.18') },
    windowQuantity: { kind: 'Value', value: dec('200') },
    windowFees: { kind: 'Value', value: dec('2.00') },
    actualInitialRisk: { kind: 'Value', value: dec('538.00') },
    actualInitialReward: { kind: 'Value', value: dec('1162.00') },
    riskInPlanR: { kind: 'Value', value: dec('538').div(dec('500')) },
    slippage: { kind: 'Value', value: dec('36.00') },
    sizeRatio: { kind: 'Value', value: dec('1') },
    plannedRewardRisk: { kind: 'Value', value: dec('2.4') },
    actualRewardRisk: { kind: 'Value', value: dec('1162').div(dec('538')) },
    flags: [],
  },
};

const twice = (fill: typeof PC1) => ({ ...fill, quantity: String(Number(fill.quantity) * 2) });

describe('I2.6 Entry Quality and 1R (AC-CALC-001)', () => {
  for (const [name, quantity, oneR, scale, expected] of [
    ['the reference Trade', '100', '250', (f: typeof PC1) => f, REFERENCE_ENTRY_QUALITY],
    ['a 200-share Plan', '200', '500', twice, DOUBLED_ENTRY_QUALITY],
  ] as const) {
    it(`should keep 1R and the Entry Quality resolved at PC2 unchanged after PC3 and a restart, for ${name}`, async () => {
      const d = await device();
      const app = await onboarded(d);
      const tradeId = await confirmReference(app, 'XYZ', quantity);
      await record(app, tradeId, scale(PC1), await complete(app));
      const resolved = await record(app, tradeId, scale(PC2), await complete(app));
      expect(resolved.postCommit.derivation.baseline.oneR).toEqual(dec(oneR));
      expect(resolved.postCommit.derivation.entryQuality).toEqual(expected);
      const added = await record(app, tradeId, scale(PC3), await decline(app));
      expect(added.receipt.entryChanges).toEqual([]);

      const again = await restart(app, d);
      const detail = await again.TradeViewsAndReporting.getTradeDetail({ tradeId });
      if (detail.kind !== 'Ready' || !('positionChanges' in detail.view)) throw new Error('expected the Open form of Detail');
      expect(detail.view.baseline.oneR).toEqual(dec(oneR));
      expect(detail.view.entryResolution).toEqual(resolved.postCommit.derivation.entryResolution);
      expect(detail.view.entryQuality).toEqual(expected);
    });
  }
});
