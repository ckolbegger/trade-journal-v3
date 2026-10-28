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

const value = (v: Rational): CalculationResult<Rational> => ({ kind: 'Value', value: v });

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

const noRemainingPosition: CalculationResult<Rational> = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };

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
  // At-entry Lots are relative to the latest exact Mark: this frame's, else its Stale context's, else none.
  const latestExactClose = resolution.kind === 'Available' ? frame.closeInstant : resolution.stale?.closeInstant;
  const atEntryLots = latestExactClose === undefined ? lots : openedAfter(latestExactClose);
  // Every Mark-dependent figure is computed from the exact Mark, or is Unavailable naming why not.
  // A Mark for another Instrument values nothing here; the Position's Instrument is named instead.
  const foreign = state.positions.find(
    (p) => p.openLots.length > 0 && (p.instrument.kind !== frame.instrument.kind || p.instrument.symbol !== frame.instrument.symbol),
  );
  const unavailable: CalculationResult<Rational> = foreign
    ? { kind: 'Unavailable', reason: 'MarkMissing', detail: { instrument: foreign.instrument, date: frame.tradingDate } }
    : openedAfterClose
    ? { kind: 'Unavailable', reason: 'AwaitingClose', detail: { after: frame.tradingDate } }
    : {
        kind: 'Unavailable',
        reason: resolution.kind === 'Missing' ? 'MarkMissing' : 'AcknowledgedUnavailable',
        detail: { instrument: frame.instrument, date: frame.tradingDate },
      };
  const marked = (of: (mark: Rational) => Rational): CalculationResult<Rational> =>
    lots.length === 0 ? noRemainingPosition : resolution.kind === 'Available' && !openedAfterClose && !foreign ? value(of(decimal(resolution.mark.price))) : unavailable;
  // Facts about the remaining Position, shown only while one remains.
  const current = (v: Rational) => (lots.length === 0 ? noRemainingPosition : value(v));
  const remainingOpen = (mark: Rational) => quantity.mul(mark).sub(cost).sub(openingFees);
  const currentMarked = (mark: Rational) => realized.add(remainingOpen(mark));
  return {
    kind: 'Evaluated',
    valuationDate: frame.tradingDate,
    coverage:
      foreign
        ? { kind: 'Missing' }
        : resolution.kind === 'Available'
        ? { kind: 'Available', revisionId: resolution.mark.revisionId, revisionNumber: resolution.mark.revisionNumber }
        : { kind: resolution.kind },
    openQuantity: current(quantity),
    openCost: current(cost),
    unconsumedOpeningFees: current(openingFees),
    marketValue: marked((mark) => quantity.mul(mark)),
    remainingOpenPnl: marked(remainingOpen),
    realizedToDate: current(realized),
    currentMarkedPnl: marked(currentMarked),
    currentMarkedPnlInPlanR: marked((mark) => currentMarked(mark).div(state.baseline.oneR)),
    incurredFees: current(state.fees.incurredOpening),
    ongoingRiskToStop: marked((mark) => quantity.mul(mark.sub(stop))),
    worstCaseOngoingRisk: marked((mark) => quantity.mul(mark)),
    incrementalRewardToTarget: marked((mark) => quantity.mul(target.sub(mark))),
    coveredSubtotal: null,
    atEntry: atEntryOf(atEntryLots, stop, target),
    planBaseline: { kind: 'Value', value: state.baseline },
    oneR: value(state.baseline.oneR),
    entryQuality: state.entryQuality,
    ...(!foreign && resolution.kind !== 'Available' && resolution.stale && { staleContext: resolution.stale }),
  };
}
