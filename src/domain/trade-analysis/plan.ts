import type { StrategyShape } from '../strategy.ts';
import { Temporal } from 'temporal-polyfill';
import { multiplierOf, validateOptionContract, type ContractIssue, type OptionInstrument, type StockInstrument } from '../instrument/index.ts';
import type { Instant } from '../time/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { expirationPayoff, type ExpirationPayoffs } from './payoff.ts';

// Plan facts as proposed for confirmation; decimals are finite-decimal strings.
export interface PlannedLegInput {
  readonly side: 'Long' | 'Short';
  readonly instrument: StockInstrument | OptionInstrument;
  readonly quantity: string;
  readonly intendedEntry: string;
}

export type ConditionInput = { readonly kind: 'UnderlyingPrice'; readonly price: string };

export interface PlanInput {
  readonly underlying: string;
  readonly legs: readonly PlannedLegInput[];
  readonly stops: readonly ConditionInput[];
  readonly targets: readonly ConditionInput[];
  // A fact of a long option Plan only (A100).
  readonly exerciseIntent?: 'Authorized' | 'NotAuthorized';
}

export interface PlanAssessmentInput {
  // The Plan's Economic Time; an option Plan's expiration is checked against its New York date.
  readonly economicTime: Instant;
  readonly strategyShape: StrategyShape;
  readonly plan: PlanInput;
}

export interface ConditionBasis {
  readonly condition: ConditionInput;
  // Monetary distance from intended entry to this condition's boundary.
  readonly distance: Rational;
  // An option condition's measurement basis, derived from its Underlying trigger: the contract's
  // value at expiration at that price (P24, A100). Absent for stock.
  readonly valueAtExpiration?: Rational;
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
    | 'TargetNotBeyondEntry'
    | 'StopTargetOrder'
    | 'ExerciseIntentRequired'
    | 'ExerciseIntentNotApplicable'
    | 'ContractQuantityNotWhole'
    | 'ContractAlreadyExpired'
    | 'ConditionCountNotOne'
    | ContractIssue;
  // An option rejection that names a breakeven carries it here (A100); a rejection for more than
  // one Stop or Target names the conditions beyond the first of each kind.
  readonly details?: { readonly breakeven?: Rational; readonly extraConditions?: readonly ConditionInput[] };
}

