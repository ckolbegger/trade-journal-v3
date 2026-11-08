import { describe, expect, it } from 'vitest';
import { Rational } from '../values/index.ts';
import { assessPlan, type PlanAssessmentInput } from './index.ts';

const r = (n: bigint, d = 1n) => Rational.of(n, d);

const LONG_CALL = { roles: [{ side: 'Long', instrument: 'Call', ratio: 1 }] } as const;
const LONG_PUT = { roles: [{ side: 'Long', instrument: 'Put', ratio: 1 }] } as const;
const CASH_SECURED_PUT = { roles: [{ side: 'Short', instrument: 'Put', ratio: 1 }] } as const;

// Monday 2026-10-12 09:00 America/New_York.
const PLAN_TIME = '2026-10-12T13:00:00Z';

function contract(symbol: string, strike: string, right: 'Call' | 'Put', expiration = '2026-11-20') {
  return { kind: 'Option', symbol, root: symbol, expiration, strike, right, multiplier: 100 } as const;
}

// O-C: Long Call XYZ 20 Nov 2026 55, 2 contracts at 2.00, Stop 48.00, Target 60.00.
function longCall(overrides: Partial<PlanAssessmentInput['plan']> = {}, economicTime: string = PLAN_TIME): PlanAssessmentInput {
  return {
    strategyShape: LONG_CALL,
    economicTime,
    plan: {
      underlying: 'XYZ',
      legs: [{ side: 'Long', instrument: contract('XYZ', '55', 'Call'), quantity: '2', intendedEntry: '2.00' }],
      stops: [{ kind: 'UnderlyingPrice', price: '48.00' }],
      targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
      exerciseIntent: 'NotAuthorized',
      ...overrides,
    },
  };
}

function longPut(overrides: Partial<PlanAssessmentInput['plan']> = {}): PlanAssessmentInput {
  return {
    strategyShape: LONG_PUT,
    economicTime: PLAN_TIME,
    plan: {
      underlying: 'ABC',
      legs: [{ side: 'Long', instrument: contract('ABC', '50', 'Put'), quantity: '1', intendedEntry: '1.50' }],
      stops: [{ kind: 'UnderlyingPrice', price: '55.00' }],
      targets: [{ kind: 'UnderlyingPrice', price: '45.00' }],
      exerciseIntent: 'Authorized',
      ...overrides,
    },
  };
}

function cashSecuredPut(overrides: Partial<PlanAssessmentInput['plan']> = {}): PlanAssessmentInput {
  return {
    strategyShape: CASH_SECURED_PUT,
    economicTime: PLAN_TIME,
    plan: {
      underlying: 'MNO',
      legs: [{ side: 'Short', instrument: contract('MNO', '45', 'Put'), quantity: '-2', intendedEntry: '1.20' }],
      stops: [{ kind: 'UnderlyingPrice', price: '42.00' }],
      targets: [{ kind: 'UnderlyingPrice', price: '50.00' }],
      ...overrides,
    },
  };
}

function rejection(input: PlanAssessmentInput) {
  const result = assessPlan(input);
  if (result.kind !== 'Rejected') throw new Error('expected Rejected, got Accepted');
  return result.issues;
}

function accepted(input: PlanAssessmentInput) {
  const result = assessPlan(input);
  if (result.kind !== 'Accepted') throw new Error(`expected Accepted, got ${result.issues.map((i) => i.code).join(', ')}`);
  return result;
}

