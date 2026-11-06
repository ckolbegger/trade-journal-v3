import type { CalculationResult, NotApplicableReason } from '../calculation-result/index.ts';
import { multiplierOf, type Instrument, type OptionInstrument } from '../instrument/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';

// One open Lot of the Trade's remaining option exposure (the shape `derive` returns for options in
// T7.4): signed contracts (long positive, short negative), the premium per share it was opened at, and
// the opening fee not yet consumed by a disposal.
export interface PayoffLot {
  readonly instrument: OptionInstrument;
  readonly quantity: Rational;
  readonly basis: Rational;
  readonly unconsumedOpeningFee: Rational;
}

// The Trade's current exposure: its open Lots and the net P&L realized so far.
export interface CurrentExposure {
  readonly lots: readonly PayoffLot[];
  readonly realizedToDate: Rational;
}

// The Plan facts the Planned view reads (a PlanInput satisfies it; plan.ts imports this module, so it
// cannot import plan.ts back): each leg's Instrument, signed quantity and intended entry.
export interface PayoffPlan {
  readonly legs: readonly { readonly instrument: Instrument; readonly quantity: string; readonly intendedEntry: string }[];
}

// The input accepts Plan facts and exposure only: no Mark, date or price model, so no theoretical
// option price can enter a payoff.
export interface ExpirationPayoffInput {
  readonly plan: PayoffPlan;
  readonly exposure?: CurrentExposure;
}

// A linear piece of the curve over [from, to], or the ray [from, ∞) when `to` is null.
export interface PayoffSegment {
  readonly from: Rational;
  readonly to: Rational | null;
  readonly valueAtStart: Rational;
  readonly slope: Rational;
}

export type PayoffZero =
  | { readonly kind: 'Crossing'; readonly price: Rational }
  | { readonly kind: 'Touch'; readonly price: Rational }
  | { readonly kind: 'ZeroRange'; readonly from: Rational; readonly to: Rational | null };

export type Attainment =
  | { readonly kind: 'Point'; readonly at: Rational }
  | { readonly kind: 'Interval'; readonly from: Rational; readonly to: Rational }
  | { readonly kind: 'Ray'; readonly from: Rational };

export interface PayoffExtremum {
  readonly value: Rational;
  readonly attainedOn: readonly Attainment[];
}

export interface ExpirationPayoffView {
  readonly segments: readonly PayoffSegment[];
  readonly zeroSet: readonly PayoffZero[];
  readonly maximum: CalculationResult<PayoffExtremum, never, never>;
  readonly minimum: CalculationResult<PayoffExtremum, never, never>;
  // Zero for the Planned view.
  readonly realizedOffset: Rational;
  readonly unconsumedFees: Rational;
}

type NoAnchor = Extract<NotApplicableReason, { reason: 'NoOptionExpirationAnchor' }>;
type NoPosition = Extract<NotApplicableReason, { reason: 'NoRemainingPosition' }>;

export interface ExpirationPayoffs {
  readonly planned: CalculationResult<ExpirationPayoffView, never, NoAnchor>;
  readonly current: CalculationResult<ExpirationPayoffView, never, NoAnchor | NoPosition>;
}

const ZERO = Rational.of(0n);

const sign = (x: Rational): -1 | 0 | 1 => x.compare(ZERO);

// One option position of the curve: signed contracts, the premium per share it was opened at, and the
// contract's strike and right. The curve is the sum of these positions.
interface Position {
  readonly contracts: Rational;
  readonly basis: Rational;
  readonly strike: Rational;
  readonly right: 'Call' | 'Put';
  readonly multiplier: Rational;
}

function positionOf(instrument: OptionInstrument, contracts: Rational, basis: Rational): Position {
  const strike = parseDecimal(instrument.strike);
  if (!strike.ok) throw new Error('A frozen option strike is a valid decimal');
  return { contracts, basis, strike: strike.value, right: instrument.right, multiplier: Rational.of(BigInt(multiplierOf(instrument))) };
}

// The contract's intrinsic value at expiration at an Underlying price (A100).
function intrinsic(position: Position, price: Rational): Rational {
  const raw = position.right === 'Call' ? price.sub(position.strike) : position.strike.sub(price);
  return sign(raw) > 0 ? raw : ZERO;
}

// The curve over the Underlying price: exact, mark-free, and piecewise linear with kinks at strikes.
function curveOf(positions: readonly Position[], constant: Rational): readonly PayoffSegment[] {
  const valueAt = (price: Rational) =>
    positions.reduce((sum, p) => sum.add(p.contracts.mul(p.multiplier).mul(intrinsic(p, price).sub(p.basis))), constant);
  const breakpoints = [ZERO];
  for (const p of positions) {
    if (!breakpoints.some((b) => b.equals(p.strike))) breakpoints.push(p.strike);
  }
  breakpoints.sort((a, b) => a.compare(b));
  // Beyond the last strike only Calls still move with the price.
  const raySlope = positions.reduce((sum, p) => (p.right === 'Call' ? sum.add(p.contracts.mul(p.multiplier)) : sum), ZERO);
  const segments: PayoffSegment[] = [];
  breakpoints.forEach((from, i) => {
    const to = breakpoints[i + 1] ?? null;
    const valueAtStart = valueAt(from);
    const slope = to ? valueAt(to).sub(valueAtStart).div(to.sub(from)) : raySlope;
    const previous = segments[segments.length - 1];
    // Adjacent segments of equal slope are one segment.
    if (previous && previous.slope.equals(slope)) segments[segments.length - 1] = { ...previous, to };
    else segments.push({ from, to, valueAtStart, slope });
  });
  return segments;
}

const within = (price: Rational, from: Rational, to: Rational | null) => price.compare(from) >= 0 && (to === null || price.compare(to) <= 0);