export type PlanAssessment =
  | { readonly kind: 'Rejected'; readonly issues: readonly PlanIssue[] }
  | {
  readonly kind: 'Accepted';
  readonly baseline: PlanBaseline;
  // The Plan with every decimal in its normalized stored form; these are the facts frozen.
  readonly plan: PlanInput;
  // The Planned Expiration Payoff of the frozen Plan facts; NotApplicable for a Plan with no option.
  readonly plannedPayoff: ExpirationPayoffs['planned'];
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

// The accepted option leg carries the canonical Instrument (A99): normalized strike, derived root.
function normalizePlan(plan: PlanInput, canonical?: OptionInstrument): PlanInput {
  const condition = (c: ConditionInput): ConditionInput => ({ ...c, price: normalized(c.price) });
  return {
    underlying: normalizeSymbol(plan.underlying),
    legs: plan.legs.map((leg, i) => ({
      ...leg,
      instrument: i === 0 && canonical ? canonical : { ...leg.instrument, symbol: normalizeSymbol(leg.instrument.symbol) },
      quantity: normalized(leg.quantity),
      intendedEntry: normalized(leg.intendedEntry),
    })),
    stops: plan.stops.map(condition),
    targets: plan.targets.map(condition),
    ...(plan.exerciseIntent ? { exerciseIntent: plan.exerciseIntent } : {}),
  };
}

function nearest(basis: readonly ConditionBasis[]): Rational {
  return basis.map((b) => b.distance).reduce((min, d) => (d.compare(min) < 0 ? d : min));
}

// Planned Legs must fill the Strategy's ordered roles exactly.
function matchesShape(legs: readonly PlannedLegInput[], shape: StrategyShape): boolean {
  return (
    legs.length === shape.roles.length &&
    legs.every((leg, i) => leg.side === shape.roles[i]?.side && roleOf(leg) === shape.roles[i]?.instrument)
  );
}

// The leg's nonzero quantity as a magnitude: a stock quantity is positive, an option's is signed by
// its side (A100), so the side carries the direction.
function contractsOf(leg: PlannedLegInput): Rational | undefined {
  const parsed = parseDecimal(leg.quantity);
  if (!parsed.ok || parsed.value.numerator === 0n) return undefined;
  if (leg.instrument.kind === 'Stock') return positive(leg.quantity);
  const negative = parsed.value.numerator < 0n;
  // Contracts are positive for a long leg and negative for a short one (A100).
  if (negative !== (leg.side === 'Short')) return undefined;
  return negative ? Rational.of(0n).sub(parsed.value) : parsed.value;
}

// An option's breakeven Underlying price at expiration: strike plus the entry premium for a Call,
// strike minus it for a Put (A100).
function breakevenOf(leg: PlannedLegInput, entry: Rational): Rational | undefined {
  if (leg.instrument.kind === 'Stock') return undefined;
  const strike = parseDecimal(leg.instrument.strike);
  if (!strike.ok) return undefined;
  return leg.instrument.right === 'Call' ? strike.value.add(entry) : strike.value.sub(entry);
}

function roleOf(leg: PlannedLegInput): 'Stock' | 'Call' | 'Put' {
  return leg.instrument.kind === 'Stock' ? 'Stock' : leg.instrument.right;
}

// The leg's value per unit at a condition's Underlying trigger: the price itself for stock, the
// contract's intrinsic value at expiration for an option (P24, A100). Never entered or stored.
function valueAtTrigger(instrument: StockInstrument | OptionInstrument, trigger: Rational): Rational {
  if (instrument.kind === 'Stock') return trigger;
  const strike = parseDecimal(instrument.strike);
  if (!strike.ok) throw new Error('incoherent');
  const intrinsic = instrument.right === 'Call' ? trigger.sub(strike.value) : strike.value.sub(trigger);
  return intrinsic.compare(Rational.of(0n)) > 0 ? intrinsic : Rational.of(0n);
}

// Monetary distance from intended entry to a condition's boundary: the loss at a Stop, the gain at
// a Target, as quantity x multiplier x (price difference) for the leg's side.
function boundary(
  leg: PlannedLegInput,
  entry: Rational,
  contracts: Rational,
  condition: ConditionInput,
  trigger: Rational,
  kind: 'Stop' | 'Target',
): ConditionBasis {
  const value = valueAtTrigger(leg.instrument, trigger);
  const gain = leg.side === 'Long' ? value.sub(entry) : entry.sub(value);
  const scaled = (kind === 'Target' ? gain : Rational.of(0n).sub(gain)).mul(contracts).mul(Rational.of(BigInt(multiplierOf(leg.instrument))));
  return leg.instrument.kind === 'Stock'
    ? { condition: { ...condition }, distance: scaled }
    : { condition: { ...condition }, distance: scaled, valueAtExpiration: value };
}

// An option leg's contract (T7.1), whole contracts, and an expiration on or after the Plan's New York
// date (Plan Economic Time, decision 20). Trade Analysis keeps no calendar: only the date is compared.
// Returns the canonical Option Instrument when the contract itself is valid, which the arithmetic
// and the accepted Plan need.
function assessContract(leg: PlannedLegInput, economicTime: Instant, issue: (code: PlanIssue['code']) => void): OptionInstrument | undefined {
  if (leg.instrument.kind !== 'Option') return undefined;
  const contract = validateOptionContract(leg.instrument);
  if (!contract.ok) for (const code of contract.issues) issue(code);
  const quantity = parseDecimal(leg.quantity);
  if (quantity.ok && quantity.value.denominator !== 1n) issue('ContractQuantityNotWhole');
  if (contract.ok) {
    const planDate = Temporal.Instant.from(economicTime).toZonedDateTimeISO('America/New_York').toPlainDate().toString();
    if (leg.instrument.expiration < planDate) issue('ContractAlreadyExpired');
  }
  return contract.ok ? contract.instrument : undefined;
}

// Validates the proposed Plan and derives its frozen Plan Baseline. Every issue is returned
// together; nothing is written.
export function assessPlan(input: PlanAssessmentInput): PlanAssessment {
  const { plan } = input;
  const issues: PlanIssue[] = [];
  const issue = (code: PlanIssue['code'], details?: PlanIssue['details']) => {
    if (!issues.some((i) => i.code === code)) issues.push(details ? { code, details } : { code });
  };

  const shapeMismatch = !matchesShape(plan.legs, input.strategyShape);
  if (shapeMismatch) {
    issue('StrategyShapeMismatch');
    // The Long Stock rules below still apply to a leading Long Stock leg, so its issues are
    // reported together with the shape (AC-PLAN-002); any other leading leg is not assessed.
    const first = plan.legs[0];
    if (first?.instrument.kind !== 'Option' && (first?.side !== 'Long' || first.instrument.kind !== 'Stock')) return { kind: 'Rejected', issues };
  }
  // Exercise Intent is a fact of long options only (A100).
  const first = plan.legs[0];
  if (plan.exerciseIntent && !(first?.instrument.kind === 'Option' && first.side === 'Long')) issue('ExerciseIntentNotApplicable');
  let calculable = true;
  let canonical: OptionInstrument | undefined;
  if (first?.instrument.kind === 'Option') {
    if (first.side === 'Long' && !plan.exerciseIntent) issue('ExerciseIntentRequired');
    // An invalid contract has no value at expiration, and a Strategy mismatch leaves the leg's
    // direction ambiguous, so neither has its risk and reward assessed.
    canonical = assessContract(first, input.economicTime, issue);
    calculable = canonical !== undefined && !shapeMismatch;
  }
  for (const leg of plan.legs) {
    const symbol = normalizeSymbol(leg.instrument.symbol);
    if (!SYMBOL.test(symbol)) issue('MissingInstrument');
    else if (symbol !== normalizeSymbol(plan.underlying)) issue('UnderlyingMismatch');
  }
  // Long Stock management requires one original Stop and one original Target (D1 A1).
  if (plan.stops.length === 0) issue('MissingStop');
  if (plan.targets.length === 0) issue('MissingTarget');
  // An option Plan has exactly one Underlying-price Stop and one Target (A100).
  if (first?.instrument.kind === 'Option') {
    const extraConditions = [...plan.stops.slice(1), ...plan.targets.slice(1)].map((c) => ({ ...c }));
    if (extraConditions.length > 0) issue('ConditionCountNotOne', { extraConditions });
  }

  const leg = plan.legs[0]!;
  const quantity = contractsOf(leg);
  const entry = positive(leg.intendedEntry);
  const stops = plan.stops.map((condition) => ({ condition, price: positive(condition.price) }));
  const targets = plan.targets.map((condition) => ({ condition, price: positive(condition.price) }));
  if (!quantity) issue('InvalidQuantity');
  if (!entry || [...stops, ...targets].some((c) => !c.price)) issue('InvalidPrice');
  if (!calculable || !quantity || !entry || issues.some((i) => i.code === 'MissingStop' || i.code === 'MissingTarget' || i.code === 'InvalidPrice')) {
    return { kind: 'Rejected', issues };
  }

  const stopBasis = stops.map(({ condition, price }) => boundary(leg, entry, quantity, condition, price!, 'Stop'));
  const targetBasis = targets.map(({ condition, price }) => boundary(leg, entry, quantity, condition, price!, 'Target'));
  const zero = Rational.of(0n);
  // The Underlying Stop lies below the Target for a bullish Strategy and above it for a bearish one.
  if (leg.instrument.kind === 'Option') {
    const bullish = (leg.side === 'Long') === (leg.instrument.right === 'Call');
    const misordered = stops.some((s) => targets.some((t) => (bullish ? s.price!.compare(t.price!) >= 0 : s.price!.compare(t.price!) <= 0)));
    if (misordered) issue('StopTargetOrder');
  }
  // Original Planned Risk must be positive: it is exactly 1R.
  // The Cash-Secured Put's Stop must lie below the breakeven, which its rejection names (A100).
  const breakeven = breakevenOf(leg, entry);
  if (nearest(stopBasis).compare(zero) <= 0) issue('NoPositiveRisk', leg.side === 'Short' && breakeven ? { breakeven } : undefined);
  // A Long Stock Target must lie above intended entry (D1 A1).
  if (nearest(targetBasis).compare(zero) <= 0) issue('TargetNotBeyondEntry', breakeven && { breakeven });
  if (issues.length > 0) return { kind: 'Rejected', issues };

  const frozen = normalizePlan(plan, canonical);
  return { kind: 'Accepted', baseline: baselineOf(stopBasis, targetBasis), plan: frozen, plannedPayoff: expirationPayoff({ plan: frozen }).planned };
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
  const contracts = contractsOf(leg)!;
  const entry = positive(leg.intendedEntry)!;
  // Conditions are copied so the inert output never aliases the caller's input.
  return baselineOf(
    plan.stops.map((condition) => boundary(leg, entry, contracts, condition, positive(condition.price)!, 'Stop')),
    plan.targets.map((condition) => boundary(leg, entry, contracts, condition, positive(condition.price)!, 'Target')),
  );
}
