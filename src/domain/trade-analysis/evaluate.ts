import { Temporal } from 'temporal-polyfill';
import { instrumentKey, multiplierOf, type Instrument, type OptionInstrument } from '../instrument/index.ts';
import type { Instant } from '../time/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import type { CalculationResult } from '../calculation-result/index.ts';
import type { DerivedTradeState, EntryQuality, OpenLot } from './derive.ts';
import { currentExpirationView, expirationValueAt } from './payoff.ts';
import type { ConditionBasis, PlanBaseline } from './plan.ts';

// The exact Mark revision a figure was valued with.
export interface MarkEvidence {
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly price: string;
}

// Structurally mirrors Market Data's MarkFrame: Trade Analysis never imports Market Data, and
// composition maps frames into this evidence.
export interface ObservationFrame {
  readonly instrument: Instrument;
  readonly tradingDate: string;
  readonly closeInstant: Instant;
  readonly resolution:
    | { readonly kind: 'Available'; readonly mark: MarkEvidence }
    | { readonly kind: 'Missing'; readonly stale?: StaleContext }
    | { readonly kind: 'AcknowledgedUnavailable'; readonly stale?: StaleContext };
}

// The as-of date lies outside session-policy coverage, so there is no Expected Mark Date or frame:
// Trade Analysis learns only the date and that nothing can be valued.
export interface UncoveredObservation {
  readonly instrument: ObservationFrame['instrument'];
  readonly date: string;
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
  // An option condition's Underlying price distance to its trigger (zero once crossed) and the price distance
  // beyond it (null while not crossed); the Measures above are then the option's risk or reward (A109).
  readonly underlying?: { readonly distance: Rational; readonly beyond: Rational | null };
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
  // For an option Trade `frame` is the contract's and `underlyingFrame` is the Underlying's (A110).
  readonly frame: ObservationFrame | UncoveredObservation;
  readonly underlyingFrame?: ObservationFrame | UncoveredObservation;
}

export interface AtEntryFigures {
  readonly label: 'AtEntry';
  readonly quantity: Rational;
  readonly averageEntry: Rational;
  readonly riskFromEntry: Rational;
  readonly rewardFromEntry: Rational;
}

// A111: an option Instrument with open quantity at the frame's cutoff and where it stands against its expiration
// date. `Due` holds from the expiration date itself, though figures stay valued until the day after (P25).
export interface ExpirationValueAtClose {
  readonly underlyingPrice: Rational;
  readonly value: Rational;
}

export interface SettlementItem {
  readonly instrument: OptionInstrument;
  // Signed contracts still open: negative for the short role.
  readonly quantity: Rational;
  readonly expiration: string;
  readonly status: 'Due' | 'NotYetDue';
}

export interface TradeEvaluation {
  readonly kind: 'Evaluated';
  readonly valuationDate: string;
  readonly coverage:
    | { readonly kind: 'Available'; readonly revisionId: string; readonly revisionNumber: number }
    | { readonly kind: 'Missing' }
    | { readonly kind: 'AcknowledgedUnavailable' }
    // The as-of date is outside session-policy coverage, so no Mark could apply.
    | { readonly kind: 'NotCovered' };
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
  // Incremental Reward to Target over Ongoing Risk to Stop (P40); NotApplicable once risk is zero.
  readonly rewardRiskNow: CalculationResult<Rational>;
  readonly conditions: readonly ConditionStatus[];
  // An option Position's value at expiration if the Underlying stays at its latest close (A122): its own
  // Calculation Result, apart from every Mark-to-Market figure.
  readonly expirationValueAtUnderlyingClose: CalculationResult<ExpirationValueAtClose>;
  readonly settlement: readonly SettlementItem[];
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
function atEntryOf(lots: readonly OpenLot[], stop: Rational, target: Rational, multiplier: Rational): AtEntryFigures | null {
  if (lots.length === 0) return null;
  const quantity = sum(lots.map((l) => l.quantity));
  const nonnegative = (r: Rational) => (r.compare(ZERO) > 0 ? r : ZERO);
  return {
    label: 'AtEntry',
    quantity,
    averageEntry: sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity),
    riskFromEntry: nonnegative(sum(lots.map((l) => l.quantity.mul(multiplier).mul(l.price.sub(stop))))),
    rewardFromEntry: nonnegative(sum(lots.map((l) => l.quantity.mul(multiplier).mul(target.sub(l.price))))),
  };
}