function zeroSetOf(segments: readonly PayoffSegment[]): readonly PayoffZero[] {
  const ranges = segments.filter((s) => s.slope.equals(ZERO) && s.valueAtStart.equals(ZERO));
  const zeros: PayoffZero[] = ranges.map((s) => ({ kind: 'ZeroRange', from: s.from, to: s.to }));
  for (const s of segments) {
    if (s.slope.equals(ZERO)) continue;
    const price = s.from.sub(s.valueAtStart.div(s.slope));
    // A zero inside or at the edge of a Zero Range belongs to that range.
    if (ranges.some((z) => within(price, z.from, z.to))) continue;
    if (!within(price, s.from, s.to) || zeros.some((z) => z.kind !== 'ZeroRange' && z.price.equals(price))) continue;
    const left = segments.find((o) => o.from.compare(price) < 0 && (o.to === null || o.to.compare(price) >= 0));
    const right = segments.find((o) => o.from.compare(price) <= 0 && (o.to === null || o.to.compare(price) > 0));
    // The curve changes sign through the point exactly when both slopes lean the same way; at price 0
    // there is no left side, so the curve only touches zero there.
    const crossing = left !== undefined && right !== undefined && sign(left.slope) === sign(right.slope);
    zeros.push({ kind: crossing ? 'Crossing' : 'Touch', price });
  }
  const position = (z: PayoffZero) => (z.kind === 'ZeroRange' ? z.from : z.price);
  return zeros.sort((a, b) => position(a).compare(position(b)));
}

const startOf = (a: Attainment) => (a.kind === 'Point' ? a.at : a.from);
const covers = (a: Attainment, price: Rational) => within(price, startOf(a), a.kind === 'Interval' ? a.to : a.kind === 'Ray' ? null : a.at);

function extremumOf(segments: readonly PayoffSegment[], side: 'Maximum' | 'Minimum'): CalculationResult<PayoffExtremum, never, never> {
  const last = segments[segments.length - 1]!;
  const sense = side === 'Maximum' ? 1 : -1;
  if (sign(last.slope) === sense) {
    const direction = side === 'Maximum' ? 'Above' : 'Below';
    return { kind: 'Unbounded', direction, explanation: `The payoff ${side === 'Maximum' ? 'rises' : 'falls'} without limit as the Underlying price rises.` };
  }
  const best = segments.map((s) => s.valueAtStart).reduce((a, b) => (b.compare(a) * sense > 0 ? b : a));
  const attainedOn: Attainment[] = [];
  // A flat segment at the extreme is attained across it; any other kink at the extreme is one point.
  for (const s of segments) {
    if (!s.slope.equals(ZERO) || !s.valueAtStart.equals(best)) continue;
    attainedOn.push(s.to ? { kind: 'Interval', from: s.from, to: s.to } : { kind: 'Ray', from: s.from });
  }
  for (const s of segments) {
    if (s.valueAtStart.equals(best) && !attainedOn.some((a) => covers(a, s.from))) attainedOn.push({ kind: 'Point', at: s.from });
  }
  attainedOn.sort((a, b) => startOf(a).compare(startOf(b)));
  return { kind: 'Value', value: { value: best, attainedOn } };
}

function viewOf(positions: readonly Position[], realizedOffset: Rational, unconsumedFees: Rational): ExpirationPayoffView {
  const segments = curveOf(positions, realizedOffset.sub(unconsumedFees));
  return { segments, zeroSet: zeroSetOf(segments), maximum: extremumOf(segments, 'Maximum'), minimum: extremumOf(segments, 'Minimum'), realizedOffset, unconsumedFees };
}

// The Planned and Current Expiration Payoff of a single-expiration option Trade (AC-CALC-004). Each view
// is its own result: Planned from the Plan's intended entry, Current from the remaining open Lots, the
// realized-to-date offset and the unconsumed opening fees, with no hypothetical closing fee.
export function expirationPayoff(input: ExpirationPayoffInput): ExpirationPayoffs {
  const plannedLegs = input.plan.legs.flatMap((leg) => {
    const quantity = parseDecimal(leg.quantity);
    const entry = parseDecimal(leg.intendedEntry);
    return leg.instrument.kind === 'Option' && quantity.ok && entry.ok ? [positionOf(leg.instrument, quantity.value, entry.value)] : [];
  });
  // A Trade with no option has no option-expiration anchor for either view.
  if (plannedLegs.length === 0) {
    const none = { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' } as const;
    return { planned: none, current: none };
  }
  const planned = { kind: 'Value', value: viewOf(plannedLegs, ZERO, ZERO) } as const;
  const exposure = input.exposure;
  if (!exposure || exposure.lots.length === 0) return { planned, current: { kind: 'NotApplicable', reason: 'NoRemainingPosition' } };
  return { planned, current: { kind: 'Value', value: currentExpirationView(exposure) } };
}

// The Current view of an exposure with at least one open Lot: its remaining Lots, the realized-to-date
// offset and the unconsumed opening fees.
export function currentExpirationView(exposure: CurrentExposure): ExpirationPayoffView {
  const fees = exposure.lots.reduce((sum, lot) => sum.add(lot.unconsumedOpeningFee), ZERO);
  const open = exposure.lots.map((lot) => positionOf(lot.instrument, lot.quantity, lot.basis));
  return viewOf(open, exposure.realizedToDate, fees);
}

// The view's value at an Underlying price at expiration, read off the curve.
export function expirationValueAt(view: ExpirationPayoffView, price: Rational): Rational {
  const segment = view.segments.find((s) => within(price, s.from, s.to));
  if (!segment) throw new Error('An Underlying price is never negative');
  return segment.valueAtStart.add(segment.slope.mul(price.sub(segment.from)));
}