describe('assessPlan: Long Call (P24, A100)', () => {
  it('should accept O-C with Original Planned Risk $400, Original Planned Reward $600, ratio 3/2, 1R $400, Exercise Intent NotAuthorized, and per-condition basis naming each Underlying trigger and its value at expiration as the measurement basis labelled underlying-price', () => {
    const { baseline, plan } = accepted(longCall());
    expect(baseline.originalPlannedRisk.equals(r(400n))).toBe(true);
    expect(baseline.originalPlannedReward.equals(r(600n))).toBe(true);
    expect(baseline.rewardRiskRatio.equals(r(3n, 2n))).toBe(true);
    expect(baseline.oneR.equals(r(400n))).toBe(true);
    expect(plan.exerciseIntent).toBe('NotAuthorized');
    expect(baseline.stopBasis).toHaveLength(1);
    expect(baseline.stopBasis[0]?.condition).toEqual({ kind: 'UnderlyingPrice', price: '48.00' });
    expect(baseline.stopBasis[0]?.valueAtExpiration?.equals(r(0n))).toBe(true);
    expect(baseline.targetBasis[0]?.condition).toEqual({ kind: 'UnderlyingPrice', price: '60.00' });
    expect(baseline.targetBasis[0]?.valueAtExpiration?.equals(r(5n))).toBe(true);
  });

  it('should reject a Stop at 58.00 with value 3.00 not below the entry with NoPositiveRisk and a Target at 56.00 with value 1.00 below the breakeven 57.00 with TargetNotBeyondEntry naming the breakeven', () => {
    expect(rejection(longCall({ stops: [{ kind: 'UnderlyingPrice', price: '58.00' }] })).map((i) => i.code)).toEqual(['NoPositiveRisk']);
    const issues = rejection(longCall({ targets: [{ kind: 'UnderlyingPrice', price: '56.00' }] }));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('TargetNotBeyondEntry');
    expect(issues[0]?.details?.breakeven?.equals(r(57n))).toBe(true);
  });

  it('should reject an Underlying Stop at or above the Underlying Target with StopTargetOrder', () => {
    // Such a Stop's value at expiration is also not below the entry, so NoPositiveRisk comes with it.
    const stop = (price: string) => [{ kind: 'UnderlyingPrice', price }] as const;
    expect(rejection(longCall({ stops: stop('61.00') })).map((i) => i.code)).toContain('StopTargetOrder');
    expect(rejection(longCall({ stops: stop('60.00') })).map((i) => i.code)).toContain('StopTargetOrder');
    expect(rejection(longCall({ stops: stop('59.99') })).map((i) => i.code)).not.toContain('StopTargetOrder');
  });
});

describe('assessPlan: Long Put and Cash-Secured Put', () => {
  it('should accept O-P (1R $150, reward $350, ratio 7/3) with its Stop above its Target, and O-S as a short leg of -2 (1R $360, reward $240, ratio 2/3) whose risk comes from its Stop value at expiration 3.00 above the credit, and reject an O-S Stop at 44.00 above the breakeven 43.80 with NoPositiveRisk', () => {
    const put = accepted(longPut()).baseline;
    expect(put.oneR.equals(r(150n))).toBe(true);
    expect(put.originalPlannedReward.equals(r(350n))).toBe(true);
    expect(put.rewardRiskRatio.equals(r(7n, 3n))).toBe(true);
    expect(put.stopBasis[0]?.valueAtExpiration?.equals(r(0n))).toBe(true);
    expect(put.targetBasis[0]?.valueAtExpiration?.equals(r(5n))).toBe(true);

    const short = accepted(cashSecuredPut());
    expect(short.baseline.oneR.equals(r(360n))).toBe(true);
    expect(short.baseline.originalPlannedRisk.equals(r(360n))).toBe(true);
    expect(short.baseline.originalPlannedReward.equals(r(240n))).toBe(true);
    expect(short.baseline.rewardRiskRatio.equals(r(2n, 3n))).toBe(true);
    expect(short.baseline.stopBasis[0]?.valueAtExpiration?.equals(r(3n))).toBe(true);
    expect(short.baseline.targetBasis[0]?.valueAtExpiration?.equals(r(0n))).toBe(true);
    expect(short.plan.legs[0]?.quantity).toBe('-2');
    expect(short.plan.exerciseIntent).toBeUndefined();

    const issues = rejection(cashSecuredPut({ stops: [{ kind: 'UnderlyingPrice', price: '44.00' }] }));
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('NoPositiveRisk');
    expect(issues[0]?.details?.breakeven?.equals(r(219n, 5n))).toBe(true);
  });

  it('should reject Exercise Intent on the Cash-Secured Put with ExerciseIntentNotApplicable, and a long option without it with ExerciseIntentRequired', () => {
    expect(rejection(cashSecuredPut({ exerciseIntent: 'NotAuthorized' }))).toEqual([{ code: 'ExerciseIntentNotApplicable' }]);
    expect(rejection(longCall({ exerciseIntent: undefined }))).toEqual([{ code: 'ExerciseIntentRequired' }]);
    expect(rejection(longPut({ exerciseIntent: undefined }))).toEqual([{ code: 'ExerciseIntentRequired' }]);
  });

  it('should reject Exercise Intent on a Long Stock Plan with ExerciseIntentNotApplicable', () => {
    const input: PlanAssessmentInput = {
      strategyShape: { roles: [{ side: 'Long', instrument: 'Stock', ratio: 1 }] },
      economicTime: PLAN_TIME,
      plan: {
        underlying: 'XYZ',
        legs: [{ side: 'Long', instrument: { kind: 'Stock', symbol: 'XYZ' }, quantity: '100', intendedEntry: '50.00' }],
        stops: [{ kind: 'UnderlyingPrice', price: '45.00' }],
        targets: [{ kind: 'UnderlyingPrice', price: '60.00' }],
        exerciseIntent: 'Authorized',
      },
    };
    expect(rejection(input)).toEqual([{ code: 'ExerciseIntentNotApplicable' }]);
  });
});

