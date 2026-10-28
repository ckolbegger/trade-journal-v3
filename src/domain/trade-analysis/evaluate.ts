import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import type { CalculationResult, DerivedTradeState, EntryQuality, OpenLot } from './derive.ts';
import type { PlanBaseline } from './plan.ts';

// The exact Mark revision a figure was valued with.
export interface MarkEvidence {
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly price: string;
}

// Structurally mirrors Market Data's MarkFrame: Trade Analysis never imports Market Data, and
// composition maps frames into this evidence.
export interface ObservationFrame {
  readonly instrument: { readonly kind: 'Stock'; readonly symbol: string };
  readonly tradingDate: string;
  readonly closeInstant: Instant;
  readonly resolution:
    | { readonly kind: 'Available'; readonly mark: MarkEvidence }
    | { readonly kind: 'Missing'; readonly stale?: StaleContext }
    | { readonly kind: 'AcknowledgedUnavailable'; readonly stale?: StaleContext };
}

// The latest earlier Mark, disclosed as context and never used in a current figure.
export interface StaleContext {
  readonly tradingDate: string;
  readonly price: string;
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly closeInstant: Instant;
}

// A dollar amount with its Plan-R conversion.
export interface Measure {
  readonly dollars: Rational;
  readonly planR: Rational;
}

// One underlying-price condition read against the exact Mark, evidence included.
export interface ConditionReading {
  readonly status: 'Active' | 'Breached' | 'Reached';
  // Remaining distance to the boundary across the open Position; zero once crossed.
  readonly distance: Measure;
  // The distance beyond a crossed boundary; null while it is not crossed.
  readonly overrun: Measure | null;
  readonly evidence: { readonly instrument: ObservationFrame['instrument']; readonly date: string; readonly mark: MarkEvidence };
}

// Each Stop and Target is read independently (OR semantics); the id is its role and 1-based position.
export interface ConditionStatus {
  readonly id: string;
  readonly role: 'Stop' | 'Target';
  readonly kind: 'UnderlyingPrice';
  readonly boundary: string;
  readonly result: CalculationResult<ConditionReading>;
}

export interface TradeEvaluationInput {
  readonly state: DerivedTradeState;
  readonly frame: ObservationFrame;
}

export interface AtEntryFigures {
  readonly label: 'AtEntry';
  readonly quantity: Rational;
  readonly averageEntry: Rational;
  readonly riskFromEntry: Rational;
  readonly rewardFromEntry: Rational;
}

export interface TradeEvaluation {
  readonly kind: 'Evaluated';
  readonly valuationDate: string;
  readonly coverage:
    | { readonly kind: 'Available'; readonly revisionId: string; readonly revisionNumber: number }
    | { readonly kind: 'Missing' }
    | { readonly kind: 'AcknowledgedUnavailable' };
  readonly openQuantity: CalculationResult<Rational>;
  readonly openCost: CalculationResult<Rational>;
  readonly unconsumedOpeningFees: CalculationResult<Rational>;
  readonly marketValue: CalculationResult<Rational>;
  readonly remainingOpenPnl: CalculationResult<Rational>;
  readonly realizedToDate: CalculationResult<Rational>;
  readonly currentMarkedPnl: CalculationResult<Rational>;
  readonly currentMarkedPnlInPlanR: CalculationResult<Rational>;
  readonly incurredFees: CalculationResult<Rational>;
  readonly ongoingRiskToStop: CalculationResult<Rational>;
  readonly worstCaseOngoingRisk: CalculationResult<Rational>;
  readonly incrementalRewardToTarget: CalculationResult<Rational>;
  readonly conditions: readonly ConditionStatus[];
  // The observation the figures were computed from; mark is null when no exact Mark valued them.
  readonly observation: {
    readonly instrument: ObservationFrame['instrument'];
    readonly tradingDate: string;
    readonly mark: MarkEvidence | null;
  };
  // Mark-dependent Deviation occurrences: none until Stop Discipline lands in D12 (A44), and a
  // reached Target is never one.
  readonly deviations: readonly never[];
  readonly ongoingRiskToStopInPlanR: CalculationResult<Rational>;
  readonly worstCaseOngoingRiskInPlanR: CalculationResult<Rational>;
  readonly incrementalRewardToTargetInPlanR: CalculationResult<Rational>;
  // A long Stock Position's reward has no ceiling, so this never depends on the Mark.
  readonly maximumIncrementalReward: CalculationResult<Rational>;
  // Frozen at confirmation and resolved at the Entry Resolution Point, so never Mark-dependent.
  readonly planBaseline: CalculationResult<PlanBaseline>;
  readonly oneR: CalculationResult<Rational>;
  readonly entryQuality: EntryQuality;
  // Returned only when some Instrument component is covered and another is not (A43); a
  // single-Instrument Trade has none.
  readonly coveredSubtotal: null;
  // Lots opened after the frame's close, measured from their execution prices; null when none.
  readonly atEntry: AtEntryFigures | null;
  // Disclosure only: the latest earlier Mark, present when the frame's Mark is Missing.
  readonly staleContext?: StaleContext;
}

