import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type CalculationResult, type DerivedTradeState, type EntryQualityFigures, type RecordedDeviation, type TradeAnalysisRecord } from './index.ts';
import { PC1, PC2, positionChange, referenceRecord, sellExecution, X1 as XS } from './reference-trade.ts';

// The derived state of a coherent record.
function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

// A Calculation Result with its Rational shown as an exact fraction, so a failure names the value.
function exact(result: CalculationResult<Rational>) {
  return result.kind === 'Value' ? `${result.value.numerator}/${result.value.denominator}` : result;
}

// Shortfall Trade T-S: PC1 buys 60 on Monday, then XS sells 30 on Tuesday. XS is the reference
// Trade's X1 (Tuesday 10:00, Sell 30 @ 52.00, fee 0.60).
const T_S = referenceRecord([PC1, XS]);

describe('Entry window cut by the first reduction A82', () => {
  it("should resolve T-S's entry immediately before XS with 60 entered and Entry Quality over PC1 only, while T-A fully entered at PC2 stays resolved at PC2", () => {
    const derived = derivedState(T_S);
    expect(derived.entryResolution).toEqual({ kind: 'Resolved', positionChangeId: 'pc-1' });
    if (derived.entryQuality.kind !== 'Value') throw new Error(`expected resolved Entry Quality, got ${JSON.stringify(derived.entryQuality)}`);
    const quality: EntryQualityFigures = derived.entryQuality.value;
    expect({
      windowQuantity: exact(quality.windowQuantity),
      windowFees: exact(quality.windowFees),
      risk: exact(quality.actualInitialRisk),
      reward: exact(quality.actualInitialReward),
      sizeRatio: exact(quality.sizeRatio),
      riskInPlanR: exact(quality.riskInPlanR),
      slippage: exact(quality.slippage),
    }).toEqual({
      windowQuantity: '60/1',
      windowFees: '1/1',
      risk: '157/1',
      reward: '353/1',
      sizeRatio: '3/5',
      riskInPlanR: '157/250',
      slippage: '6/1',
    });

    // T-A is complete at PC2, so a later Sell does not move its resolution.
    expect(derivedState(referenceRecord([PC1, PC2, XS])).entryResolution).toEqual({ kind: 'Resolved', positionChangeId: 'pc-2' });
  });
});

describe('Entry Size shortfall A83 AC-POS-005', () => {
  it('should expect one Shortfall occurrence of 40 fingerprinted T-S, leg, Shortfall with XS as its cause and Fulfillment FilledWithDeviation', () => {
    const derived = derivedState(T_S);
    expect(
      derived.deviations.map((d) => ({
        ...d,
        ...(d.form === 'Shortfall' && { quantityBelowPlan: exact({ kind: 'Value', value: d.quantityBelowPlan }) }),
      })),
    ).toEqual([
      {
        fingerprint: { tradeId: 'trade-1', plannedLegId: 'leg-1', form: 'Shortfall' },
        type: 'EntrySize',
        form: 'Shortfall',
        quantityBelowPlan: '40/1',
        causingPositionChangeId: 'pc-x1',
        economicTime: '2026-10-13T14:00:00Z',
      },
    ]);
    expect(derived.legFulfillment).toEqual([{ plannedLegId: 'leg-1', fulfillment: 'FilledWithDeviation' }]);
    // The reconciliation creates it like an Excess occurrence (A26).
    const candidate = derive({ record: T_S, candidate: { digest: 'a'.repeat(64), before: referenceRecord([PC1]) } });
    if (candidate.kind !== 'Derived') throw new Error('expected Derived');
    expect(candidate.reconciliation?.deviationActions.map((a) => a.kind)).toEqual(['Create']);
    // A complete Trade has no Shortfall.
    expect(derivedState(referenceRecord([PC1, PC2, XS])).deviations).toEqual([]);
  });

  // T-S's record holds a Shortfall of 40 caused by XS. A Sell of 30 dated Monday 10:30 is then
  // recorded: the cut moves to it while the entered quantity (60) and the Shortfall (40) stay.
  const earlySell = positionChange('pc-xe', 9, [sellExecution('ex-xe', '2026-10-12T14:30:00Z', 10, '30', '51.50', '0.60')]);
  const recordedShortfall: RecordedDeviation = {
    occurrenceId: 'dev-s',
    versions: [
      {
        fingerprint: { tradeId: 'trade-1', plannedLegId: 'leg-1', form: 'Shortfall' },
        type: 'EntrySize',
        form: 'Shortfall',
        quantityBelowPlan: '40',
        causingPositionChangeId: 'pc-x1',
        economicTime: '2026-10-13T14:00:00Z',
        status: 'Active',
      },
    ],
  };
  const movedCutExpected = {
    fingerprint: { tradeId: 'trade-1', plannedLegId: 'leg-1', form: 'Shortfall' },
    type: 'EntrySize',
    form: 'Shortfall',
    quantityBelowPlan: Rational.of(40n),
    causingPositionChangeId: 'pc-xe',
    economicTime: '2026-10-12T14:30:00Z',
  };

  it('should append a new Shortfall version naming the earlier-dated Sell and its Economic Time when the cutoff moves without changing the entered quantity', () => {
    const before: TradeAnalysisRecord = { ...T_S, recordedDeviations: [recordedShortfall] };
    const candidate: TradeAnalysisRecord = { ...referenceRecord([PC1, XS, earlySell]), recordedDeviations: [recordedShortfall] };
    const result = derive({ record: candidate, candidate: { digest: 'a'.repeat(64), before } });
    if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
    expect(result.deviations).toEqual([movedCutExpected]);
    expect(result.reconciliation?.deviationActions).toEqual([{ kind: 'NewVersion', occurrenceId: 'dev-s', occurrence: movedCutExpected }]);
  });

  it('should report the stored Shortfall as disagreeing when its cause and Economic Time are stale although its quantity matches', () => {
    const record: TradeAnalysisRecord = { ...referenceRecord([PC1, XS, earlySell], 'Closed'), recordedDeviations: [recordedShortfall] };
    expect(derivedState(record).findings).toEqual([
      {
        kind: 'DeviationQuantityDisagreement',
        fingerprint: movedCutExpected.fingerprint,
        occurrenceId: 'dev-s',
        recorded: Rational.of(40n),
        expected: Rational.of(40n),
      },
    ]);
    // A record whose Shortfall names the current cause and time has no finding.
    const current: RecordedDeviation = {
      occurrenceId: 'dev-s',
      versions: [{ ...recordedShortfall.versions[0]!, causingPositionChangeId: 'pc-xe', economicTime: '2026-10-12T14:30:00Z' }],
    };
    expect(derivedState({ ...record, recordedDeviations: [current] }).findings).toEqual([]);
  });
});
