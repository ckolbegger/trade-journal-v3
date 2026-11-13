import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult, type DerivedTradeState, type TradeAnalysisRecord } from './index.ts';
import { evaluate, type ObservationFrame } from './evaluate.ts';
import { OS2_CONTRACT, OS2_S1, os2Record } from './option-trade.ts';
import { execution, PC1, PC2, PC3, positionChange, referenceRecord, X1 } from './reference-trade.ts';

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

describe('realized-to-date in current figures (A92)', () => {
  const evaluation = evaluate({
    state: derivedState(referenceRecord([PC1, PC2, X1])),
    frame: availableFrame('52.50', '2026-10-13', TUESDAY_CLOSE),
  });

  it('should return realized-to-date 55.90, remaining-open marked P&L 158.50, Current Marked Trade P&L 214.40 at 536/625 R, incurred fees 2.60, and on the remaining 70 shares Ongoing Risk to Stop 350.00, Worst-Case 3675.00, and Incremental Reward to Target 245.00', () => {
    expect(exact(evaluation.openQuantity)).toBe(q(70n));
    expect(exact(evaluation.realizedToDate)).toBe(q(5590n, 100n));
    expect(exact(evaluation.remainingOpenPnl)).toBe(q(15850n, 100n));
    expect(exact(evaluation.currentMarkedPnl)).toBe(q(21440n, 100n));
    expect(exact(evaluation.currentMarkedPnlInPlanR)).toBe(q(536n, 625n));
    expect(exact(evaluation.incurredFees)).toBe(q(260n, 100n));
    expect(exact(evaluation.ongoingRiskToStop)).toBe(q(350n));
    expect(exact(evaluation.worstCaseOngoingRisk)).toBe(q(3675n));
    expect(exact(evaluation.incrementalRewardToTarget)).toBe(q(245n));
  });
});

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

