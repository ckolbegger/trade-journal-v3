import { describe, it, expect } from 'vitest';
import { derive, assessPlan, type PlanInput } from '../../src/domain/trade-analysis';
export const plan: PlanInput = { instrument: { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, quantity: '100', entry: '50', stop: '45', target: '60', thesis: 'Improving earnings', invalidation: 'Earnings thesis fails' };
describe('frozen Long Stock Plan assessment', () => {
  it('should accept fixture P and freeze exact risk, reward and ratio', () => {
    expect(assessPlan(plan)).toMatchObject({ status: 'Accepted', plan, baseline: { risk: '500', oneR: '500', reward: '1000', ratio: { numerator: '2', denominator: '1' }, conditions: [{ kind: 'Stop', price: '45', amount: '500' }, { kind: 'Target', price: '60', amount: '1000' }] } });
  });
});

it('should report every incoherent or missing Plan issue without a baseline', () => {
  expect(assessPlan({ ...plan, instrument: undefined, quantity: '-1', thesis: ' ', invalidation: '', stop: '50', target: '40' })).toEqual({ status: 'Rejected', issues: ['ExactStockRequired', 'PositiveQuantityRequired', 'ThesisRequired', 'InvalidationRequired', 'PositiveRiskRequired', 'ForwardRewardRequired'] });
  expect(assessPlan({ ...plan, entry: 'NaN', stop: '-2', target: 'Infinity' })).toEqual({ status: 'Rejected', issues: ['InvalidEntry', 'InvalidStop', 'InvalidTarget'] });
});
it('should classify Stock expiration internally without advertising payoff', () => {
  expect(assessPlan(plan)).toMatchObject({ status: 'Accepted', expirationMethod: { status: 'NotApplicable', reason: 'NoOptionExpirationAnchor' } });
});
it('should preserve tiny positive risk and a repeating quotient exactly', () => {
  expect(assessPlan({ ...plan, stop: '49.99999999999999999999' })).toMatchObject({ status: 'Accepted', baseline: { risk: '0.000000000000000001', oneR: '0.000000000000000001' } });
  expect(assessPlan({ ...plan, quantity: '1', stop: '47', target: '51' })).toMatchObject({ status: 'Accepted', baseline: { ratio: { numerator: '1', denominator: '3' } } });
});

it('should bind Planned reconciliation to the exact candidate and surface disagreement', () => {
  const candidate = { candidateId: 'candidate-1', revision: 'r1', digest: 'digest-1', plan, storedLifecycle: 'Planned', exposureFacts: [] };
  expect(derive(candidate)).toMatchObject({ status: 'Derived', reconciliation: { candidateId: 'candidate-1', revision: 'r1', digest: 'digest-1', expectedLifecycle: 'Planned' }, baseline: { oneR: '500' }, entryReadiness: 'Unfilled', positions: [], lotMatches: [], deviations: [], terminalDisposition: null });
  expect(derive({ ...candidate, storedLifecycle: 'Open' })).toEqual({ status: 'IntegrityBlocked', findings: ['LifecycleDisagreement'] });
  expect(derive({ ...candidate, plan: { ...plan, stop: '50' } })).toMatchObject({ status: 'IntegrityBlocked', findings: ['PositiveRiskRequired'] });
});
it('should reject blank and malformed decimal inputs as typed issues', () => {
  expect(assessPlan({ ...plan, entry: '', quantity: 'one', target: '12x' })).toEqual({ status: 'Rejected', issues: ['PositiveQuantityRequired', 'InvalidEntry', 'InvalidTarget'] });
});
it('should normalize decimal sign, zero and formatting without native-number conversion', () => {
  expect(assessPlan({ ...plan, quantity: '00100.00', entry: '+50.000', stop: '-0', target: '6e1' })).toMatchObject({ status: 'Accepted', plan: { quantity: '100', entry: '50', stop: '0', target: '60' }, baseline: { oneR: '5000', reward: '1000', conditions: [{ price: '0', amount: '5000' }, { price: '60', amount: '1000' }] } });
});
