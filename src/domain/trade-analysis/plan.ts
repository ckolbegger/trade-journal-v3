import type { StrategyShape } from '../strategy.ts';
import { parseDecimal, Rational } from '../values/index.ts';

// Plan facts as proposed for confirmation; decimals are finite-decimal strings.
export interface PlannedLegInput {
  readonly side: 'Long' | 'Short';
  readonly instrument: { readonly kind: 'Stock'; readonly symbol: string };
  readonly quantity: string;
  readonly intendedEntry: string;
}

export type ConditionInput = { readonly kind: 'UnderlyingPrice'; readonly price: string };

export interface PlanInput {
  readonly underlying: string;
  readonly legs: readonly PlannedLegInput[];
  readonly stops: readonly ConditionInput[];
  readonly targets: readonly ConditionInput[];
}

export interface PlanAssessmentInput {
  readonly strategyShape: StrategyShape;
  readonly plan: PlanInput;
}

export interface ConditionBasis {
  readonly condition: ConditionInput;
  // Monetary distance from intended entry to this condition's boundary.
  readonly distance: Rational;
}

// The frozen Plan Baseline: intended entry against every original Stop and Target, with the
// nearest boundary of each kind as the headline (independent OR conditions).
export interface PlanBaseline {
  readonly originalPlannedRisk: Rational;
  readonly originalPlannedReward: Rational;
  readonly rewardRiskRatio: Rational;
  readonly oneR: Rational;
  readonly stopBasis: readonly ConditionBasis[];
  readonly targetBasis: readonly ConditionBasis[];
}

export interface PlanIssue {
  readonly code:
    | 'StrategyShapeMismatch'
    | 'MissingInstrument'
    | 'UnderlyingMismatch'
    | 'MissingStop'
    | 'MissingTarget'
    | 'InvalidQuantity'
    | 'InvalidPrice'
    | 'NoPositiveRisk'
    | 'TargetNotBeyondEntry';
}

export type PlanAssessment =
  | { readonly kind: 'Rejected'; readonly issues: readonly PlanIssue[] }
  | {
  readonly kind: 'Accepted';
  readonly baseline: PlanBaseline;
  // The Plan with every decimal in its normalized stored form; these are the facts frozen.
  readonly plan: PlanInput;
};

// A positive finite decimal, or undefined when the text is not one (A9).
function positive(text: string): Rational | undefined {
  const parsed = parseDecimal(text, { positive: true });
  return parsed.ok ? parsed.value : undefined;
}

function normalized(text: string): string {
  const parsed = parseDecimal(text);
  return parsed.ok ? parsed.normalized : text;
}

// Stock symbols are trimmed and upper-cased, then checked against the D1 format (A9).
const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;
function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function normalizePlan(plan: PlanInput): PlanInput {
  const condition = (c: ConditionInput): ConditionInput => ({ ...c, price: normalized(c.price) });
  return {
    underlying: normalizeSymbol(plan.underlying),
    legs: plan.legs.map((leg) => ({
      ...leg,
      instrument: { ...leg.instrument, symbol: normalizeSymbol(leg.instrument.symbol) },
      quantity: normalized(leg.quantity),
      intendedEntry: normalized(leg.intendedEntry),
    })),
    stops: plan.stops.map(condition),
    targets: plan.targets.map(condition),
  };
}

function nearest(basis: readonly ConditionBasis[]): Rational {
  return basis.map((b) => b.distance).reduce((min, d) => (d.compare(min) < 0 ? d : min));
}

// Planned Legs must fill the Strategy's ordered roles exactly.
function matchesShape(legs: readonly PlannedLegInput[], shape: StrategyShape): boolean {
  return (
    legs.length === shape.roles.length &&
    legs.every((leg, i) => leg.side === shape.roles[i]?.side && leg.instrument.kind === shape.roles[i]?.instrument)
  );
}

