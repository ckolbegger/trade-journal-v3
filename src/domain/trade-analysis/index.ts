import Decimal from 'decimal.js';
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
export interface PlannedCandidate {
  candidateId: string;
  revision: string;
  digest: string;
  plan: PlanInput;
  storedLifecycle: string;
  exposureFacts: unknown[];
}
export function derive(candidate: PlannedCandidate) {
  const assessment = assessPlan(candidate.plan);
  if (assessment.status === 'Rejected') return { status: 'IntegrityBlocked' as const, findings: assessment.issues };
  if (candidate.storedLifecycle !== 'Planned' || candidate.exposureFacts.length) return { status: 'IntegrityBlocked' as const, findings: ['LifecycleDisagreement'] };
  return { status: 'Derived' as const, reconciliation: { candidateId: candidate.candidateId, revision: candidate.revision, digest: candidate.digest, expectedLifecycle: 'Planned' as const }, baseline: assessment.baseline, entryReadiness: 'Unfilled' as const, positions: [], lotMatches: [], deviations: [], terminalDisposition: null };
}

function parseDecimal(value: string): Decimal | undefined {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return undefined;
  try { return new Decimal(value); } catch { return undefined; }
}
