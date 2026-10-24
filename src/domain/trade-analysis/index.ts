import type { Execution, OpeningAgreement, PositionChange } from '../trade-record/opening-types';
import Decimal from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
export interface PlanInput {
  instrument?: { kind: string; symbol: string; currency: string };
  quantity: string;
  entry: string;
  stop: string;
  target: string;
  thesis: string;
  invalidation: string;
}
export interface Baseline {
  risk: string;
  oneR: string;
  reward: string;
  ratio: { numerator: string; denominator: string };
  conditions: { kind: 'Stop' | 'Target'; price: string; amount: string }[];
}
export type Assessment = { status: 'Accepted'; plan: PlanInput; baseline: Baseline; expirationMethod: { status: 'NotApplicable'; reason: 'NoOptionExpirationAnchor' } } | { status: 'Rejected'; issues: string[] };
export function assessPlan(input: PlanInput): Assessment {
  const issues: string[] = [];
  const instrument = input.instrument;
  if (!instrument || instrument.kind !== 'Stock' || instrument.currency !== 'USD' || !instrument.symbol.trim()) issues.push('ExactStockRequired');
  const quantity = parseDecimal(input.quantity);
  if (!quantity || !quantity.isFinite() || quantity.lte(0)) issues.push('PositiveQuantityRequired');
  if (!input.thesis.trim()) issues.push('ThesisRequired');
  if (!input.invalidation.trim()) issues.push('InvalidationRequired');
  for (const key of ['entry', 'stop', 'target'] as const) {
    const value = parseDecimal(input[key]);
    if (!value || !value.isFinite() || value.lt(0)) issues.push(`Invalid${key[0]?.toUpperCase()}${key.slice(1)}`);
  }
  if (!issues.some(issue => issue.startsWith('Invalid') && issue !== 'InvalidationRequired')) {
    if (new Decimal(input.entry).lte(input.stop)) issues.push('PositiveRiskRequired');
    if (new Decimal(input.target).lte(input.entry)) issues.push('ForwardRewardRequired');
  }
  if (issues.length) return { status: 'Rejected', issues };
  input = { ...input, instrument: input.instrument ? { ...input.instrument, symbol: input.instrument.symbol.trim().toUpperCase() } : undefined, ...Object.fromEntries((['quantity', 'entry', 'stop', 'target'] as const).map(key => [key, new Decimal(input[key]).isZero() ? '0' : new Decimal(input[key]).toFixed()])) };
  const values = [input.entry, input.stop, input.target, input.quantity].map(value => new Decimal(value));
  const precision = values.reduce((total, value) => total + value.sd() + value.dp() + Math.abs(value.e), 16);
  const Exact = Decimal.clone({ precision, rounding: Decimal.ROUND_HALF_EVEN });
  const risk = new Exact(input.entry).minus(input.stop).times(input.quantity).toFixed();
  const reward = new Exact(input.target).minus(input.entry).times(input.quantity).toFixed();
  return { status: 'Accepted', expirationMethod: { status: 'NotApplicable', reason: 'NoOptionExpirationAnchor' }, plan: structuredClone(input), baseline: { risk, oneR: risk, reward, ratio: { numerator: ratio(reward, risk).numerator, denominator: ratio(reward, risk).denominator }, conditions: [{ kind: 'Stop', price: input.stop, amount: risk }, { kind: 'Target', price: input.target, amount: reward }] } };
}

function ratio(numerator: string, denominator: string): { numerator: string; denominator: string } {
  const scale = Math.max(new Decimal(numerator).dp(), new Decimal(denominator).dp());
  const Exact = Decimal.clone({ precision: numerator.length + denominator.length + scale * 2 + 16 });
  let n = new Exact(numerator).times(new Exact(10).pow(scale));
  let d = new Exact(denominator).times(new Exact(10).pow(scale));
  let a = n.abs();
  let b = d.abs();
  while (!b.isZero()) { const remainder = a.mod(b); a = b; b = remainder; }
  n = n.div(a); d = d.div(a);
  return { numerator: n.toFixed(), denominator: d.toFixed() };
}
export interface OpeningInput {
  plannedLegId: string;
  positionChange: PositionChange;
  executions: Execution[];
  recordedAgreement?: OpeningAgreement;
}
export interface PlannedCandidate {
  candidateId: string;
  revision: string;
  digest: string;
  plan: PlanInput;
  storedLifecycle: string;
  exposureFacts: unknown[];
  opening?: OpeningInput;
}
export function derive(candidate: PlannedCandidate) {
  const assessment = assessPlan(candidate.plan);
  if (assessment.status === 'Rejected') return { status: 'IntegrityBlocked' as const, findings: assessment.issues };
  if (candidate.opening) return deriveOpening(candidate, assessment.baseline, candidate.opening);
  if (candidate.storedLifecycle !== 'Planned' || candidate.exposureFacts.length) return { status: 'IntegrityBlocked' as const, findings: ['LifecycleDisagreement'] };
  return { status: 'Derived' as const, reconciliation: { candidateId: candidate.candidateId, revision: candidate.revision, digest: candidate.digest, expectedLifecycle: 'Planned' as const }, baseline: assessment.baseline, entryReadiness: 'Unfilled' as const, positions: [], lotMatches: [], deviations: [], terminalDisposition: null };
}

