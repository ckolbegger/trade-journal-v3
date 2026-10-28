import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { evaluate, type ObservationFrame } from './evaluate.ts';
import { execution, PC1, PC2, PC3, positionChange, referenceRecord } from './reference-trade.ts';

const XYZ = { kind: 'Stock', symbol: 'XYZ' } as const;
// Monday 2026-10-12 closes at 16:00 America/New_York, which is 20:00Z.
const MONDAY_CLOSE = '2026-10-12T20:00:00Z';

function derivedState(record: TradeAnalysisRecord, cutoff?: string): DerivedTradeState {
  const result = derive({ record, ...(cutoff && { cutoff }) });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

function availableFrame(price: string, tradingDate = '2026-10-12', closeInstant = MONDAY_CLOSE): ObservationFrame {
  return {
    instrument: XYZ,
    tradingDate,
    closeInstant,
    resolution: { kind: 'Available', mark: { revisionId: 'mark-rev-1', revisionNumber: 1, price } },
  };
}

// A Calculation Result with its Rational shown as an exact fraction, so a failure names the value.
function exact(result: CalculationResult<Rational>) {
  return result.kind === 'Value' ? `${result.value.numerator}/${result.value.denominator}` : result;
}
const q = (n: bigint, d = 1n) => `${Rational.of(n, d).numerator}/${Rational.of(n, d).denominator}`;

describe('Mark-to-Market valuation (after PC2, Mark 52.00 for 2026-10-12)', () => {
  const evaluation = evaluate({ state: derivedState(referenceRecord([PC1, PC2])), frame: availableFrame('52.00') });

  it('should return valuation date 2026-10-12, coverage Available with the Mark revision, open quantity 100, open cost $5,018.00, unconsumed opening fees $2.00, and market value $5,200.00', () => {
    expect(evaluation.valuationDate).toBe('2026-10-12');
    expect(evaluation.coverage).toEqual({ kind: 'Available', revisionId: 'mark-rev-1', revisionNumber: 1 });
    expect(exact(evaluation.openQuantity)).toBe(q(100n));
    expect(exact(evaluation.openCost)).toBe(q(5018n));
    expect(exact(evaluation.unconsumedOpeningFees)).toBe(q(2n));
    expect(exact(evaluation.marketValue)).toBe(q(5200n));
  });

  it('should return remaining-open marked P&L $180.00, realized-to-date $0.00, Current Marked Trade P&L $180.00 (18/25 R), and incurred fees $2.00, each as its own Calculation Result', () => {
    expect(exact(evaluation.remainingOpenPnl)).toBe(q(180n));
    expect(exact(evaluation.realizedToDate)).toBe(q(0n));
    expect(exact(evaluation.currentMarkedPnl)).toBe(q(180n));
    expect(exact(evaluation.currentMarkedPnlInPlanR)).toBe(q(18n, 25n));
    expect(exact(evaluation.incurredFees)).toBe(q(2n));
  });

  it('should use the remaining Position after PC3 and return $199.00 at the same Mark (AC-CALC-001)', () => {
    const afterPc3 = evaluate({ state: derivedState(referenceRecord([PC1, PC2, PC3])), frame: availableFrame('52.00') });
    expect(exact(afterPc3.openQuantity)).toBe(q(120n));
    expect(exact(afterPc3.currentMarkedPnl)).toBe(q(199n));
    // Current risk follows the remaining Position: 120 x (52.00 - 47.50).
    expect(exact(afterPc3.ongoingRiskToStop)).toBe(q(540n));
  });
});

// Tuesday 2026-10-13 closes at 20:00Z.
const TUESDAY_CLOSE = '2026-10-13T20:00:00Z';

function missingFrame(stale?: { price: string }): ObservationFrame {
  return {
    instrument: XYZ,
    tradingDate: '2026-10-13',
    closeInstant: TUESDAY_CLOSE,
    resolution: {
      kind: 'Missing',
      ...(stale && {
        stale: { tradingDate: '2026-10-12', price: stale.price, revisionId: 'mark-rev-0', revisionNumber: 1, closeInstant: MONDAY_CLOSE },
      }),
    },
  };
}

const markMissing = { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument: XYZ, date: '2026-10-13' } } as const;