// Validates the proposed Plan and derives its frozen Plan Baseline. Every issue is returned
// together; nothing is written.
export function assessPlan(input: PlanAssessmentInput): PlanAssessment {
  const { plan } = input;
  const issues: PlanIssue[] = [];
  const issue = (code: PlanIssue['code']) => {
    if (!issues.some((i) => i.code === code)) issues.push({ code });
  };

  if (!matchesShape(plan.legs, input.strategyShape)) {
    issue('StrategyShapeMismatch');
    // The Long Stock rules below still apply to a leading Long Stock leg, so its issues are
    // reported together with the shape (AC-PLAN-002); any other leading leg is not assessed.
    const first = plan.legs[0];
    if (first?.side !== 'Long' || first.instrument.kind !== 'Stock') return { kind: 'Rejected', issues };
  }
  for (const leg of plan.legs) {
    const symbol = normalizeSymbol(leg.instrument.symbol);
    if (!SYMBOL.test(symbol)) issue('MissingInstrument');
    else if (symbol !== normalizeSymbol(plan.underlying)) issue('UnderlyingMismatch');
  }
  // Long Stock management requires one original Stop and one original Target (D1 A1).
  if (plan.stops.length === 0) issue('MissingStop');
  if (plan.targets.length === 0) issue('MissingTarget');

  const leg = plan.legs[0]!;
  const quantity = positive(leg.quantity);
  const entry = positive(leg.intendedEntry);
  const stops = plan.stops.map((condition) => ({ condition, price: positive(condition.price) }));
  const targets = plan.targets.map((condition) => ({ condition, price: positive(condition.price) }));
  if (!quantity) issue('InvalidQuantity');
  if (!entry || [...stops, ...targets].some((c) => !c.price)) issue('InvalidPrice');
  if (!quantity || !entry || issues.some((i) => i.code === 'MissingStop' || i.code === 'MissingTarget' || i.code === 'InvalidPrice')) {
    return { kind: 'Rejected', issues };
  }

  const stopBasis = stops.map(({ condition, price }) => ({ condition: { ...condition }, distance: entry.sub(price!).mul(quantity) }));
  const targetBasis = targets.map(({ condition, price }) => ({ condition: { ...condition }, distance: price!.sub(entry).mul(quantity) }));
  const zero = Rational.of(0n);
  // Original Planned Risk must be positive: it is exactly 1R.
  if (nearest(stopBasis).compare(zero) <= 0) issue('NoPositiveRisk');
  // A Long Stock Target must lie above intended entry (D1 A1).
  if (nearest(targetBasis).compare(zero) <= 0) issue('TargetNotBeyondEntry');
  if (issues.length > 0) return { kind: 'Rejected', issues };

  return { kind: 'Accepted', baseline: baselineOf(stopBasis, targetBasis), plan: normalizePlan(plan) };
}

function baselineOf(stopBasis: readonly ConditionBasis[], targetBasis: readonly ConditionBasis[]): PlanBaseline {
  const risk = nearest(stopBasis);
  const reward = nearest(targetBasis);
  return {
    originalPlannedRisk: risk,
    originalPlannedReward: reward,
    rewardRiskRatio: reward.div(risk),
    oneR: risk,
    stopBasis,
    targetBasis,
  };
}

// The Plan Baseline of an already confirmed (and therefore valid) Plan, recomputed from its
// frozen facts: deterministic, so it never needs storing.
export function frozenBaseline(plan: PlanInput): PlanBaseline {
  const leg = plan.legs[0]!;
  const quantity = positive(leg.quantity)!;
  const entry = positive(leg.intendedEntry)!;
  // Conditions are copied so the inert output never aliases the caller's input.
  return baselineOf(
    plan.stops.map((condition) => ({ condition: { ...condition }, distance: entry.sub(positive(condition.price)!).mul(quantity) })),
    plan.targets.map((condition) => ({ condition: { ...condition }, distance: positive(condition.price)!.sub(entry).mul(quantity) })),
  );
}
