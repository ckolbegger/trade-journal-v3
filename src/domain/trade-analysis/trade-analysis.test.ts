import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { assessPlan, derive, type PlanAssessmentInput, type TradeAnalysisRecord } from './index.ts';

const LONG_STOCK = { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] } as const;

function plan(overrides: Partial<PlanAssessmentInput['plan']> = {}): PlanAssessmentInput {
  return {
    strategyShape: LONG_STOCK,
    plan: {
      underlying: 'XYZ',
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '47.50' }],
      targets: [{ kind: 'UnderlyingPrice', price: '56.00' }],
      ...overrides,
    },
  };
}

const money = (n: bigint, d = 1n) => Rational.of(n, d);

describe('assessPlan: Long Stock', () => {
  it('should accept 100 shares at intended entry 50.00, Stop 47.50, Target 56.00 with Original Planned Risk $250, Original Planned Reward $600, ratio 12/5, 1R $250, and per-condition basis', () => {
    const result = assessPlan(plan());
    if (result.kind !== 'Accepted') throw new Error(`expected Accepted, got ${JSON.stringify(result)}`);
    const { baseline } = result;
    expect(baseline.originalPlannedRisk.equals(money(250n))).toBe(true);
    expect(baseline.originalPlannedReward.equals(money(600n))).toBe(true);
    expect(baseline.rewardRiskRatio.equals(money(12n, 5n))).toBe(true);
    expect(baseline.oneR.equals(money(250n))).toBe(true);
    expect(baseline.stopBasis).toHaveLength(1);
    expect(baseline.stopBasis[0]?.distance.equals(money(250n))).toBe(true);
    expect(baseline.targetBasis[0]?.distance.equals(money(600n))).toBe(true);
  });

  it('should compute exactly for fractional inputs (3.5 shares, entry 10.10, Stop 9.95: risk $0.525)', () => {
    const result = assessPlan(
      plan({
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '3.50', intendedEntry: '10.10' }],
        stops: [{ kind: 'UnderlyingPrice', price: '9.95' }],
        targets: [{ kind: 'UnderlyingPrice', price: '10.400' }],
      }),
    );
    if (result.kind !== 'Accepted') throw new Error('expected Accepted');
    expect(result.baseline.originalPlannedRisk.equals(money(525n, 1000n))).toBe(true);
    expect(result.baseline.originalPlannedReward.equals(money(105n, 100n))).toBe(true);
    // Acceptance returns normalized Plan semantics (Trade Analysis, assessPlan).
    expect(result.plan).toEqual({
      underlying: 'XYZ',
      legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '3.5', intendedEntry: '10.1' }],
      stops: [{ kind: 'UnderlyingPrice', price: '9.95' }],
      targets: [{ kind: 'UnderlyingPrice', price: '10.4' }],
    });
  });

  it('should reject a Stop at or above intended entry with NoPositiveRisk', () => {
    for (const price of ['50.00', '51']) {
      expect(assessPlan(plan({ stops: [{ kind: 'UnderlyingPrice', price }] }))).toEqual({
        kind: 'Rejected',
        issues: [{ code: 'NoPositiveRisk' }],
      });
    }
  });

  it('should reject a Target at or below intended entry with TargetNotBeyondEntry', () => {
    for (const price of ['50', '49.99']) {
      expect(assessPlan(plan({ targets: [{ kind: 'UnderlyingPrice', price }] }))).toEqual({
        kind: 'Rejected',
        issues: [{ code: 'TargetNotBeyondEntry' }],
      });
    }
  });

  it('should reject a missing Stop with MissingStop and a missing Target with MissingTarget', () => {
    expect(assessPlan(plan({ stops: [] }))).toEqual({ kind: 'Rejected', issues: [{ code: 'MissingStop' }] });
    expect(assessPlan(plan({ targets: [] }))).toEqual({ kind: 'Rejected', issues: [{ code: 'MissingTarget' }] });
  });

  it('should reject zero legs, two legs, a short leg, or a non-Stock Instrument with StrategyShapeMismatch', () => {
    const leg = { side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' } as const;
    const shapes = [
      [],
      [leg, leg],
      [{ ...leg, side: 'Short' }],
      [{ ...leg, instrument: { kind: 'Call', symbol: 'XYZ' } }],
    ] as unknown as PlanAssessmentInput['plan']['legs'][];
    for (const legs of shapes) {
      expect(assessPlan(plan({ legs })), JSON.stringify(legs)).toEqual({
        kind: 'Rejected',
        issues: [{ code: 'StrategyShapeMismatch' }],
      });
    }
  });

  it('should report StrategyShapeMismatch together with the other issues of a leading Long Stock leg, so every issue is returned at once', () => {
    const leg = { side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' } as const;
    expect(assessPlan(plan({ legs: [leg, leg], stops: [{ kind: 'UnderlyingPrice', price: '52' }] }))).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'StrategyShapeMismatch' }, { code: 'NoPositiveRisk' }],
    });
  });

  it('should reject a leg whose symbol differs from the Plan\'s underlying with UnderlyingMismatch', () => {
    const legs = [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'ABC' }, quantity: '100', intendedEntry: '50' }] as const;
    expect(assessPlan(plan({ legs }))).toEqual({ kind: 'Rejected', issues: [{ code: 'UnderlyingMismatch' }] });
  });

  it('should reject a leg with no Stock symbol, or one that fails the symbol format, with MissingInstrument', () => {
    for (const symbol of ['', '  ', '1ABC', 'TOOLONGSYMBOL', 'AB-C']) {
      const legs = [{ side: 'Long', instrument: { kind: 'Stock', symbol }, quantity: '100', intendedEntry: '50' }] as const;
      expect(assessPlan(plan({ underlying: symbol, legs })), symbol).toEqual({
        kind: 'Rejected',
        issues: [{ code: 'MissingInstrument' }],
      });
    }
    const legs = [{ side: 'Long', instrument: { kind: 'Stock', symbol: ' brk.b ' }, quantity: '100', intendedEntry: '50' }] as const;
    const accepted = assessPlan(plan({ underlying: 'brk.b', legs }));
    expect(accepted.kind === 'Accepted' && [accepted.plan.underlying, accepted.plan.legs[0]?.instrument.symbol]).toEqual([
      'BRK.B',
      'BRK.B',
    ]);
  });

  it('should return every issue at once rather than the first', () => {
    expect(
      assessPlan(
        plan({
          underlying: 'ABC',
          stops: [{ kind: 'UnderlyingPrice', price: '51' }],
          targets: [{ kind: 'UnderlyingPrice', price: '49' }],
        }),
      ),
    ).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'UnderlyingMismatch' }, { code: 'NoPositiveRisk' }, { code: 'TargetNotBeyondEntry' }],
    });
    // Unusable decimals are typed issues too (D1 A9), reported alongside the rest.
    expect(
      assessPlan(
        plan({
          legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '0', intendedEntry: 'abc' }],
          stops: [],
        }),
      ),
    ).toEqual({
      kind: 'Rejected',
      issues: [{ code: 'MissingStop' }, { code: 'InvalidQuantity' }, { code: 'InvalidPrice' }],
    });
  });
});

