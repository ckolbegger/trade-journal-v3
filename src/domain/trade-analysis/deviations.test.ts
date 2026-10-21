import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { derive, type DerivedTradeState, type ExpectedDeviation, type RecordedDeviation, type TradeAnalysisRecord } from './index.ts';
import { execution, PC1, PC2, PC3, positionChange, referenceRecord } from './reference-trade.ts';

// The derived state of a coherent record.
function derivedState(record: TradeAnalysisRecord): DerivedTradeState {
  const result = derive({ record });
  if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
  return result;
}

// The Entry Size (Excess) occurrence expected for the reference Trade's leg, caused by one
// Position Change at its Economic Time.
function excess(positionChangeId: string, economicTime: string, shares: bigint): ExpectedDeviation {
  return {
    fingerprint: {
      tradeId: 'trade-1',
      plannedLegId: 'leg-1',
      positionChangeId,
    },
    type: 'EntrySize',
    form: 'Excess',
    quantityAbovePlan: Rational.of(shares),
    causingPositionChangeId: positionChangeId,
    economicTime,
  };
}

// A recorded Entry Size (Excess) occurrence on the reference Trade's leg with one Active version.
function recorded(occurrenceId: string, positionChangeId: string, economicTime: string, shares: string): RecordedDeviation {
  return {
    occurrenceId,
    versions: [
      {
        fingerprint: {
          tradeId: 'trade-1',
          plannedLegId: 'leg-1',
          positionChangeId,
        },
        type: 'EntrySize',
        form: 'Excess',
        quantityAbovePlan: shares,
        causingPositionChangeId: positionChangeId,
        economicTime,
        status: 'Active',
      },
    ],
  };
}

// The same occurrence after it was superseded as no longer expected.
function superseded(occurrence: RecordedDeviation): RecordedDeviation {
  const active = occurrence.versions[0]!;
  return {
    ...occurrence,
    versions: [active, { ...active, status: 'Superseded', reason: 'NoLongerExpected' }],
  };
}

// A further entry of 10 @ 51.20, fee 1.00, at 15:00 America/New_York.
const PC4 = positionChange('pc-4', 7, [execution('ex-4', '2026-10-12T19:00:00Z', 8, '10', '51.20', '1.00')]);

describe('Entry Size excess, P4', () => {
  it('should expect no occurrence after PC1 and PC2', () => {
    expect(derivedState(referenceRecord([PC1])).deviations).toEqual([]);
    expect(derivedState(referenceRecord([PC1, PC2])).deviations).toEqual([]);
  });

  it('should expect one Excess occurrence of 20 shares fingerprinted Trade, leg, PC3 after PC3', () => {
    expect(derivedState(referenceRecord([PC1, PC2, PC3])).deviations).toEqual([excess('pc-3', '2026-10-12T18:00:00Z', 20n)]);
  });

  it('should expect a second occurrence of 10 shares fingerprinted Trade, leg, PC4 after a further PC4 of 10', () => {
    expect(derivedState(referenceRecord([PC1, PC2, PC3, PC4])).deviations).toEqual([
      excess('pc-3', '2026-10-12T18:00:00Z', 20n),
      excess('pc-4', '2026-10-12T19:00:00Z', 10n),
    ]);
  });

  it('should expect one occurrence of 20 fingerprinted Trade, leg, PC1 when PC1 buys 120', () => {
    const first120 = positionChange('pc-1', 1, [execution('ex-1', '2026-10-12T14:00:00Z', 2, '120', '50.00', '1.00')]);
    expect(derivedState(referenceRecord([first120])).deviations).toEqual([excess('pc-1', '2026-10-12T14:00:00Z', 20n)]);
  });
});