const atLeastZero = (r: Rational) => (r.compare(ZERO) > 0 ? r : ZERO);

const noRemainingPosition: CalculationResult<never> = { kind: 'NotApplicable', reason: 'NoRemainingPosition' };

export function evaluate(input: TradeEvaluationInput): TradeEvaluation {
  const { state, frame } = input;
  const lots = state.positions.flatMap((p) => p.openLots);
  // Outside coverage there is no frame, so no Mark can value anything.
  const covered = 'resolution' in frame ? frame : undefined;
  const date = 'resolution' in frame ? frame.tradingDate : frame.date;
  const quantity = sum(lots.map((l) => l.quantity));
  // Money formulas use quantity x multiplier x price; the Trade's one Instrument sets the multiplier (A99).
  const multiplier = Rational.of(BigInt(multiplierOf(state.positions[0]?.instrument ?? frame.instrument)));
  const cost = sum(lots.map((l) => l.quantity.mul(multiplier).mul(l.price)));
  const openingFees = sum(lots.map((l) => l.unconsumedOpeningFee));
  // Realized at the cutoff by derive: a Value that does not depend on the Mark (A92).
  const realized = state.realizedToDate;
  // Before D17 a Trade has its Plan's single original Stop (D1 A1). An option's measurement values are the
  // contract's values at expiration at the triggers (P24); a stock's are the trigger prices themselves.
  const stop = state.baseline.stopBasis[0]!.valueAtExpiration ?? decimal(state.baseline.stopBasis[0]!.condition.price);
  const target = state.baseline.targetBasis[0]!.valueAtExpiration ?? decimal(state.baseline.targetBasis[0]!.condition.price);
  const option = state.positions.map((p) => p.instrument).find((i): i is OptionInstrument => i.kind === 'Option');
  // Lots opened after the frame's close cannot be valued with its Mark (P12).
  const openedAfter = (close: Instant) =>
    lots.filter((l) => {
      const opening = state.facts.find((f) => f.factId === l.openingExecutionId)!;
      return Temporal.Instant.compare(opening.economicTime, close) > 0;
    });
  const openedAfterClose = covered !== undefined && openedAfter(covered.closeInstant).length > 0;
  // Every Mark-dependent figure is computed from the exact Mark, or is Unavailable naming why not.
  // A Mark for another Instrument values nothing here; the Position's Instrument is named instead.
  const foreign = state.positions.find(
    (p) => p.openLots.length > 0 && instrumentKey(p.instrument) !== instrumentKey(frame.instrument),
  );
  // At-entry Lots are relative to the latest exact Mark: this frame's, else its Stale context's, else none.
  // A frame for another Instrument holds no exact Mark for this Position, so every Lot is at entry.
  const latestExactCloseOf = () => {
    if (covered === undefined) return undefined;
    if (covered.resolution.kind === 'Available') return covered.closeInstant;
    return covered.resolution.stale?.closeInstant;
  };
  const latestExactClose = latestExactCloseOf();
  const atEntryLots = foreign || latestExactClose === undefined ? lots : openedAfter(latestExactClose);
  // After the expiration date the contract has no honest Mark, so no Mark is required and every current
  // figure is Unavailable(SettlementDue) (P25, A110).
  const pastExpiration = option !== undefined && lots.length > 0 && date > option.expiration;
  const unavailableResult = (): CalculationResult<never> => {
    if (pastExpiration) return { kind: 'Unavailable', reason: 'SettlementDue', instrument: option, expiration: option.expiration };
    if (!covered) return { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: frame.instrument, date };
    if (foreign) {
      return { kind: 'Unavailable', reason: 'MarkMissing', instrument: foreign.instrument, date };
    }
    if (openedAfterClose) {
      return { kind: 'Unavailable', reason: 'AwaitingClose', after: date };
    }
    return {
      kind: 'Unavailable',
      reason: covered.resolution.kind === 'Missing' ? 'MarkMissing' : 'AcknowledgedUnavailable',
      instrument: frame.instrument,
      date,
    };
  };
  const unavailable = unavailableResult();
  // The frame's Mark values the Position only when one remains, it is Available, and it applies to every Lot.
  const usableMark = lots.length > 0 && covered?.resolution.kind === 'Available' && !openedAfterClose && !foreign && !pastExpiration ? covered.resolution.mark : null;
  const marked = <T>(of: (mark: Rational, source: NonNullable<typeof usableMark>) => T): CalculationResult<T> => {
    if (lots.length === 0) return noRemainingPosition;
    if (usableMark) return value(of(decimal(usableMark.price), usableMark));
    return unavailable;
  };
  // Facts about the remaining Position, shown only while one remains.
  const current = (v: Rational) => (lots.length === 0 ? noRemainingPosition : value(v));
  const remainingOpen = (mark: Rational) => quantity.mul(multiplier).mul(mark).sub(cost).sub(openingFees);
  const currentMarked = (mark: Rational) => realized.add(remainingOpen(mark));
  const coverageOf = (): TradeEvaluation['coverage'] => {
    if (!covered) return { kind: 'NotCovered' };
    if (foreign) return { kind: 'Missing' };
    const { resolution } = covered;
    if (resolution.kind === 'Available') {
      return { kind: 'Available', revisionId: resolution.mark.revisionId, revisionNumber: resolution.mark.revisionNumber };
    }
    return { kind: resolution.kind };
  };
  const measure = (dollars: Rational): Measure => ({ dollars, planR: dollars.div(state.baseline.oneR) });
  // A Stop is crossed at or below it, a Target at or above it; the distance beyond is the Overrun (A42).
  const statusOf = (role: 'Stop' | 'Target', crossed: boolean): ConditionReading['status'] => {
    if (!crossed) return 'Active';
    if (role === 'Stop') return 'Breached';
    return 'Reached';
  };
  // An option Trade is read against two Marks: the contract's (`marked`) and the Underlying's (A110).
  const underlyingFrame = input.underlyingFrame;
  const underlyingInstrument: Instrument = underlyingFrame?.instrument ?? { kind: 'Stock', symbol: option?.symbol ?? '' };
  const underlyingDate = underlyingFrame ? ('resolution' in underlyingFrame ? underlyingFrame.tradingDate : underlyingFrame.date) : date;
  const underlyingMark = underlyingFrame && 'resolution' in underlyingFrame && underlyingFrame.resolution.kind === 'Available' ? underlyingFrame.resolution.mark : null;
  const underlyingUnavailable = (): CalculationResult<never> => {
    if (underlyingFrame && !('resolution' in underlyingFrame)) {
      return { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: underlyingInstrument, date: underlyingDate };
    }
    const acknowledged = underlyingFrame && 'resolution' in underlyingFrame && underlyingFrame.resolution.kind === 'AcknowledgedUnavailable';
    return { kind: 'Unavailable', reason: acknowledged ? 'AcknowledgedUnavailable' : 'MarkMissing', instrument: underlyingInstrument, date: underlyingDate };
  };
  const markedWithUnderlying = <T>(of: (mark: Rational, underlyingPrice: Rational, source: MarkEvidence) => T): CalculationResult<T> => {
    if (lots.length === 0) return noRemainingPosition;
    if (!usableMark) return unavailable;
    if (!underlyingMark) return underlyingUnavailable();
    return value(of(decimal(usableMark.price), decimal(underlyingMark.price), underlyingMark));
  };
  // A Stop lies below the Underlying for a Long Call and the Cash-Secured Put, above it for a Long Put.
  const stopBelow = option !== undefined && (option.right === 'Call') === (quantity.compare(ZERO) > 0);
  // One option condition read at the contract's Mark and the Underlying's price: the risk or reward the
  // Position keeps while the trigger holds, the Overrun once it is crossed, and the Underlying's distance.
  const optionReadingOf = (role: 'Stop' | 'Target', trigger: Rational, measureValue: Rational, mark: Rational, price: Rational) => {
    const toward = (role === 'Stop') === stopBelow ? price.sub(trigger) : trigger.sub(price);
    const crossed = toward.compare(ZERO) <= 0;
    const raw = quantity.mul(multiplier).mul(role === 'Stop' ? mark.sub(measureValue) : measureValue.sub(mark));
    return {
      crossed,
      amount: crossed ? ZERO : atLeastZero(raw),
      overrun: crossed ? atLeastZero(ZERO.sub(raw)) : null,
      underlying: { distance: atLeastZero(toward), beyond: crossed ? ZERO.sub(toward) : null },
    };
  };
  const optionConditionOf = (role: 'Stop' | 'Target', index: number, basis: ConditionBasis): ConditionStatus => ({
    id: `${role.toLowerCase()}-${index + 1}`,
    role,
    kind: 'UnderlyingPrice',
    boundary: basis.condition.price,
    result: markedWithUnderlying((mark, price, source): ConditionReading => {
      const r = optionReadingOf(role, decimal(basis.condition.price), basis.valueAtExpiration!, mark, price);
      return {
        status: statusOf(role, r.crossed),
        distance: measure(r.amount),
        overrun: r.overrun && measure(r.overrun),
        evidence: { instrument: underlyingInstrument, date: underlyingDate, mark: source },
        underlying: r.underlying,
      };
    }),
  });
  const conditionOf = (role: 'Stop' | 'Target', index: number, boundary: string): ConditionStatus => ({
    id: `${role.toLowerCase()}-${index + 1}`,
    role,
    kind: 'UnderlyingPrice',
    boundary,
    result: marked((mark, source): ConditionReading => {
      const toward = quantity.mul(role === 'Stop' ? mark.sub(decimal(boundary)) : decimal(boundary).sub(mark));
      const crossed = toward.compare(ZERO) <= 0;
      return {
        status: statusOf(role, crossed),
        distance: measure(atLeastZero(toward)),
        overrun: crossed ? measure(ZERO.sub(toward)) : null,
        evidence: { instrument: frame.instrument, date, mark: source },
      };
    }),
  });
  const ongoingRiskToStop = option
    ? markedWithUnderlying((mark, price) => optionReadingOf('Stop', decimal(state.baseline.stopBasis[0]!.condition.price), stop, mark, price).amount)
    : marked((mark) => atLeastZero(quantity.mul(mark.sub(stop))));
  const incrementalRewardToTarget = option
    ? markedWithUnderlying((mark, price) => optionReadingOf('Target', decimal(state.baseline.targetBasis[0]!.condition.price), target, mark, price).amount)
    : marked((mark) => atLeastZero(quantity.mul(target.sub(mark))));
  const inPlanR = (result: CalculationResult<Rational>): CalculationResult<Rational> =>
    result.kind === 'Value' ? value(result.value.div(state.baseline.oneR)) : result;
  // At expiration a long option loses its value; the short Put is put the shares, worth the strike less the Mark (A109).
  const strike = option && decimal(option.strike);
  const short = quantity.compare(ZERO) < 0;
  const worstCaseOngoingRisk = marked((mark) =>
    strike && short ? ZERO.sub(quantity).mul(multiplier).mul(strike.sub(mark)) : quantity.mul(multiplier).mul(mark),
  );
  const maximumIncrementalReward = (): CalculationResult<Rational> => {
    if (lots.length === 0) return noRemainingPosition;
    if (pastExpiration) return unavailable;
    if (!option || !strike || option.right === 'Call') {
      return { kind: 'Unbounded', direction: 'Above', explanation: option ? 'A long Call has no price ceiling' : 'A long Stock Position has no price ceiling' };
    }
    return marked((mark) => (short ? ZERO.sub(quantity).mul(multiplier).mul(mark) : quantity.mul(multiplier).mul(strike.sub(mark))));
  };
  // The Current Expiration Payoff read at the Underlying's exact Mark; never a Stale price, and never a
  // valuation (A122).
  const expirationValueAtUnderlyingClose = (): CalculationResult<ExpirationValueAtClose> => {
    if (state.baseline.stopBasis[0]!.valueAtExpiration === undefined) return { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' };
    if (lots.length === 0) return noRemainingPosition;
    if (pastExpiration) return unavailable;
    if (!underlyingMark) return underlyingUnavailable();
    const underlyingPrice = decimal(underlyingMark.price);
    const exposureLots = state.positions.flatMap((p) =>
      p.instrument.kind === 'Option'
        ? p.openLots.map((l) => ({ instrument: p.instrument as OptionInstrument, quantity: l.quantity, basis: l.price, unconsumedOpeningFee: l.unconsumedOpeningFee }))
        : [],
    );
    const view = currentExpirationView({ lots: exposureLots, realizedToDate: realized });
    return value({ underlyingPrice, value: expirationValueAt(view, underlyingPrice) });
  };
  const rewardRiskNowOf = (): CalculationResult<Rational> => {
    if (ongoingRiskToStop.kind !== 'Value') return ongoingRiskToStop;
    if (incrementalRewardToTarget.kind !== 'Value') return incrementalRewardToTarget;
    if (ongoingRiskToStop.value.compare(ZERO) <= 0) return { kind: 'NotApplicable', reason: 'NoOngoingRisk' };
    return value(incrementalRewardToTarget.value.div(ongoingRiskToStop.value));
  };
  return {
    kind: 'Evaluated',
    valuationDate: date,
    coverage: coverageOf(),
    openQuantity: current(quantity),
    openCost: current(cost),
    unconsumedOpeningFees: current(openingFees),
    marketValue: marked((mark) => quantity.mul(multiplier).mul(mark)),
    remainingOpenPnl: marked(remainingOpen),
    realizedToDate: current(realized),
    currentMarkedPnl: marked(currentMarked),
    currentMarkedPnlInPlanR: marked((mark) => currentMarked(mark).div(state.baseline.oneR)),
    incurredFees: current(state.fees.incurred),
    ongoingRiskToStop,
    worstCaseOngoingRisk,
    incrementalRewardToTarget,
    rewardRiskNow: rewardRiskNowOf(),
    ongoingRiskToStopInPlanR: inPlanR(ongoingRiskToStop),
    worstCaseOngoingRiskInPlanR: inPlanR(worstCaseOngoingRisk),
    incrementalRewardToTargetInPlanR: inPlanR(incrementalRewardToTarget),
    maximumIncrementalReward: maximumIncrementalReward(),
    conditions: option
      ? [
          ...state.baseline.stopBasis.map((basis, i) => optionConditionOf('Stop', i, basis)),
          ...state.baseline.targetBasis.map((basis, i) => optionConditionOf('Target', i, basis)),
        ]
      : [
          ...state.baseline.stopBasis.map((basis, i) => conditionOf('Stop', i, basis.condition.price)),
          ...state.baseline.targetBasis.map((basis, i) => conditionOf('Target', i, basis.condition.price)),
        ],
    expirationValueAtUnderlyingClose: expirationValueAtUnderlyingClose(),
    settlement: state.positions.flatMap((p): SettlementItem[] =>
      p.instrument.kind === 'Option' && p.openLots.length > 0
        ? [{ instrument: p.instrument, quantity: p.quantity, expiration: p.instrument.expiration, status: p.instrument.expiration <= date ? 'Due' : 'NotYetDue' }]
        : [],
    ),
    observation: { instrument: frame.instrument, tradingDate: date, mark: usableMark },
    deviations: [],
    coveredSubtotal: null,
    atEntry: atEntryOf(atEntryLots, stop, target, multiplier),
    planBaseline: { kind: 'Value', value: state.baseline },
    oneR: value(state.baseline.oneR),
    entryQuality: state.entryQuality,
    ...(!foreign && covered && covered.resolution.kind !== 'Available' && covered.resolution.stale && { staleContext: covered.resolution.stale }),
  };
}