describe('derive: Planned', () => {
  function record(storedLifecycle: TradeAnalysisRecord['storedLifecycle'] = 'Planned'): TradeAnalysisRecord {
    return {
      tradeId: 'trade-1',
      factRevision: 7,
      storedLifecycle,
      plan: {
        economicTime: '2026-10-12T13:30:00Z',
        underlying: 'XYZ',
        thesis: 'Breakout.',
        invalidation: 'Below 48.',
        legs: [{ factId: 'leg-1', side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50' }],
        stops: [{ factId: 'stop-1', kind: 'UnderlyingPrice', price: '47.5' }],
        targets: [{ factId: 'target-1', kind: 'UnderlyingPrice', price: '56' }],
      },
      positionChanges: [],
    };
  }

  function derived(input: { record: TradeAnalysisRecord }) {
    const result = derive(input);
    if (result.kind !== 'Derived') throw new Error(`expected Derived, got ${JSON.stringify(result)}`);
    return result;
  }

  it('should derive expected lifecycle Planned, agreement Agrees with stored Planned, no Positions, and the frozen Plan Baseline and 1R for a record with no position-changing facts', () => {
    const state = derived({ record: record() });
    expect(state.tradeId).toBe('trade-1');
    expect(state.factRevision).toBe(7);
    expect(state.expectedLifecycle).toBe('Planned');
    expect(state.agreement).toEqual({ kind: 'Agrees' });
    expect(state.positions).toEqual([]);
    expect(state.baseline.oneR.equals(money(250n))).toBe(true);
    expect(state.baseline.originalPlannedReward.equals(money(600n))).toBe(true);
  });

  it('should report a structured LifecycleDisagreement finding, without changing anything, when the supplied stored lifecycle is Open but no exposure facts exist', () => {
    const input = { record: record('Open') };
    const snapshot = structuredClone(input);
    const state = derived(input);
    expect(state.expectedLifecycle).toBe('Planned');
    expect(state.agreement).toEqual({ kind: 'LifecycleDisagreement', stored: 'Open', expected: 'Planned' });
    expect(input).toEqual(snapshot);
  });

  it('should return deep-equal results for identical inputs', () => {
    expect(derive({ record: record() })).toEqual(derive({ record: record() }));
    // Outputs are inert (Trade Analysis contract): they never alias the caller's input.
    const input = { record: record() };
    const state = derived(input);
    const before = structuredClone(state.baseline.stopBasis.map((b) => b.condition));
    (input.record.plan.stops[0] as { price: string }).price = '1';
    expect(state.baseline.stopBasis.map((b) => b.condition)).toEqual(before);
  });
});