describe('earlier-dated Position Change, P5', () => {
  it('should move the Entry Resolution Point to a Position Change recorded later but dated earlier, and recompute Entry Quality from the new window', () => {
    // PC1 60 @ 50.10 at 10:00, then 40 @ 51.00 at 14:00 resolves the entry.
    const late = positionChange('pc-late', 3, [execution('ex-late', '2026-10-12T18:00:00Z', 4, '40', '51.00', '1.00')]);
    const before = derivedState(referenceRecord([PC1, late]));
    expect(before.entryResolution).toEqual({
      kind: 'Resolved',
      positionChangeId: 'pc-late',
    });
    // Recorded afterwards: 40 @ 50.30 at 11:00, so the window is PC1 and this entry (avg 50.18).
    const early = positionChange('pc-early', 5, [execution('ex-early', '2026-10-12T15:00:00Z', 6, '40', '50.30', '1.00')]);
    const after = derivedState(referenceRecord([PC1, late, early]));
    expect(after.entryResolution).toEqual({
      kind: 'Resolved',
      positionChangeId: 'pc-early',
    });
    expect(after.entryQuality).not.toEqual(before.entryQuality);
    expect(after.entryQuality).toEqual(derivedState(referenceRecord([PC1, PC2])).entryQuality);
  });

  it('should change the expected occurrence for an existing fingerprint when an earlier-dated entry changes the quantity above plan', () => {
    // PC1 60 at 10:00, PC2 60 at 11:00: PC2 adds 20 above plan.
    const pc2 = positionChange('pc-2', 3, [execution('ex-2', '2026-10-12T15:00:00Z', 4, '60', '50.30', '1.00')]);
    expect(derivedState(referenceRecord([PC1, pc2])).deviations).toEqual([excess('pc-2', '2026-10-12T15:00:00Z', 20n)]);
    // Then PC-early 40 at 10:30 is recorded: it fills the plan, so all of PC2's 60 is above plan.
    const early = positionChange('pc-early', 5, [execution('ex-early', '2026-10-12T14:30:00Z', 6, '40', '50.20', '1.00')]);
    expect(derivedState(referenceRecord([PC1, pc2, early])).deviations).toEqual([excess('pc-2', '2026-10-12T15:00:00Z', 60n)]);
  });
});