const ZERO = Rational.of(0n);
const sum = (values: readonly Rational[]) => values.reduce((total, v) => total.add(v), ZERO);

// Facts reaching analysis were validated when recorded, so their decimals parse.
function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

const value = <T>(v: T): CalculationResult<T> => ({ kind: 'Value', value: v });

// Risk and reward of lots measured from their execution prices, never called valuation or P&L (A54).
function atEntryOf(lots: readonly OpenLot[], stop: Rational, target: Rational): AtEntryFigures | null {
  if (lots.length === 0) return null;
  const quantity = sum(lots.map((l) => l.quantity));
  const nonnegative = (r: Rational) => (r.compare(ZERO) > 0 ? r : ZERO);
  return {
    label: 'AtEntry',
    quantity,
    averageEntry: sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity),
    riskFromEntry: nonnegative(sum(lots.map((l) => l.quantity.mul(l.price.sub(stop))))),
    rewardFromEntry: nonnegative(sum(lots.map((l) => l.quantity.mul(target.sub(l.price))))),
  };
}

const atLeastZero = (r: Rational) => (r.compare(ZERO) > 0 ? r : ZERO);

const noRemainingPosition: CalculationResult<never> = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };

export function evaluate(input: TradeEvaluationInput): TradeEvaluation {
  const { state, frame } = input;
  const lots = state.positions.flatMap((p) => p.openLots);
  const { resolution } = frame;
  const quantity = sum(lots.map((l) => l.quantity));
  const cost = sum(lots.map((l) => l.quantity.mul(l.price)));
  const openingFees = sum(lots.map((l) => l.unconsumedOpeningFee));
  // No disposals exist before D6, so nothing is realized yet.
  const realized = ZERO;
  // Before D17 a Trade has its Plan's single original Stop (D1 A1).
  const stop = decimal(state.baseline.stopBasis[0]!.condition.price);
  const target = decimal(state.baseline.targetBasis[0]!.condition.price);
  // Lots opened after the frame's close cannot be valued with its Mark (P12).
  const openedAfter = (close: Instant) =>
    lots.filter((l) => {
      const opening = state.facts.find((f) => f.factId === l.openingExecutionId)!;
      return Temporal.Instant.compare(opening.economicTime, close) > 0;
    });
  const openedAfterClose = openedAfter(frame.closeInstant).length > 0;
  // Every Mark-dependent figure is computed from the exact Mark, or is Unavailable naming why not.
  // A Mark for another Instrument values nothing here; the Position's Instrument is named instead.
  const foreign = state.positions.find(
    (p) => p.openLots.length > 0 && (p.instrument.kind !== frame.instrument.kind || p.instrument.symbol !== frame.instrument.symbol),
  );
  // At-entry Lots are relative to the latest exact Mark: this frame's, else its Stale context's, else none.
  // A frame for another Instrument holds no exact Mark for this Position, so every Lot is at entry.
  const latestExactClose = resolution.kind === 'Available' ? frame.closeInstant : resolution.stale?.closeInstant;
  const atEntryLots = foreign || latestExactClose === undefined ? lots : openedAfter(latestExactClose);
  const unavailableResult = (): CalculationResult<never> => {
    if (foreign) {
      return { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument: foreign.instrument, date: frame.tradingDate } };
    }
    if (openedAfterClose) {
      return { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: frame.tradingDate } };
    }
    return {
      kind: 'Unavailable',
      reason: resolution.kind === 'Missing' ? 'MarkMissing' : 'AcknowledgedUnavailable',
      detail: { instrument: frame.instrument, date: frame.tradingDate },
    };
  };
  const unavailable = unavailableResult();
  // The frame's Mark values the Position only when one remains, it is Available, and it applies to every Lot.
  const usableMark = lots.length > 0 && resolution.kind === 'Available' && !openedAfterClose && !foreign ? resolution.mark : null;
  const marked = <T>(of: (mark: Rational) => T): CalculationResult<T> => {
    if (lots.length === 0) return noRemainingPosition;
    if (usableMark) return value(of(decimal(usableMark.price)));
    return unavailable;
  };
  // Facts about the remaining Position, shown only while one remains.
  const current = (v: Rational) => (lots.length === 0 ? noRemainingPosition : value(v));
  const remainingOpen = (mark: Rational) => quantity.mul(mark).sub(cost).sub(openingFees);
  const currentMarked = (mark: Rational) => realized.add(remainingOpen(mark));
  const coverageOf = (): TradeEvaluation['coverage'] => {
    if (foreign) return { kind: 'Missing' };
    if (resolution.kind === 'Available') {
      return { kind: 'Available', revisionId: resolution.mark.revisionId, revisionNumber: resolution.mark.revisionNumber };
    }
    return { kind: resolution.kind };
  };
  const measure = (dollars: Rational): Measure => ({ dollars, planR: dollars.div(state.baseline.oneR) });
  // A Stop is crossed at or below it, a Target at or above it; the distance beyond is the Overrun (A42).
  const conditionOf = (role: 'Stop' | 'Target', index: number, boundary: string): ConditionStatus => ({
    id: `${role.toLowerCase()}-${index + 1}`,
    role,
    kind: 'UnderlyingPrice',
    boundary,
    result: marked((mark): ConditionReading => {
      const toward = quantity.mul(role === 'Stop' ? mark.sub(decimal(boundary)) : decimal(boundary).sub(mark));
      const crossed = toward.compare(ZERO) <= 0;
      return {
        status: !crossed ? 'Active' : role === 'Stop' ? 'Breached' : 'Reached',
        distance: measure(atLeastZero(toward)),
        overrun: crossed ? measure(ZERO.sub(toward)) : null,
        evidence: { instrument: frame.instrument, date: frame.tradingDate, mark: (resolution as { mark: MarkEvidence }).mark },
      };
    }),
  });
  return {
    kind: 'Evaluated',
    valuationDate: frame.tradingDate,
    coverage: coverageOf(),
    openQuantity: current(quantity),
    openCost: current(cost),
    unconsumedOpeningFees: current(openingFees),
    marketValue: marked((mark) => quantity.mul(mark)),
    remainingOpenPnl: marked(remainingOpen),
    realizedToDate: current(realized),
    currentMarkedPnl: marked(currentMarked),
    currentMarkedPnlInPlanR: marked((mark) => currentMarked(mark).div(state.baseline.oneR)),
    incurredFees: current(state.fees.incurredOpening),
    ongoingRiskToStop: marked((mark) => atLeastZero(quantity.mul(mark.sub(stop)))),
    worstCaseOngoingRisk: marked((mark) => quantity.mul(mark)),
    incrementalRewardToTarget: marked((mark) => atLeastZero(quantity.mul(target.sub(mark)))),
    ongoingRiskToStopInPlanR: marked((mark) => atLeastZero(quantity.mul(mark.sub(stop))).div(state.baseline.oneR)),
    worstCaseOngoingRiskInPlanR: marked((mark) => quantity.mul(mark).div(state.baseline.oneR)),
    incrementalRewardToTargetInPlanR: marked((mark) => atLeastZero(quantity.mul(target.sub(mark))).div(state.baseline.oneR)),
    maximumIncrementalReward:
      lots.length === 0 ? noRemainingPosition : { kind: 'Unbounded', direction: 'Above', explanation: 'A long Stock Position has no price ceiling' },
    conditions: [
      ...state.baseline.stopBasis.map((basis, i) => conditionOf('Stop', i, basis.condition.price)),
      ...state.baseline.targetBasis.map((basis, i) => conditionOf('Target', i, basis.condition.price)),
    ],
    observation: { instrument: frame.instrument, tradingDate: frame.tradingDate, mark: usableMark },
    deviations: [],
    coveredSubtotal: null,
    atEntry: atEntryOf(atEntryLots, stop, target),
    planBaseline: { kind: 'Value', value: state.baseline },
    oneR: value(state.baseline.oneR),
    entryQuality: state.entryQuality,
    ...(!foreign && resolution.kind !== 'Available' && resolution.stale && { staleContext: resolution.stale }),
  };
}
