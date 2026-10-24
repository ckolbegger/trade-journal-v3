import { describe, expect, it } from 'vitest';
import { derive, assessChange, type PlannedCandidate } from '../../src/domain/trade-analysis';
const plan = { instrument: { kind: 'Stock', symbol: 'XYZ', currency: 'USD' }, quantity: '100', entry: '50', stop: '45', target: '60', thesis: 'Improving earnings', invalidation: 'Earnings thesis fails' };
export function openingCandidate(): PlannedCandidate {
  const economicTime = '2026-10-21T14:00:00Z';
  return { candidateId: 'trade', revision: 'r2', digest: 'digest', plan, storedLifecycle: 'Open', exposureFacts: [], opening: {
    recordedAgreement: { factRevision: 'r2', lotMatches: [], deviations: [], entryResolution: { positionChangeId: 'change', economicTime } },
    plannedLegId: 'leg', positionChange: { id: 'change', version: 'change-v1', tradeId: 'trade', originTradeId: 'trade', kind: 'InitialStockEntry', economicTime, saveTime: economicTime, sequence: 2, executionIds: ['e1', 'e2'] },
    executions: [{ id: 'e1', version: 'e1-v1', tradeId: 'trade', positionChangeId: 'change', instrument: plan.instrument, action: 'Buy', quantity: '40', price: '49', fee: '1', economicTime, saveTime: economicTime, sequence: 3, plannedLegId: 'leg' }, { id: 'e2', version: 'e2-v1', tradeId: 'trade', positionChangeId: 'change', instrument: plan.instrument, action: 'Buy', quantity: '60', price: '51', fee: '2', economicTime, saveTime: economicTime, sequence: 4, plannedLegId: 'leg' }],
  } };
}
describe('complete Stock entry derivation', () => {
  it('case01 derives complete opening quantity, gross basis and actual fees while retaining frozen 1R', () => {
    expect(derive(openingCandidate())).toMatchObject({ status: 'Derived', reconciliation: { expectedLifecycle: 'Open' }, quantity: '100', grossBasis: '5020', openingFees: '3', realizedResult: { status: 'NotApplicable', reason: 'NoDisposal' }, baseline: { oneR: '500' } });
  });
});

it('case02 resolves actual risk/reward and weighted entry below the frozen ratio', () => {
  expect(derive(openingCandidate())).toMatchObject({ weightedEntry: { numerator: '251', denominator: '5' }, entryQuality: { status: 'Resolved', comparison: 'BelowPlan', risk: '523', reward: '977', ratio: { numerator: '977', denominator: '523' } }, entryResolution: { positionChangeId: 'change', economicTime: '2026-10-21T14:00:00Z' } });
});
it('case03 orders distinct Lots by economic instant and Recorded Sequence rather than input order', () => {
  const candidate = openingCandidate(); candidate.opening!.executions.reverse();
  expect(derive(candidate)).toMatchObject({ positions: [{ instrument: plan.instrument, quantity: '100', lots: [{ openingId: 'e1', quantity: '40', price: '49', openingFees: '1' }, { openingId: 'e2', quantity: '60', price: '51', openingFees: '2' }] }] });
});

it('case04 records all exact served-leg mismatches once but rejects uncovered management', () => {
  const candidate = openingCandidate();
  candidate.opening!.executions.forEach(execution => { execution.instrument = { kind: 'Stock', symbol: 'OTHER', currency: 'EUR' }; });
  candidate.opening!.recordedAgreement!.deviations = [{ kind: 'PlannedLegTerms', plannedLegId: 'leg', mismatches: ['symbol', 'currency'] }];
  expect(derive(candidate)).toMatchObject({ status: 'Derived', fulfillment: 'FilledWithDeviation', deviations: [{ kind: 'PlannedLegTerms', plannedLegId: 'leg', mismatches: ['symbol', 'currency'] }] });
  expect(assessChange({ ...candidate, storedLifecycle: 'Planned' })).toMatchObject({ status: 'Rejected', issues: ['MissingManagementCoverage'] });
});
it('case05 rejects every invalid decimal, incomplete quantity, instant and ownership without reconciliation', () => {
  for (const value of ['0', '-1', 'NaN', 'Infinity', '', '1x']) {
    const candidate = openingCandidate(); candidate.opening!.executions[0].quantity = value;
    const result = derive(candidate); expect(result.status).toBe('IntegrityBlocked');
    if (result.status === 'IntegrityBlocked') expect(result.findings).toContain('PositiveExecutionQuantityRequired');
  }
  const candidate = openingCandidate(); const execution = candidate.opening!.executions[0];
  execution.fee = '-1'; execution.price = 'NaN'; execution.economicTime = 'bad'; execution.tradeId = 'other'; execution.plannedLegId = 'other';
  const result = derive(candidate);
  expect(result.status).toBe('IntegrityBlocked');
  if (result.status === 'IntegrityBlocked') for (const issue of ['NonnegativeExecutionFeeRequired', 'NonnegativeExecutionPriceRequired', 'InvalidExecutionTime', 'ExecutionOwnershipMismatch', 'PlannedLegIntentMismatch']) expect(result.findings).toContain(issue);
  expect(result).not.toHaveProperty('reconciliation');
  const incomplete = openingCandidate(); incomplete.opening!.executions[0].quantity = '39';
  expect(derive(incomplete)).toMatchObject({ status: 'IntegrityBlocked', findings: ['CompletePlannedQuantityRequired'] });
});
it('case06 preserves repeating weighted entry and fee shares with exact conservation and tiny ratio comparisons', () => {
  const candidate = openingCandidate(); candidate.plan = { ...plan, quantity: '3', entry: '2', stop: '0', target: '4' };
  const [first, second] = candidate.opening!.executions; Object.assign(first, { quantity: '1', price: '1', fee: '0' }); Object.assign(second, { quantity: '2', price: '2', fee: '1' });
  expect(derive(candidate)).toMatchObject({ weightedEntry: { numerator: '5', denominator: '3' }, grossBasis: '5', openingFees: '1', entryQuality: { risk: '6', reward: '6', comparison: 'AsPlanned' }, positions: [{ lots: [{ openingFees: '0', feePerShare: { numerator: '0', denominator: '1' } }, { openingFees: '1', feePerShare: { numerator: '1', denominator: '2' } }] }] });
  candidate.plan = { ...plan, quantity: '3', entry: '2', stop: '0', target: '4' }; Object.assign(first, { fee: '1', quantity: '3', price: '2' }); candidate.opening!.executions = [first]; candidate.opening!.positionChange.executionIds = ['e1'];
  expect(derive(candidate)).toMatchObject({ openingFees: '1', positions: [{ lots: [{ feePerShare: { numerator: '1', denominator: '3' } }] }] });
  Object.assign(first, { fee: '0', price: '2.0000000000000000000000000000000000000001' });
  expect(derive(candidate)).toMatchObject({ entryQuality: { comparison: 'BelowPlan' } });
});