describe('Missing Mark (AC-CALC-002, single Instrument)', () => {
  const state = derivedState(referenceRecord([PC1, PC2]));

  it('should return the open component, Current Marked Trade P&L, and its Plan-R conversion as Unavailable(MarkMissing) naming XYZ and the frame date', () => {
    const evaluation = evaluate({ state, frame: missingFrame() });
    expect(evaluation.remainingOpenPnl).toEqual(markMissing);
    expect(evaluation.currentMarkedPnl).toEqual(markMissing);
    expect(evaluation.currentMarkedPnlInPlanR).toEqual(markMissing);
  });

  it('should keep realized-to-date, incurred fees, Plan Baseline, 1R, and Entry Quality as Values', () => {
    const evaluation = evaluate({ state, frame: missingFrame() });
    expect(exact(evaluation.realizedToDate)).toBe(q(0n));
    expect(exact(evaluation.incurredFees)).toBe(q(2n));
    expect(evaluation.planBaseline).toEqual({ kind: 'Value', value: state.baseline });
    expect(exact(evaluation.oneR)).toBe(q(250n));
    expect(state.entryQuality.kind).toBe('Value');
    expect(evaluation.entryQuality).toEqual(state.entryQuality);
  });

  it('should carry Stale context as disclosure only, so no current figure changes when its price changes', () => {
    const low = evaluate({ state, frame: missingFrame({ price: '49.00' }) });
    const high = evaluate({ state, frame: missingFrame({ price: '60.00' }) });
    expect(low.staleContext?.price).toBe('49.00');
    expect(high.staleContext?.price).toBe('60.00');
    const lowFigures = { ...low, staleContext: undefined };
    const highFigures = { ...high, staleContext: undefined };
    expect(lowFigures).toEqual(highFigures);
    // Without Stale context there is no exact Mark, so at-entry figures legitimately differ (B2).
    const withoutStale = evaluate({ state, frame: missingFrame() });
    expect({ ...lowFigures, atEntry: undefined }).toEqual({ ...withoutStale, staleContext: undefined, atEntry: undefined });
  });

  it('should return no covered subtotal for a single-Instrument Trade (A43)', () => {
    expect(evaluate({ state, frame: missingFrame() }).coveredSubtotal).toBeNull();
    expect(evaluate({ state, frame: availableFrame('52.00') }).coveredSubtotal).toBeNull();
  });

  it('should return Unavailable with reason AcknowledgedUnavailable for an acknowledged key, never a value', () => {
    const frame: ObservationFrame = {
      ...missingFrame({ price: '49.00' }),
      resolution: { kind: 'AcknowledgedUnavailable', stale: { tradingDate: '2026-10-12', price: '49.00', revisionId: 'mark-rev-0', revisionNumber: 1, closeInstant: MONDAY_CLOSE } },
    };
    const evaluation = evaluate({ state, frame });
    const acknowledged = { kind: 'Unavailable', reason: 'AcknowledgedUnavailable', detail: { instrument: XYZ, date: '2026-10-13' } };
    expect(evaluation.coverage).toEqual({ kind: 'AcknowledgedUnavailable' });
    expect(evaluation.marketValue).toEqual(acknowledged);
    expect(evaluation.remainingOpenPnl).toEqual(acknowledged);
    expect(evaluation.currentMarkedPnl).toEqual(acknowledged);
    expect(evaluation.currentMarkedPnlInPlanR).toEqual(acknowledged);
    expect(evaluation.ongoingRiskToStop).toEqual(acknowledged);
    expect(evaluation.staleContext?.price).toBe('49.00');
  });

  it('should return every current figure of a Planned Trade as NotApplicable with reason NoRemainingPosition', () => {
    const planned = evaluate({ state: derivedState(referenceRecord([])), frame: availableFrame('52.00') });
    const none = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };
    for (const figure of [
      planned.openQuantity, planned.openCost, planned.unconsumedOpeningFees, planned.marketValue, planned.remainingOpenPnl,
      planned.realizedToDate, planned.currentMarkedPnl, planned.currentMarkedPnlInPlanR, planned.incurredFees, planned.ongoingRiskToStop,
    ])
      expect(figure).toEqual(none);
  });
});

// PC2 (40 @ 50.30) dated Tuesday 10:00 America/New_York, after Monday's close.
const TUESDAY_PC2 = positionChange('pc-2', 3, [execution('ex-2', '2026-10-13T14:00:00Z', 4, '40', '50.30', '1.00')]);