describe('agreement findings', () => {
  it('should report LifecycleDisagreement when stored lifecycle is Planned and an opening Execution exists', () => {
    expect(derivedState(referenceRecord([PC1], 'Planned')).findings).toEqual([
      { kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' },
    ]);
  });

  it('should report DeviationMissing and DeviationUnexpected, each with its fingerprint, when recorded and expected occurrences differ', () => {
    const record: TradeAnalysisRecord = {
      ...referenceRecord([PC1, PC2, PC3, PC4]),
      // PC2 caused no excess, PC3's is unrecorded, and PC4's is recorded with the wrong quantity.
      recordedDeviations: [recorded('dev-2', 'pc-2', '2026-10-12T15:00:00Z', '5'), recorded('dev-4', 'pc-4', '2026-10-12T19:00:00Z', '7')],
    };
    expect(derivedState(record).findings).toEqual([
      {
        kind: 'DeviationMissing',
        fingerprint: excess('pc-3', '2026-10-12T18:00:00Z', 20n).fingerprint,
        expected: excess('pc-3', '2026-10-12T18:00:00Z', 20n),
      },
      {
        kind: 'DeviationQuantityDisagreement',
        fingerprint: excess('pc-4', '2026-10-12T19:00:00Z', 10n).fingerprint,
        occurrenceId: 'dev-4',
        recorded: Rational.of(7n),
        expected: Rational.of(10n),
      },
      {
        kind: 'DeviationUnexpected',
        fingerprint: recorded('dev-2', 'pc-2', '2026-10-12T15:00:00Z', '5').versions[0]!.fingerprint,
        occurrenceId: 'dev-2',
      },
    ]);
  });

  it('should never return a corrected record or alter its input', () => {
    // Stored lifecycle and recorded occurrences both disagree with the facts.
    const record: TradeAnalysisRecord = {
      ...referenceRecord([PC3, PC1, PC2], 'Planned'),
      recordedDeviations: [recorded('dev-2', 'pc-2', '2026-10-12T15:00:00Z', '5')],
    };
    const snapshot = structuredClone(record);
    const result = derive({ record: deepFreeze(record) });
    expect(record).toEqual(snapshot);
    expect(result.kind).toBe('Derived');
    for (const field of ['record', 'storedLifecycle', 'recordedDeviations', 'positionChanges', 'plan'])
      expect(result).not.toHaveProperty(field);
  });
});

describe('reconciliation for a candidate', () => {
  // Before: PC1 60 at 10:00, PC2 60 at 11:00 (20 above plan), PC3 20 at 14:00 (20 above plan).
  const pc2 = positionChange('pc-2', 3, [execution('ex-2', '2026-10-12T15:00:00Z', 4, '60', '50.30', '1.00')]);
  const early = positionChange('pc-early', 7, [execution('ex-early', '2026-10-12T14:30:00Z', 8, '40', '50.20', '1.00')]);
  const pc4 = positionChange('pc-4', 9, [execution('ex-4', '2026-10-12T19:00:00Z', 10, '10', '51.20', '1.00')]);
  const digest = 'a'.repeat(64);

  it('should bind the candidate digest, expected lifecycle, and the create, retain, new-version, and supersede actions for every fingerprint', () => {
    const recordedDeviations = [
      recorded('dev-2', 'pc-2', '2026-10-12T15:00:00Z', '20'),
      recorded('dev-3', 'pc-3', '2026-10-12T18:00:00Z', '20'),
      recorded('dev-x', 'pc-1', '2026-10-12T14:00:00Z', '5'),
      superseded(recorded('dev-old', 'pc-early', '2026-10-12T14:30:00Z', '3')),
    ];
    const before: TradeAnalysisRecord = {
      ...referenceRecord([PC1, pc2, PC3]),
      recordedDeviations,
    };
    // The candidate adds an earlier-dated entry (PC2's excess becomes 60) and PC4 (10 above plan).
    const candidate: TradeAnalysisRecord = {
      ...referenceRecord([PC1, pc2, PC3, early, pc4]),
      recordedDeviations,
    };
    const result = derive({ record: candidate, candidate: { digest, before } });
    if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
    expect(result.reconciliation).toEqual(
      expect.objectContaining({
        candidateDigest: digest,
        expectedLifecycle: 'Open',
        deviationActions: [
          {
            kind: 'NewVersion',
            occurrenceId: 'dev-2',
            occurrence: excess('pc-2', '2026-10-12T15:00:00Z', 60n),
          },
          {
            kind: 'Retain',
            occurrenceId: 'dev-3',
            fingerprint: excess('pc-3', '2026-10-12T18:00:00Z', 20n).fingerprint,
          },
          {
            kind: 'Create',
            occurrence: excess('pc-4', '2026-10-12T19:00:00Z', 10n),
          },
          {
            kind: 'Supersede',
            occurrenceId: 'dev-x',
            fingerprint: recordedDeviations[2]!.versions[0]!.fingerprint,
            reason: 'NoLongerExpected',
          },
          // Already superseded and still not expected: kept as it is.
          {
            kind: 'Retain',
            occurrenceId: 'dev-old',
            fingerprint: recordedDeviations[3]!.versions[0]!.fingerprint,
          },
        ],
      }),
    );
    // A superseded occurrence is not an active recorded one, so it is not reported as unexpected.
    expect(result.findings.map((f) => f.kind)).toEqual(['DeviationQuantityDisagreement', 'DeviationMissing', 'DeviationUnexpected']);
  });

  it('should list repairs separately from the change own effects when the before-state disagreed with coherent facts, P7', () => {
    const reconcile = (before: TradeAnalysisRecord, candidate: TradeAnalysisRecord) => {
      const result = derive({
        record: candidate,
        candidate: { digest, before },
      });
      if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
      return result.reconciliation;
    };
    // Before: stored Planned with no recorded occurrence, although PC1 to PC3 opened it and PC3 is
    // 20 above plan. The change adds PC4, 10 more above plan.
    const disagreeing = reconcile(referenceRecord([PC1, PC2, PC3], 'Planned'), referenceRecord([PC1, PC2, PC3, PC4], 'Planned'));
    expect(disagreeing?.repairs).toEqual([
      { kind: 'LifecycleDisagreement', stored: 'Planned', expected: 'Open' },
      {
        kind: 'DeviationMissing',
        fingerprint: excess('pc-3', '2026-10-12T18:00:00Z', 20n).fingerprint,
        expected: excess('pc-3', '2026-10-12T18:00:00Z', 20n),
      },
    ]);
    expect(disagreeing?.effects).toEqual([
      {
        kind: 'DeviationChange',
        fingerprint: excess('pc-4', '2026-10-12T19:00:00Z', 10n).fingerprint,
        from: null,
        to: Rational.of(10n),
      },
    ]);
    // An agreeing before-state needs no repair; the first entry's own effect opens the Trade.
    const agreeing = reconcile(referenceRecord([]), referenceRecord([PC1], 'Planned'));
    expect(agreeing?.repairs).toEqual([]);
    expect(agreeing?.effects).toEqual([{ kind: 'LifecycleTransition', from: 'Planned', to: 'Open' }]);
  });
});

// Freezes a value and everything it holds, so any write to it throws.
function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