it('case05 agreement requires bound authoritative lifecycle, membership, lot links and deviations', () => {
  const candidate = openingCandidate(); delete candidate.opening!.recordedAgreement;
  expect(derive(candidate)).toMatchObject({ status: 'IntegrityBlocked', findings: ['MissingOpeningAgreement'] });
  expect(assessChange({ ...candidate, storedLifecycle: 'Planned' })).toMatchObject({ status: 'Accepted' });
  candidate.opening!.recordedAgreement = { factRevision: 'old', lotMatches: [], deviations: [], entryResolution: { positionChangeId: 'wrong', economicTime: '2026-10-21T14:00:00Z' } };
  expect(derive(candidate)).toMatchObject({ status: 'IntegrityBlocked', findings: ['OpeningAgreementDisagreement'] });
  const duplicate = openingCandidate(); duplicate.opening!.executions[1].id = 'e1';
  expect(derive(duplicate).status).toBe('IntegrityBlocked');
});
it('case06 nonpositive actual entry risk preserves dollars and returns an unavailable ratio', () => {
  for (const price of ['45', '44']) {
    const candidate = openingCandidate(); candidate.opening!.executions.forEach(execution => { execution.price = price; execution.fee = '0'; });
    expect(derive(candidate)).toMatchObject({ status: 'Derived', entryQuality: { status: 'Resolved', comparison: 'Unavailable', risk: price === '45' ? '0' : '-100', reward: price === '45' ? '1500' : '1600', ratio: { status: 'Unavailable', reason: 'NonpositiveEntryRisk' } } });
  }
});
it('verifies decimal rejection, instant ordering, intact membership and exact fee conservation at the public seam', () => {
  for (const field of ['fee', 'price'] as const) for (const value of ['-1', 'NaN', 'Infinity', '', '1x']) {
    const candidate = openingCandidate(); candidate.opening!.executions[0][field] = value;
    expect(derive(candidate).status).toBe('IntegrityBlocked');
  }
  for (const mutate of [
    (candidate: PlannedCandidate) => { candidate.opening!.positionChange.tradeId = 'other'; },
    (candidate: PlannedCandidate) => { candidate.opening!.positionChange.economicTime = 'bad'; },
    (candidate: PlannedCandidate) => { candidate.opening!.positionChange.executionIds = ['e1']; },
    (candidate: PlannedCandidate) => { candidate.opening!.executions[1].sequence = 3; },
    (candidate: PlannedCandidate) => { candidate.opening!.recordedAgreement!.lotMatches = [{ openingId: 'e1', disposingId: 'invented', quantity: '1' }]; },
    (candidate: PlannedCandidate) => { candidate.opening!.recordedAgreement!.entryResolution.economicTime = 'bad'; },
  ]) { const candidate = openingCandidate(); mutate(candidate); expect(derive(candidate).status).toBe('IntegrityBlocked'); }
  const candidate = openingCandidate(); candidate.opening!.executions[0].economicTime = '2026-10-21T14:00:00.000000001Z';
  const ordered = derive(candidate);
  expect(ordered.status).toBe('Derived');
  if (ordered.status === 'Derived') expect(ordered.positions[0]?.lots.map(lot => lot.openingId)).toEqual(['e2', 'e1']);
  candidate.plan = { ...plan, quantity: '3' }; candidate.opening!.executions = [{ ...candidate.opening!.executions[0], quantity: '3', fee: '1' }]; candidate.opening!.positionChange.executionIds = ['e1'];
  const result = derive(candidate);
  expect(result.status).toBe('Derived');
  if (result.status === 'Derived') {
    const share = result.positions[0]?.lots[0]?.feePerShare;
    expect(share).toEqual({ numerator: '1', denominator: '3' });
    // Independent integer arithmetic proves all three unrounded shares conserve the actual fee.
    expect(BigInt(share.numerator) * 3n).toBe(BigInt(share.denominator));
  }
});