const markMissing = { kind: 'Unavailable', reason: 'MarkMissing', instrument: XYZ, date: '2026-10-13' } as const;

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
    const acknowledged = { kind: 'Unavailable', reason: 'AcknowledgedUnavailable', instrument: XYZ, date: '2026-10-13' };
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
    const awaiting = { kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-12' };
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

describe('at-entry figures in Plan R (decision 105)', () => {
  it('should give the at-entry risk from entry in Plan R, the risk from entry divided by the Plan 1R', () => {
    const { atEntry } = evaluate({ state: derivedState(referenceRecord([PC1, TUESDAY_PC2])), frame: availableFrame('52.00') });
    // $112.00 over a 1R of $250.00.
    expect(exact({ kind: 'Value', value: atEntry!.riskFromEntryInPlanR })).toBe(q(56n, 125n));
    expect(exact({ kind: 'Value', value: atEntry!.riskFromEntry })).toBe(q(112n));
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
    expect(currentMarkedPnl).toEqual({ kind: 'Unavailable', reason: 'AwaitingClose', after: '2026-10-09' });
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
    const missing = { kind: 'Unavailable', reason: 'MarkMissing', instrument: XYZ, date: '2026-10-12' };
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

describe('ongoing risk and reward (Mark 52.00)', () => {
  const state = derivedState(referenceRecord([PC1, PC2]));

  it('should return Ongoing Risk to Stop $450.00 (9/5 R), Worst-Case Ongoing Risk $5,200.00 (104/5 R), Incremental Reward to Target $400.00 (8/5 R), and Maximum Incremental Reward Unbounded Above', () => {
    const evaluation = evaluate({ state, frame: availableFrame('52.00') });
    expect(exact(evaluation.ongoingRiskToStop)).toBe(q(450n));
    expect(exact(evaluation.ongoingRiskToStopInPlanR)).toBe(q(9n, 5n));
    expect(exact(evaluation.worstCaseOngoingRisk)).toBe(q(5200n));
    expect(exact(evaluation.worstCaseOngoingRiskInPlanR)).toBe(q(104n, 5n));
    expect(exact(evaluation.incrementalRewardToTarget)).toBe(q(400n));
    expect(exact(evaluation.incrementalRewardToTargetInPlanR)).toBe(q(8n, 5n));
    expect(evaluation.maximumIncrementalReward).toMatchObject({ kind: 'Unbounded', direction: 'Above' });
  });

  it('should return Maximum Incremental Reward Unbounded Above when the Mark is Missing, and the other three as Unavailable MarkMissing', () => {
    const evaluation = evaluate({ state, frame: missingFrame() });
    expect(evaluation.maximumIncrementalReward).toMatchObject({ kind: 'Unbounded', direction: 'Above' });
    for (const figure of [evaluation.ongoingRiskToStop, evaluation.worstCaseOngoingRisk, evaluation.incrementalRewardToTarget]) {
      expect(figure).toEqual(markMissing);
    }
    for (const figure of [evaluation.ongoingRiskToStopInPlanR, evaluation.worstCaseOngoingRiskInPlanR, evaluation.incrementalRewardToTargetInPlanR]) {
      expect(figure).toEqual(markMissing);
    }
  });
});

describe('Stop crossed (Mark 47.00)', () => {
  const state = derivedState(referenceRecord([PC1, PC2]));
  const stopOf = (e: ReturnType<typeof evaluate>) => e.conditions.find((c) => c.role === 'Stop')!;

  it('should report the Stop Breached, Ongoing Risk to Stop $0.00, Stop Overrun $50.00 (1/5 R), Worst-Case $4,700.00, Incremental Reward $900.00, and Current Marked Trade P&L -$320.00 (-32/25 R)', () => {
    const evaluation = evaluate({ state, frame: availableFrame('47.00') });
    const stop = stopOf(evaluation);
    if (stop.result.kind !== 'Value') throw new Error('expected a Value');
    expect(stop.result.value.status).toBe('Breached');
    expect(exact(evaluation.ongoingRiskToStop)).toBe(q(0n));
    expect(exact(evaluation.ongoingRiskToStopInPlanR)).toBe(q(0n));
    expect(stop.result.value.overrun && exact({ kind: 'Value', value: stop.result.value.overrun.dollars })).toBe(q(50n));
    expect(stop.result.value.overrun && exact({ kind: 'Value', value: stop.result.value.overrun.planR })).toBe(q(1n, 5n));
    expect(exact(evaluation.worstCaseOngoingRisk)).toBe(q(4700n));
    expect(exact(evaluation.incrementalRewardToTarget)).toBe(q(900n));
    expect(exact(evaluation.currentMarkedPnl)).toBe(q(-320n));
    expect(exact(evaluation.currentMarkedPnlInPlanR)).toBe(q(-32n, 25n));
  });

  it('should report a Mark of exactly 47.50 as Breached with Overrun $0.00 (A42)', () => {
    const stop = stopOf(evaluate({ state, frame: availableFrame('47.50') }));
    if (stop.result.kind !== 'Value') throw new Error('expected a Value');
    expect(stop.result.value.status).toBe('Breached');
    expect(stop.result.value.overrun && exact({ kind: 'Value', value: stop.result.value.overrun.dollars })).toBe(q(0n));
    // Just above the Stop it is still Active with no Overrun.
    const above = stopOf(evaluate({ state, frame: availableFrame('47.51') }));
    expect(above.result.kind === 'Value' && [above.result.value.status, above.result.value.overrun]).toEqual(['Active', null]);
  });

  it('should return no Deviation occurrence (A44)', () => {
    expect(evaluate({ state, frame: availableFrame('47.00') }).deviations).toEqual([]);
  });
});

describe('Target reached (Mark 57.00)', () => {
  const state = derivedState(referenceRecord([PC1, PC2]));
  const targetOf = (e: ReturnType<typeof evaluate>) => e.conditions.find((c) => c.role === 'Target')!;

  it('should report the Target Reached, Incremental Reward to Target $0.00, Target Overrun $100.00 (2/5 R), and Ongoing Risk to Stop $950.00 (19/5 R)', () => {
    const evaluation = evaluate({ state, frame: availableFrame('57.00') });
    const target = targetOf(evaluation);
    if (target.result.kind !== 'Value') throw new Error('expected a Value');
    expect(target.result.value.status).toBe('Reached');
    expect(exact(evaluation.incrementalRewardToTarget)).toBe(q(0n));
    expect(exact(evaluation.incrementalRewardToTargetInPlanR)).toBe(q(0n));
    expect(target.result.value.overrun && exact({ kind: 'Value', value: target.result.value.overrun.dollars })).toBe(q(100n));
    expect(target.result.value.overrun && exact({ kind: 'Value', value: target.result.value.overrun.planR })).toBe(q(2n, 5n));
    expect(exact(evaluation.ongoingRiskToStop)).toBe(q(950n));
    expect(exact(evaluation.ongoingRiskToStopInPlanR)).toBe(q(19n, 5n));
  });

  it('should not classify the reached Target as a Deviation (AC-CALC-003)', () => {
    const evaluation = evaluate({ state, frame: availableFrame('57.00') });
    expect(evaluation.conditions.find((c) => c.role === 'Target')!.result).toMatchObject({ value: { status: 'Reached' } });
    expect(evaluation.deviations).toEqual([]);
  });
});

describe('per-condition status', () => {
  const state = derivedState(referenceRecord([PC1, PC2]));

  it('should return each Stop and Target condition with its identity, kind UnderlyingPrice, boundary, status, distance in dollars and Plan R, Overrun when crossed, and its evidence', () => {
    const evidence = { instrument: XYZ, date: '2026-10-12', mark: { revisionId: 'mark-rev-1', revisionNumber: 1, price: '52.00' } };
    const [stop, target] = evaluate({ state, frame: availableFrame('52.00') }).conditions;
    expect(stop).toMatchObject({ id: 'stop-1', role: 'Stop', kind: 'UnderlyingPrice', boundary: '47.5' });
    expect(target).toMatchObject({ id: 'target-1', role: 'Target', kind: 'UnderlyingPrice', boundary: '56' });
    const reading = (c: typeof stop) => (c!.result.kind === 'Value' ? c!.result.value : null);
    expect(reading(stop)!.status).toBe('Active');
    expect(reading(stop)!.overrun).toBeNull();
    expect(reading(stop)!.evidence).toEqual(evidence);
    expect(exact({ kind: 'Value', value: reading(stop)!.distance.dollars })).toBe(q(450n));
    expect(exact({ kind: 'Value', value: reading(stop)!.distance.planR })).toBe(q(9n, 5n));
    expect(reading(target)!.status).toBe('Active');
    expect(reading(target)!.evidence).toEqual(evidence);
    expect(exact({ kind: 'Value', value: reading(target)!.distance.dollars })).toBe(q(400n));
    expect(exact({ kind: 'Value', value: reading(target)!.distance.planR })).toBe(q(8n, 5n));
  });

  it('should return each condition as Unavailable with the Mark reason when the Mark is Missing or acknowledged', () => {
    const missing = evaluate({ state, frame: missingFrame() });
    expect(missing.conditions.map((c) => c.result)).toEqual([markMissing, markMissing]);
    const acknowledged = evaluate({ state, frame: { ...missingFrame(), resolution: { kind: 'AcknowledgedUnavailable' } } });
    expect(acknowledged.conditions.map((c) => c.result)).toEqual([
      { ...markMissing, reason: 'AcknowledgedUnavailable' },
      { ...markMissing, reason: 'AcknowledgedUnavailable' },
    ]);
  });

  it('should return the observation binding it used and deep-equal results for identical inputs', () => {
    const input = { state, frame: availableFrame('52.00') };
    const first = evaluate(input);
    expect(first.observation).toEqual({ instrument: XYZ, tradingDate: '2026-10-12', mark: { revisionId: 'mark-rev-1', revisionNumber: 1, price: '52.00' } });
    expect(evaluate(input)).toEqual(first);
    expect(evaluate({ state, frame: missingFrame() }).observation).toEqual({ instrument: XYZ, tradingDate: '2026-10-13', mark: null });
  });
});

describe('observation binding', () => {
  const consulted = { instrument: XYZ, tradingDate: '2026-10-12' };

  it('should bind no Mark when the frame is for a different Instrument', () => {
    const state = derivedState(referenceRecord([PC1, PC2]));
    const abc = { kind: 'Stock', symbol: 'ABC' } as const;
    const { observation } = evaluate({ state, frame: { ...availableFrame('52.00'), instrument: abc } });
    expect(observation).toEqual({ instrument: abc, tradingDate: '2026-10-12', mark: null });
  });

  it('should bind no Mark when a Lot opened after the frame close', () => {
    const state = derivedState(referenceRecord([PC1, TUESDAY_PC2]));
    expect(evaluate({ state, frame: availableFrame('52.00') }).observation).toEqual({ ...consulted, mark: null });
  });

  it('should bind no Mark when no Position remains', () => {
    const state = derivedState(referenceRecord([]));
    expect(evaluate({ state, frame: availableFrame('52.00') }).observation).toEqual({ ...consulted, mark: null });
  });
});

// The card fixture's Trades (plan, fills, and Mark of the breakdown, section 4), built in the style of the
// reference Trade so these cases need no stack.
function cardTrade(symbol: string, stop: string, target: string, entry: string, fills: readonly (readonly [string, string, string])[]): DerivedTradeState {
  const instrument = { kind: 'Stock', symbol } as const;
  const changes = fills.map(([time, quantity, price], i) =>
    positionChange(`pc-${i + 1}`, 2 * i + 1, [{ ...execution(`ex-${i + 1}`, time, 2 * i + 2, quantity, price, '1.00'), instrument }]),
  );
  const record = referenceRecord(changes);
  return derivedState({
    ...record,
    plan: {
      ...record.plan,
      underlying: symbol,
      legs: [{ factId: 'leg-1', side: 'Long', instrument, quantity: '100', intendedEntry: entry }],
      stops: [{ factId: 'stop-1', kind: 'UnderlyingPrice', price: stop }],
      targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: target }],
    },
  });
}
// T-A: PC1 Friday 2026-10-09 10:00 and PC2 Monday 11:00; the others fill Monday 10:00.
const T_A = () => cardTrade('XYZ', '47.5', '56', '50', [['2026-10-09T14:00:00Z', '60', '50.10'], ['2026-10-12T15:00:00Z', '40', '50.30']]);
const T_B = () => cardTrade('ABC', '28', '36', '30', [['2026-10-12T14:00:00Z', '100', '30.00']]);
const T_C = () => cardTrade('DEF', '38', '46', '40', [['2026-10-12T14:00:00Z', '100', '40.00']]);
const T_E = () => cardTrade('JKL', '19', '30', '20', [['2026-10-12T14:00:00Z', '100', '20.00']]);
const mondayFrame = (symbol: string, price: string): ObservationFrame => ({ ...availableFrame(price), instrument: { kind: 'Stock', symbol } });

describe('Reward : risk now (P40)', () => {
  it('should return Incremental Reward to Target divided by Ongoing Risk to Stop as an exact Value: T-A 8/9 at XYZ 52.00, T-E 9/2 at JKL 21.00', () => {
    expect(exact(evaluate({ state: T_A(), frame: mondayFrame('XYZ', '52.00') }).rewardRiskNow)).toBe(q(8n, 9n));
    expect(exact(evaluate({ state: T_E(), frame: mondayFrame('JKL', '21.00') }).rewardRiskNow)).toBe(q(9n, 2n));
  });

  it('should return NotApplicable when Ongoing Risk to Stop is zero (T-B past its Stop)', () => {
    const evaluation = evaluate({ state: T_B(), frame: mondayFrame('ABC', '27.50') });
    // Past the Stop the risk is exactly zero, not negative, and the reward is still positive.
    expect(exact(evaluation.ongoingRiskToStop)).toBe(q(0n));
    expect(exact(evaluation.incrementalRewardToTarget)).toBe(q(850n));
    expect(evaluation.rewardRiskNow).toEqual({ kind: 'NotApplicable', reason: 'NoOngoingRisk' });
  });

  it('should return Unavailable with the missing Mark Instrument and date when either figure is Unavailable (T-C, DEF on 2026-10-12)', () => {
    const missing: ObservationFrame = { ...mondayFrame('DEF', '0'), resolution: { kind: 'Missing' } };
    const evaluation = evaluate({ state: T_C(), frame: missing });
    expect(evaluation.rewardRiskNow).toEqual({
      kind: 'Unavailable',
      reason: 'MarkMissing',
      instrument: { kind: 'Stock', symbol: 'DEF' },
      date: '2026-10-12',
    });
  });
});

const MNO = { kind: 'Stock', symbol: 'MNO' } as const;
const SESSION_CLOSE: Record<string, string> = { '2026-10-13': '2026-10-13T20:00:00Z', '2026-10-14': '2026-10-14T20:00:00Z' };
function os2FrameOf(instrument: ObservationFrame['instrument'], date: string, price?: string): ObservationFrame {
  const closeInstant = SESSION_CLOSE[date]!;
  return price === undefined
    ? { instrument, tradingDate: date, closeInstant, resolution: { kind: 'Missing' } }
    : { instrument, tradingDate: date, closeInstant, resolution: { kind: 'Available', mark: { revisionId: `mark-${instrument.kind}`, revisionNumber: 1, price } } };
}
// O-S2 after S1' on a session date, with the put's and MNO's Marks (undefined: Missing).
function os2On(date: string, put: string | undefined, mno: string | undefined, record: TradeAnalysisRecord = os2Record([OS2_S1])) {
  const state = derive({ record, valuationDate: date });
  if (state.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(state)}`);
  return evaluate({ state, frame: os2FrameOf(OS2_CONTRACT, date, put), underlyingFrame: os2FrameOf(MNO, date, mno) });
}
const nearestIds = (e: ReturnType<typeof os2On>) => e.conditions.filter((c) => c.nearest === true).map((c) => c.id);

describe('evaluate: the nearest condition (A207)', () => {
  it("should mark O-S2's option-price Stop and its MNO Target as nearest on Tuesday, and no other condition", () => {
    expect(nearestIds(os2On('2026-10-13', '1.80', '44.00'))).toEqual(['stop-2', 'target-1']);
  });

  it('should mark no Stop as nearest on Wednesday, when the option-price Stop is Breached and the headline is zero', () => {
    const e = os2On('2026-10-14', '3.70', '43.20');
    expect(e.conditions.filter((c) => c.role === 'Stop' && c.nearest === true)).toEqual([]);
  });

  it('should mark no condition of a role as nearest when its headline is Unavailable', () => {
    const e = os2On('2026-10-13', '1.80', undefined);
    expect(e.ongoingRiskToStop.kind).toBe('Unavailable');
    expect(e.incrementalRewardToTarget.kind).toBe('Unavailable');
    expect(nearestIds(e)).toEqual([]);
  });

  it('should mark the earlier in Plan order when two conditions of a role are equally near', () => {
    const base = os2Record([OS2_S1]);
    const tied: TradeAnalysisRecord = {
      ...base,
      plan: { ...base.plan, stops: [{ factId: 'stop-a', kind: 'UnderlyingPrice', price: '41.00' }, { factId: 'stop-b', kind: 'UnderlyingPrice', price: '41.00' }] },
    };
    const e = os2On('2026-10-13', '1.80', '44.00', tied);
    expect(e.conditions.filter((c) => c.role === 'Stop').map((c) => c.nearest)).toEqual([true, undefined]);
  });
});