describe('assessPlan: option condition count', () => {
  it('should reject an option Plan with two Stops or two Targets, naming the extra condition', () => {
    const two = (price: string) => [{ kind: 'UnderlyingPrice', price: '48.00' }, { kind: 'UnderlyingPrice', price }] as const;
    expect(rejection(longCall({ stops: two('47.00') }))).toEqual([
      { code: 'ConditionCountNotOne', details: { extraConditions: [{ kind: 'UnderlyingPrice', price: '47.00' }] } },
    ]);
    expect(rejection(longCall({ targets: [{ kind: 'UnderlyingPrice', price: '60.00' }, { kind: 'UnderlyingPrice', price: '65.00' }] }))).toEqual([
      { code: 'ConditionCountNotOne', details: { extraConditions: [{ kind: 'UnderlyingPrice', price: '65.00' }] } },
    ]);
  });
});

describe('assessPlan: canonical option leg', () => {
  it('should return the accepted option leg canonical Instrument, normalizing strike 055.000 to 55 and deriving the root from the symbol', () => {
    const raw = { kind: 'Option', symbol: 'brk.b', root: 'WRONG', expiration: '2026-11-20', strike: '055.000', right: 'Call', multiplier: 100 } as const;
    const result = assessPlan(longCall({ underlying: 'BRK.B', legs: [{ side: 'Long', instrument: raw, quantity: '2', intendedEntry: '2.00' }] }));
    expect(result.kind).toBe('Accepted');
    if (result.kind !== 'Accepted') return;
    expect(result.plan.legs[0]?.instrument).toEqual({ kind: 'Option', symbol: 'BRK.B', root: 'BRKB', expiration: '2026-11-20', strike: '55', right: 'Call', multiplier: 100 });
  });
});

describe('assessPlan: option shape and contract', () => {
  const longCallLeg = (instrument: ReturnType<typeof contract>, quantity = '2') =>
    [{ side: 'Long', instrument, quantity, intendedEntry: '2.00' }] as const;

  it('should reject a Put leg on Long Call, a long leg on Cash-Secured Put, 1.5 contracts, and an expiration date before the Plan New York date with StrategyShapeMismatch, ContractQuantityNotWhole, and ContractAlreadyExpired, all at once', () => {
    const codes = (input: PlanAssessmentInput) => rejection(input).map((i) => i.code);
    expect(codes(longCall({ legs: longCallLeg(contract('XYZ', '55', 'Put', '2026-10-09'), '1.5') }))).toEqual([
      'StrategyShapeMismatch',
      'ContractQuantityNotWhole',
      'ContractAlreadyExpired',
    ]);
    expect(codes(cashSecuredPut({ legs: longCallLeg(contract('MNO', '45', 'Put')), exerciseIntent: 'NotAuthorized' }))).toEqual([
      'StrategyShapeMismatch',
    ]);
    // 22:00 on 2026-10-12 in New York is already 2026-10-13 in UTC: the expiration on the 12th is not yet past.
    const lateOn12th = longCall({ legs: longCallLeg(contract('XYZ', '55', 'Call', '2026-10-12')) }, '2026-10-13T02:00:00Z');
    expect(assessPlan(lateOn12th).kind).toBe('Accepted');
    expect(codes({ ...lateOn12th, economicTime: '2026-10-13T13:00:00Z' })).toEqual(['ContractAlreadyExpired']);
    // The T7.1 contract validation's issues are surfaced as they are.
    expect(codes(longCall({ legs: longCallLeg(contract('XYZ', '0', 'Call')) }))).toEqual(['StrikeNotPositive']);
  });
});

describe('NoPositiveRisk names the breakeven on every option Strategy (A100)', () => {
  it('should reject O-C with its Stop at XYZ 57.50 (value 2.50 at expiration, above the 2.00 entry) and O-P with its Stop at ABC 48.00 (value 2.00, above the 1.50 entry) as NoPositiveRisk naming the breakevens 57.00 and 48.50', () => {
    const call = rejection(longCall({ stops: [{ kind: 'UnderlyingPrice', price: '57.50' }] })).filter((i) => i.code === 'NoPositiveRisk');
    expect(call).toHaveLength(1);
    expect(call[0]?.details?.breakeven?.equals(r(57n))).toBe(true);
    const put = rejection(longPut({ stops: [{ kind: 'UnderlyingPrice', price: '48.00' }] })).filter((i) => i.code === 'NoPositiveRisk');
    expect(put).toHaveLength(1);
    expect(put[0]?.details?.breakeven?.equals(r(97n, 2n))).toBe(true);
  });
});