describe("Lots opened after the frame's close (P12, A54)", () => {
  const state = derivedState(referenceRecord([PC1, TUESDAY_PC2]));
  const mondayFrame = availableFrame('52.00');

  it('should return current figures as Unavailable with reason AwaitingClose after 2026-10-12 when PC2 is dated Tuesday 10:00 and the frame is Monday\'s', () => {
    const evaluation = evaluate({ state, frame: mondayFrame });
    const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: '2026-10-12' } };
    expect(evaluation.marketValue).toEqual(awaiting);
    expect(evaluation.remainingOpenPnl).toEqual(awaiting);
    expect(evaluation.currentMarkedPnl).toEqual(awaiting);
    expect(evaluation.currentMarkedPnlInPlanR).toEqual(awaiting);
    expect(evaluation.ongoingRiskToStop).toEqual(awaiting);
  });

  it('should return at-entry figures for those 40 shares: average entry 50.30, risk from entry $112.00, reward from entry $228.00, labelled at entry', () => {
    const { atEntry } = evaluate({ state, frame: mondayFrame });
    expect(atEntry?.label).toBe('AtEntry');
    expect(exact({ kind: 'Value', value: atEntry!.quantity })).toBe(q(40n));
    expect(exact({ kind: 'Value', value: atEntry!.averageEntry })).toBe(q(5030n, 100n));
    expect(exact({ kind: 'Value', value: atEntry!.riskFromEntry })).toBe(q(112n));
    expect(exact({ kind: 'Value', value: atEntry!.rewardFromEntry })).toBe(q(228n));
    // Nothing opened after the close: no at-entry line.
    expect(evaluate({ state: derivedState(referenceRecord([PC1, PC2])), frame: mondayFrame }).atEntry).toBeNull();
  });

  it('should evaluate the state derived at Monday close with Monday Mark as the dated line: 60 shares, P&L $113.00, risk to stop $270.00, worst case $3,120.00, reward $240.00', () => {
    const dated = evaluate({ state: derivedState(referenceRecord([PC1, TUESDAY_PC2]), MONDAY_CLOSE), frame: mondayFrame });
    expect(exact(dated.openQuantity)).toBe(q(60n));
    expect(exact(dated.currentMarkedPnl)).toBe(q(113n));
    expect(exact(dated.ongoingRiskToStop)).toBe(q(270n));
    expect(exact(dated.worstCaseOngoingRisk)).toBe(q(3120n));
    expect(exact(dated.incrementalRewardToTarget)).toBe(q(240n));
    expect(dated.atEntry).toBeNull();
  });
});

describe('dated last close with a Missing Mark (P13, A54)', () => {
  it('should, given only a Friday Mark and Monday fills, return no dated line (no exposure at Friday close) and at-entry figures for all 100 shares: risk from entry $268.00, reward from entry $582.00', () => {
    const fridayClose = '2026-10-09T20:00:00Z';
    const fridayFrame = availableFrame('51.00', '2026-10-09', fridayClose);
    const record = referenceRecord([PC1, PC2]);
    // The state derived at Friday's close holds no Position, so there is no dated line.
    expect(evaluate({ state: derivedState(record, fridayClose), frame: fridayFrame }).openQuantity).toEqual({
      kind: 'NotApplicable',
      reason: 'NoRemainingPosition',
    });
    const { atEntry, currentMarkedPnl } = evaluate({ state: derivedState(record), frame: fridayFrame });
    expect(currentMarkedPnl).toEqual({ kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: '2026-10-09' } });
    expect(exact({ kind: 'Value', value: atEntry!.quantity })).toBe(q(100n));
    expect(exact({ kind: 'Value', value: atEntry!.riskFromEntry })).toBe(q(268n));
    expect(exact({ kind: 'Value', value: atEntry!.rewardFromEntry })).toBe(q(582n));
  });

  it('should return at-entry figures for Lots opened after the Stale context close when the frame is Missing', () => {
    const missingFrame: ObservationFrame = {
      instrument: XYZ,
      tradingDate: '2026-10-12',
      closeInstant: MONDAY_CLOSE,
      resolution: {
        kind: 'Missing',
        stale: { tradingDate: '2026-10-09', price: '51.00', revisionId: 'mark-rev-0', revisionNumber: 1, closeInstant: '2026-10-09T20:00:00Z' },
      },
    };
    const { atEntry } = evaluate({ state: derivedState(referenceRecord([PC1, PC2])), frame: missingFrame });
    expect(exact({ kind: 'Value', value: atEntry!.quantity })).toBe(q(100n));
    expect(exact({ kind: 'Value', value: atEntry!.riskFromEntry })).toBe(q(268n));
    expect(exact({ kind: 'Value', value: atEntry!.rewardFromEntry })).toBe(q(582n));
  });

  it('should return at-entry figures for every remaining Lot when the frame is Missing without Stale context', () => {
    const missingFrame: ObservationFrame = { instrument: XYZ, tradingDate: '2026-10-12', closeInstant: MONDAY_CLOSE, resolution: { kind: 'Missing' } };
    const { atEntry } = evaluate({ state: derivedState(referenceRecord([PC1, PC2])), frame: missingFrame });
    expect(exact({ kind: 'Value', value: atEntry!.quantity })).toBe(q(100n));
    expect(exact({ kind: 'Value', value: atEntry!.riskFromEntry })).toBe(q(268n));
    expect(exact({ kind: 'Value', value: atEntry!.rewardFromEntry })).toBe(q(582n));
  });
});