function parseDecimal(value: string): Decimal | undefined {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return undefined;
  try { return new Decimal(value); } catch { return undefined; }
}

function exactEngine(values: string[]) {
  return Decimal.clone({ precision: values.reduce((total, value) => { const decimal = new Decimal(value); return total + decimal.sd() + decimal.dp() + Math.abs(decimal.e); }, 32), rounding: Decimal.ROUND_HALF_EVEN });
}
function deriveOpening(candidate: PlannedCandidate, baseline: Baseline, opening: OpeningInput, verifyAgreement = true) {
  const findings: string[] = [];
  const change = opening.positionChange;
  if (candidate.storedLifecycle !== 'Open') findings.push('LifecycleDisagreement');
  if (candidate.exposureFacts.length) findings.push('UnexpectedExposureFacts');
  if (change.tradeId !== candidate.candidateId || change.originTradeId !== candidate.candidateId) findings.push('PositionChangeOwnershipMismatch');
  if (change.kind !== 'InitialStockEntry') findings.push('InitialStockEntryRequired');
  if (!validInstant(change.economicTime) || !validInstant(change.saveTime)) findings.push('InvalidPositionChangeTime');
  if (!Number.isSafeInteger(change.sequence) || change.sequence < 1) findings.push('InvalidRecordedSequence');
  if (!opening.plannedLegId || !change.id || !change.version || !opening.executions.length) findings.push('OpeningIdentityRequired');
  const ids = new Set<string>(); const sequences = new Set<number>([change.sequence]);
  for (const execution of opening.executions) {
    const quantity = parseDecimal(execution.quantity); const price = parseDecimal(execution.price); const fee = parseDecimal(execution.fee);
    if (!quantity?.isFinite() || quantity.lte(0)) findings.push('PositiveExecutionQuantityRequired');
    if (!price?.isFinite() || price.lt(0)) findings.push('NonnegativeExecutionPriceRequired');
    if (!fee?.isFinite() || fee.lt(0)) findings.push('NonnegativeExecutionFeeRequired');
    if (!validInstant(execution.economicTime) || !validInstant(execution.saveTime)) findings.push('InvalidExecutionTime');
    if (execution.tradeId !== candidate.candidateId || execution.positionChangeId !== change.id) findings.push('ExecutionOwnershipMismatch');
    if (execution.plannedLegId !== opening.plannedLegId) findings.push('PlannedLegIntentMismatch');
    if (execution.action !== 'Buy') findings.push('BuyExecutionRequired');
    if (execution.instrument.kind !== 'Stock' || !execution.instrument.symbol.trim() || !execution.instrument.currency.trim()) findings.push('ExactStockRequired');
    if (!execution.id || !execution.version || ids.has(execution.id)) findings.push('DuplicateExecutionOwnership');
    ids.add(execution.id);
    if (!Number.isSafeInteger(execution.sequence) || execution.sequence < 1 || sequences.has(execution.sequence)) findings.push('InvalidRecordedSequence');
    sequences.add(execution.sequence);
  }
  if (change.executionIds.length !== ids.size || new Set(change.executionIds).size !== ids.size || change.executionIds.some(id => !ids.has(id))) findings.push('PositionChangeMembershipMismatch');
  if (findings.length) return { status: 'IntegrityBlocked' as const, findings: [...new Set(findings)] };

  const Exact = exactEngine([candidate.plan.stop, candidate.plan.target, baseline.risk, baseline.reward, ...opening.executions.flatMap(execution => [execution.quantity, execution.price, execution.fee])]);
  let quantity = new Exact(0); let grossBasis = new Exact(0); let fees = new Exact(0);
  for (const execution of opening.executions) {
    quantity = quantity.plus(execution.quantity);
    grossBasis = grossBasis.plus(new Exact(execution.quantity).times(execution.price));
    fees = fees.plus(execution.fee);
  }
  if (!quantity.eq(candidate.plan.quantity)) return { status: 'IntegrityBlocked' as const, findings: ['CompletePlannedQuantityRequired'] };
  const risk = grossBasis.minus(quantity.times(candidate.plan.stop)).plus(fees).toFixed();
  const reward = quantity.times(candidate.plan.target).minus(grossBasis).minus(fees).toFixed();
  const comparison = new Exact(reward).times(baseline.risk).comparedTo(new Exact(risk).times(baseline.reward));
  const mismatches = (['kind', 'symbol', 'currency'] as const).filter(key => opening.executions.some(execution => execution.instrument[key] !== candidate.plan.instrument?.[key]));
  const deviations: OpeningAgreement['deviations'] = mismatches.length ? [{ kind: 'PlannedLegTerms', plannedLegId: opening.plannedLegId, mismatches }] : [];
  const entryResolution = { positionChangeId: opening.positionChange.id, economicTime: opening.positionChange.economicTime };
  const agreement = opening.recordedAgreement;
  if (verifyAgreement && !agreement) return { status: 'IntegrityBlocked' as const, findings: ['MissingOpeningAgreement'] };
  if (verifyAgreement && agreement && (agreement.factRevision !== candidate.revision || agreement.lotMatches.length !== 0 || agreement.entryResolution.positionChangeId !== entryResolution.positionChangeId || !validInstant(agreement.entryResolution.economicTime) || Temporal.Instant.compare(agreement.entryResolution.economicTime, entryResolution.economicTime) !== 0 || agreement.deviations.length !== deviations.length || agreement.deviations.some((deviation, index) => { const expected = deviations[index]; return !expected || deviation.kind !== expected.kind || deviation.plannedLegId !== expected.plannedLegId || deviation.mismatches.join(',') !== expected.mismatches.join(','); }))) return { status: 'IntegrityBlocked' as const, findings: ['OpeningAgreementDisagreement'] };
  const fulfillment = deviations.length ? 'FilledWithDeviation' as const : 'FilledAsPlanned' as const;
  const positions: { instrument: Execution['instrument']; quantity: string; lots: { openingId: string; quantity: string; price: string; openingFees: string; feePerShare: { numerator: string; denominator: string } }[] }[] = [];
  for (const execution of [...opening.executions].sort((a, b) => Temporal.Instant.compare(a.economicTime, b.economicTime) || a.sequence - b.sequence)) {
    let position = positions.find(item => item.instrument.kind === execution.instrument.kind && item.instrument.symbol === execution.instrument.symbol && item.instrument.currency === execution.instrument.currency);
    if (!position) { position = { instrument: structuredClone(execution.instrument), quantity: '0', lots: [] }; positions.push(position); }
    position.quantity = new Exact(position.quantity).plus(execution.quantity).toFixed();
    position.lots.push({ openingId: execution.id, quantity: new Exact(execution.quantity).toFixed(), price: new Exact(execution.price).toFixed(), openingFees: new Exact(execution.fee).toFixed(), feePerShare: ratio(execution.fee, execution.quantity) });
  }
  return { status: 'Derived' as const, fulfillment, entryReadiness: fulfillment, weightedEntry: ratio(grossBasis.toFixed(), quantity.toFixed()), entryQuality: { status: 'Resolved' as const, comparison: new Exact(risk).lte(0) ? 'Unavailable' as const : comparison < 0 ? 'BelowPlan' as const : comparison > 0 ? 'AbovePlan' as const : 'AsPlanned' as const, risk, reward, ratio: new Exact(risk).lte(0) ? { status: 'Unavailable' as const, reason: 'NonpositiveEntryRisk' as const } : ratio(reward, risk) }, entryResolution: { positionChangeId: opening.positionChange.id, economicTime: opening.positionChange.economicTime }, reconciliation: { candidateId: candidate.candidateId, revision: candidate.revision, digest: candidate.digest, expectedLifecycle: 'Open' as const }, baseline, quantity: quantity.toFixed(), grossBasis: grossBasis.toFixed(), openingFees: fees.toFixed(), realizedResult: { status: 'NotApplicable' as const, reason: 'NoDisposal' as const }, positions, lotMatches: [], deviations, terminalDisposition: null };
}

export function assessChange(candidate: PlannedCandidate) {
  if (candidate.storedLifecycle !== 'Planned' || !candidate.opening) return { status: 'Rejected' as const, issues: ['InitialStockEntryRequiresPlannedTrade'] };
  const assessment = assessPlan(candidate.plan);
  if (assessment.status === 'Rejected') return assessment;
  const derivation = deriveOpening({ ...candidate, storedLifecycle: 'Open' }, assessment.baseline, candidate.opening, false);
  if (derivation.status !== 'Derived') return { status: 'Rejected' as const, issues: derivation.findings };
  if ('fulfillment' in derivation && derivation.fulfillment === 'FilledWithDeviation') return { status: 'Rejected' as const, issues: ['MissingManagementCoverage'] };
  return { status: 'Accepted' as const, derivation };
}

function validInstant(value: string) { try { Temporal.Instant.from(value); return true; } catch { return false; } }
