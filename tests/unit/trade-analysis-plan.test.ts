import { describe, expect, it } from 'vitest';
import { assessLongStockPlan } from '../../src/trade-analysis/assess-plan';
import { toMoneyString, toRatioString } from '../../src/shared/exact-number';

describe('TradeAnalysis.assessPlan (Long Stock) seam', () => {
  it('computes exact 1R, Original Planned Reward, and Planned R:R for a valid Long Stock plan', () => {
    const res = assessLongStockPlan({
      symbol: ' aapl ',
      quantity: '100',
      intendedEntryPrice: '185.50',
      stopPrice: '178.00',
      targetPrice: '208.00',
    });

    expect(res.status).toBe('Accepted');
    if (res.status !== 'Accepted') return;
    expect(res.normalizedSymbol).toBe('AAPL');
    expect(toMoneyString(res.baseline.originalPlannedRisk)).toBe('$750.00');
    expect(toMoneyString(res.baseline.originalPlannedReward)).toBe('$2,250.00');
    expect(toRatioString(res.baseline.plannedRewardToRisk)).toBe('3.00R');
  });

  it('returns typed field-level rejections for incoherent Stop/Target, non-positive quantity, or missing symbol', () => {
    const stopAboveEntry = assessLongStockPlan({
      symbol: 'MSFT',
      quantity: '50',
      intendedEntryPrice: '400',
      stopPrice: '405',
      targetPrice: '430',
    });
    expect(stopAboveEntry.status).toBe('Rejected');
    if (stopAboveEntry.status === 'Rejected') {
      expect(stopAboveEntry.errors.some((e) => e.field === 'stopPrice')).toBe(true);
    }

    const targetBelowEntry = assessLongStockPlan({
      symbol: 'MSFT',
      quantity: '50',
      intendedEntryPrice: '400',
      stopPrice: '390',
      targetPrice: '395',
    });
    expect(targetBelowEntry.status).toBe('Rejected');
    if (targetBelowEntry.status === 'Rejected') {
      expect(targetBelowEntry.errors.some((e) => e.field === 'targetPrice')).toBe(true);
    }

    const badQty = assessLongStockPlan({
      symbol: '',
      quantity: '0',
      intendedEntryPrice: '100',
      stopPrice: '95',
      targetPrice: '115',
    });
    expect(badQty.status).toBe('Rejected');
    if (badQty.status === 'Rejected') {
      expect(badQty.errors.map((e) => e.field)).toEqual(
        expect.arrayContaining(['symbol', 'quantity']),
      );
    }
  });

  it('rejects equal Stop/Target prices, negative/malformed numbers, invalid symbols, and accepts exact fractional quantities', () => {
    const equalLines = assessLongStockPlan({
      symbol: 'BRK.B',
      quantity: '10',
      intendedEntryPrice: '400',
      stopPrice: '400',
      targetPrice: '400',
    });
    expect(equalLines.status).toBe('Rejected');
    if (equalLines.status === 'Rejected') {
      expect(equalLines.errors.map((e) => e.field)).toEqual(
        expect.arrayContaining(['stopPrice', 'targetPrice']),
      );
    }

    const negativeAndBadSymbol = assessLongStockPlan({
      symbol: 'TOOLONGSYMBOL1',
      quantity: '-5',
      intendedEntryPrice: '-10',
      stopPrice: 'abc',
      targetPrice: '0',
    });
    expect(negativeAndBadSymbol.status).toBe('Rejected');
    if (negativeAndBadSymbol.status === 'Rejected') {
      expect(negativeAndBadSymbol.errors.map((e) => e.field)).toEqual(
        expect.arrayContaining(['symbol', 'quantity', 'intendedEntryPrice', 'stopPrice', 'targetPrice']),
      );
    }

    const fractional = assessLongStockPlan({
      symbol: 'brk.b',
      quantity: '12.5',
      intendedEntryPrice: '100.00',
      stopPrice: '92.00',
      targetPrice: '124.00',
    });
    expect(fractional.status).toBe('Accepted');
    if (fractional.status === 'Accepted') {
      expect(fractional.normalizedSymbol).toBe('BRK.B');
      expect(fractional.baseline.originalPlannedRiskDisplay).toBe('$100.00');
      expect(fractional.baseline.originalPlannedRewardDisplay).toBe('$300.00');
      expect(fractional.baseline.plannedRewardToRiskDisplay).toBe('3.00R');
    }
  });
});