describe('A frame for a different Instrument', () => {
  it('should return the Mark-dependent figures as Unavailable MarkMissing naming the Position Instrument when the frame is for a different Instrument', () => {
    const state = derivedState(referenceRecord([PC1, PC2]));
    const abcFrame: ObservationFrame = { ...availableFrame('52.00'), instrument: { kind: 'Stock', symbol: 'ABC' } };
    const evaluation = evaluate({ state, frame: abcFrame });
    const missing = { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument: XYZ, date: '2026-10-12' } };
    expect(evaluation.marketValue).toEqual(missing);
    expect(evaluation.remainingOpenPnl).toEqual(missing);
    expect(evaluation.currentMarkedPnl).toEqual(missing);
    expect(evaluation.currentMarkedPnlInPlanR).toEqual(missing);
    expect(evaluation.ongoingRiskToStop).toEqual(missing);
    expect(evaluation.worstCaseOngoingRisk).toEqual(missing);
    expect(evaluation.incrementalRewardToTarget).toEqual(missing);
    expect(exact(evaluation.openQuantity)).toBe(q(100n));
    expect(exact(evaluation.openCost)).toBe(q(5018n));
    expect(exact(evaluation.unconsumedOpeningFees)).toBe(q(2n));
    expect(exact(evaluation.realizedToDate)).toBe(q(0n));
    expect(exact(evaluation.incurredFees)).toBe(q(2n));
  });

  it('should report coverage as Missing, with no Stale context, when the frame is for a different Instrument', () => {
    const state = derivedState(referenceRecord([PC1, PC2]));
    const abc = { kind: 'Stock', symbol: 'ABC' } as const;
    const available = evaluate({ state, frame: { ...availableFrame('52.00'), instrument: abc } });
    expect(available.coverage).toEqual({ kind: 'Missing' });
    const missingWithStale = evaluate({ state, frame: { ...missingFrame({ price: '49.00' }), instrument: abc } });
    expect(missingWithStale.coverage).toEqual({ kind: 'Missing' });
    expect(missingWithStale.staleContext).toBeUndefined();
  });

  it('should return at-entry figures for every remaining Lot when the frame is for a different Instrument', () => {
    const state = derivedState(referenceRecord([PC1, PC2]));
    const abcFrame: ObservationFrame = { ...availableFrame('52.00', '2026-10-13', TUESDAY_CLOSE), instrument: { kind: 'Stock', symbol: 'ABC' } };
    const { atEntry } = evaluate({ state, frame: abcFrame });
    expect(atEntry?.label).toBe('AtEntry');
    expect(exact({ kind: 'Value', value: atEntry!.quantity })).toBe(q(100n));
    expect(exact({ kind: 'Value', value: atEntry!.averageEntry })).toBe(q(5018n, 100n));
    expect(exact({ kind: 'Value', value: atEntry!.riskFromEntry })).toBe(q(268n));
    expect(exact({ kind: 'Value', value: atEntry!.rewardFromEntry })).toBe(q(582n));
  });
});
