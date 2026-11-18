import { Temporal } from 'temporal-polyfill';
import { instrumentKey, multiplierOf, type Instrument, type OptionInstrument } from '../instrument/index.ts';
import type { Instant } from '../time/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import type { CalculationResult } from '../calculation-result/index.ts';
import { type ContractStatus, type DerivedTradeState, type EntryQuality, type OpenLot } from './derive.ts';
import { currentExpirationView, expirationValueAt } from './payoff.ts';
import { headlineBasisOf, measurementAheadOf, measurementOf, type ConditionBasis, type PlanBaseline } from './plan.ts';

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
  // A230: the distance to the condition's own price trigger, in that price: zero once crossed, `beyond` the distance past it.
  readonly trigger?: { readonly distance: Rational; readonly beyond: Rational | null };
}

// Each Stop and Target is read independently (OR semantics); the id is its role and 1-based position.
export interface ConditionStatus {
  readonly id: string;
  readonly role: 'Stop' | 'Target';
  readonly kind: 'UnderlyingPrice' | 'StructureValue';
  readonly boundary: string;
  readonly result: CalculationResult<ConditionReading>;
  // A110: an option's Underlying condition reads the Underlying's Mark by itself. While only the contract's Mark is missing the dollar `result`
  // above is Unavailable, but the Underlying's status and price distance are still known, from today's Mark: present only then.
  readonly underlyingReading?: {
    readonly status: ConditionReading['status'];
    readonly trigger: NonNullable<ConditionReading['trigger']>;
    readonly evidence: ConditionReading['evidence'];
  };
}

export interface TradeEvaluationInput {
  readonly state: DerivedTradeState;
  // For an option Trade `frame` is the contract's and `underlyingFrame` is the Underlying's (A110).
  readonly frame: ObservationFrame | UncoveredObservation;
  readonly underlyingFrame?: ObservationFrame | UncoveredObservation;
  // A243: the session after the read session's trading date, when covered; it sets `AwaitingClose.due`.
  readonly nextSessionDate?: string;
}

export interface AtEntryFigures {
  readonly label: 'AtEntry';
  readonly quantity: Rational;
  readonly averageEntry: Rational;
  readonly riskFromEntry: Rational;
  readonly rewardFromEntry: Rational;
  readonly riskFromEntryInPlanR: Rational;
  readonly rewardFromEntryInPlanR: Rational;
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

// A248: the Trade's result in dollars if it ended at each boundary: realized P&L to date plus the remaining Position priced
// there, less its unconsumed opening fees. None reads a Mark. Unbounded above at the Max reward for stock and a long Call;
// all four are Not Applicable once nothing is held.
export interface TradeOutcomes {
  readonly atStop: CalculationResult<Rational>;
  readonly atTarget: CalculationResult<Rational>;
  readonly atWorstCase: CalculationResult<Rational>;
  readonly atMaxReward: CalculationResult<Rational>;
}

// A249: where the Trade's result stands against its Stop and Target.
export interface TradeStandingReading {
  readonly zone: 'Between' | 'PastStop' | 'PastTarget';
  // Beyond that line: dollars and R. `crossed` says the condition itself is Breached or Reached; false when an
  // Underlying-price Stop's dollar amount is passed while the Underlying has not reached its trigger (B7).
  readonly pastBy?: { readonly dollars: Rational; readonly r: Rational; readonly crossed: boolean };
  // Only in the Between zone: the result as a fraction of the result at the Target (above break-even) or at the Stop
  // (below it); absent at break-even.
  readonly share?: Rational;
  // The part of the Risk to stop that is open profit.
  readonly openProfitAtRisk?: Rational;
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
  // The bounded Max reward over 1R, as Worst case's is (revision 89); Unbounded stays Unbounded, with no R.
  readonly maximumIncrementalRewardInPlanR: CalculationResult<Rational>;
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
  // A248: the Trade's result at the Stop, Target, Worst case and Max reward.
  readonly outcomes?: TradeOutcomes;
  // A249: where the result stands; Unavailable with the evaluation's own reason when there is no Mark.
  readonly standing?: CalculationResult<TradeStandingReading>;
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
// Each lot is measured to the nearest Stop and Target of the Plan Baseline still ahead of its own fill (BUG-3,
// decision 109); a lot's quantity sign is its side.
function atEntryOf(lots: readonly OpenLot[], baseline: PlanBaseline, multiplier: Rational, oneR: Rational): AtEntryFigures | null {
  if (lots.length === 0) return null;
  const quantity = sum(lots.map((l) => l.quantity));
  const directionOf = (l: OpenLot) => (l.quantity.compare(ZERO) > 0 ? 1 : -1);
  // A lot with every condition of the role crossed at its fill contributes zero, never a negative term.
  const riskFromEntry = sum(
    lots.map((l) => atLeastZero(l.quantity.mul(multiplier).mul(l.price.sub(measurementAheadOf(baseline.stopBasis, l.price, 'Stop', directionOf(l)))))),
  );
  const rewardFromEntry = sum(
    lots.map((l) => atLeastZero(l.quantity.mul(multiplier).mul(measurementAheadOf(baseline.targetBasis, l.price, 'Target', directionOf(l)).sub(l.price)))),
  );
  return {
    label: 'AtEntry',
    quantity,
    averageEntry: sum(lots.map((l) => l.quantity.mul(l.price))).div(quantity),
    riskFromEntry,
    rewardFromEntry,
    riskFromEntryInPlanR: riskFromEntry.div(oneR),
    rewardFromEntryInPlanR: rewardFromEntry.div(oneR),
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
  // The frame is for the date the state was derived at (P81).
  if (state.valuationDate !== undefined && state.valuationDate !== date) {
    throw new Error(`evaluate: the frame's trading date ${date} differs from the state's valuation date ${state.valuationDate}`);
  }
  const contractStatusOf = (instrument: Instrument): ContractStatus | undefined =>
    state.contractStatuses.find((s) => instrumentKey(s.instrument) === instrumentKey(instrument))?.status;
  const quantity = sum(lots.map((l) => l.quantity));
  // Money formulas use quantity x multiplier x price; the Trade's one Instrument sets the multiplier (A99).
  const multiplier = Rational.of(BigInt(multiplierOf(state.positions[0]?.instrument ?? frame.instrument)));
  const cost = sum(lots.map((l) => l.quantity.mul(multiplier).mul(l.price)));
  const openingFees = sum(lots.map((l) => l.unconsumedOpeningFee));
  // Realized at the cutoff by derive: a Value that does not depend on the Mark (A92).
  const realized = state.realizedToDate;
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
  const pastExpiration = option !== undefined && lots.length > 0 && contractStatusOf(option) === 'PastExpiration';
  const unavailableResult = (): CalculationResult<never> => {
    if (pastExpiration) return { kind: 'Unavailable', reason: 'SettlementDue', instrument: option, expiration: option.expiration };
    if (!covered) return { kind: 'Unavailable', reason: 'SessionPolicyNotCovered', instrument: frame.instrument, date };
    if (foreign) {
      return { kind: 'Unavailable', reason: 'MarkMissing', instrument: foreign.instrument, date };
    }
    if (openedAfterClose) {
      return { kind: 'Unavailable', reason: 'AwaitingClose', after: date, ...(input.nextSessionDate !== undefined && { due: input.nextSessionDate }) };
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
  const underlyingStock: Instrument = { kind: 'Stock', symbol: option?.symbol ?? '' };
  const underlyingInstrument: Instrument = underlyingFrame?.instrument ?? underlyingStock;
  const underlyingDate = underlyingFrame ? ('resolution' in underlyingFrame ? underlyingFrame.tradingDate : underlyingFrame.date) : date;
  // Like the contract's, the Underlying's frame values nothing unless it is for the Underlying itself and for
  // the contract frame's own date and cutoff; otherwise its Mark is Missing for the Underlying.
  const underlyingForeign =
    underlyingFrame !== undefined &&
    (instrumentKey(underlyingFrame.instrument) !== instrumentKey(underlyingStock) ||
      underlyingDate !== date ||
      ('resolution' in underlyingFrame && covered !== undefined && underlyingFrame.closeInstant !== covered.closeInstant));
  const underlyingMark = !underlyingForeign && underlyingFrame && 'resolution' in underlyingFrame && underlyingFrame.resolution.kind === 'Available' ? underlyingFrame.resolution.mark : null;
  const underlyingUnavailable = (): CalculationResult<never> => {
    if (underlyingForeign) {
      return { kind: 'Unavailable', reason: 'MarkMissing', instrument: underlyingStock, date };
    }
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
  // The Underlying's side of that reading needs only its Mark: whether the trigger is crossed and how far.
  const optionTriggerOf = (role: 'Stop' | 'Target', trigger: Rational, price: Rational) => {
    const toward = (role === 'Stop') === stopBelow ? price.sub(trigger) : trigger.sub(price);
    const crossed = toward.compare(ZERO) <= 0;
    return { crossed, underlying: { distance: atLeastZero(toward), beyond: crossed ? ZERO.sub(toward) : null } };
  };
  const optionReadingOf = (role: 'Stop' | 'Target', trigger: Rational, measureValue: Rational, mark: Rational, price: Rational) => {
    const { crossed, underlying } = optionTriggerOf(role, trigger, price);
    const raw = quantity.mul(multiplier).mul(role === 'Stop' ? mark.sub(measureValue) : measureValue.sub(mark));
    return {
      crossed,
      amount: crossed ? ZERO : atLeastZero(raw),
      overrun: crossed ? atLeastZero(ZERO.sub(raw)) : null,
      underlying,
    };
  };
  // A condition read at the contract's own Mark (stock, or an option-price condition): the distance is the
  // quantity x multiplier x price difference toward the boundary, and the quantity's sign carries the side (A198).
  const conditionOf = (role: 'Stop' | 'Target', index: number, boundary: string, kind: ConditionStatus['kind']): ConditionStatus => ({
    id: `${role.toLowerCase()}-${index + 1}`,
    role,
    kind,
    boundary,
    result: marked((mark, source): ConditionReading => {
      const toward = quantity.mul(multiplier).mul(role === 'Stop' ? mark.sub(decimal(boundary)) : decimal(boundary).sub(mark));
      const crossed = toward.compare(ZERO) <= 0;
      // A230: the same distance in the condition's own price, the quantity's sign carrying the side.
      const priceToward = toward.div((quantity.compare(ZERO) > 0 ? quantity : ZERO.sub(quantity)).mul(multiplier));
      return {
        status: statusOf(role, crossed),
        distance: measure(atLeastZero(toward)),
        overrun: crossed ? measure(ZERO.sub(toward)) : null,
        evidence: { instrument: frame.instrument, date, mark: source },
        trigger: { distance: atLeastZero(priceToward), beyond: crossed ? ZERO.sub(priceToward) : null },
      };
    }),
  });
  const optionConditionOf = (role: 'Stop' | 'Target', index: number, basis: ConditionBasis): ConditionStatus => {
    if (basis.condition.kind === 'StructureValue') return conditionOf(role, index, basis.condition.price, 'StructureValue');
    // Only the contract's own Mark is absent (missing or acknowledged), not the Position or its session: the Underlying's Mark still reads.
    const contractMarkAbsent = lots.length > 0 && covered !== undefined && !foreign && !openedAfterClose && !pastExpiration && !usableMark;
    const underlyingOnly = contractMarkAbsent && underlyingMark ? optionTriggerOf(role, decimal(basis.condition.price), decimal(underlyingMark.price)) : undefined;
    return {
      id: `${role.toLowerCase()}-${index + 1}`,
      role,
      kind: 'UnderlyingPrice',
      boundary: basis.condition.price,
      ...(underlyingOnly && underlyingMark && {
        underlyingReading: {
          status: statusOf(role, underlyingOnly.crossed),
          trigger: underlyingOnly.underlying,
          evidence: { instrument: underlyingInstrument, date: underlyingDate, mark: underlyingMark },
        },
      }),
      result: markedWithUnderlying((mark, price, source): ConditionReading => {
        const r = optionReadingOf(role, decimal(basis.condition.price), basis.valueAtExpiration!, mark, price);
        return {
          status: statusOf(role, r.crossed),
          distance: measure(r.amount),
          overrun: r.overrun && measure(r.overrun),
          evidence: { instrument: underlyingInstrument, date: underlyingDate, mark: source },
          underlying: r.underlying,
          trigger: r.underlying,
        };
      }),
    };
  };
  const conditions: readonly ConditionStatus[] = option
    ? [
        ...state.baseline.stopBasis.map((basis, i) => optionConditionOf('Stop', i, basis)),
        ...state.baseline.targetBasis.map((basis, i) => optionConditionOf('Target', i, basis)),
      ]
    : [
        ...state.baseline.stopBasis.map((basis, i) => conditionOf('Stop', i, basis.condition.price, 'UnderlyingPrice')),
        ...state.baseline.targetBasis.map((basis, i) => conditionOf('Target', i, basis.condition.price, 'UnderlyingPrice')),
      ];
  // The headline is the minimum distance over a role's conditions, returned only when the readings that are
  // available already fix it: every condition is a Value, or some available distance is zero. Otherwise it is
  // the first Unavailable condition's result in Plan order (P91).
  const headlineOf = (role: 'Stop' | 'Target'): CalculationResult<Rational> => {
    const results = conditions.filter((c) => c.role === role).map((c) => c.result);
    const distances = results.flatMap((r) => (r.kind === 'Value' ? [r.value.distance.dollars] : []));
    const unresolved = results.find((r) => r.kind !== 'Value');
    if (unresolved && !distances.some((d) => d.compare(ZERO) === 0)) return unresolved;
    return value(distances.reduce((min, d) => (d.compare(min) < 0 ? d : min)));
  };
  const ongoingRiskToStop = headlineOf('Stop');
  const incrementalRewardToTarget = headlineOf('Target');
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
    if (option === undefined) return { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' };
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
  const maxReward = maximumIncrementalReward();
  // A248: the Trade's result were the held Instrument at `heldValue`. Reads no Mark.
  const resultAt = (heldValue: Rational): CalculationResult<Rational> => (lots.length === 0 ? noRemainingPosition : value(currentMarked(heldValue)));
  const stopMeasurement = measurementOf(headlineBasisOf(state.baseline.stopBasis));
  const targetMeasurement = measurementOf(headlineBasisOf(state.baseline.targetBasis));
  const outcomes: TradeOutcomes = {
    atStop: resultAt(stopMeasurement),
    atTarget: resultAt(targetMeasurement),
    // Worst case: a long Position's Instrument is worth nothing, the short Put is worth its strike (A109).
    atWorstCase: resultAt(strike && short ? strike : ZERO),
    // Max reward: no ceiling for stock and a long Call; otherwise a short Put's Instrument is worth nothing and a long Put's its strike.
    atMaxReward: maxReward.kind === 'Unbounded' ? maxReward : resultAt(short ? ZERO : strike!),
  };
  const crossedIn = (role: 'Stop' | 'Target') => conditions.some((c) => c.role === role && c.result.kind === 'Value' && c.result.value.status !== 'Active');
  // A249: where the Trade P&L stands against the result at the Stop and at the Target.
  const zoneOf = (result: Rational): Omit<TradeStandingReading, 'openProfitAtRisk'> => {
    const atStop = currentMarked(stopMeasurement);
    const atTarget = currentMarked(targetMeasurement);
    if (result.compare(atStop) <= 0) {
      const beyond = atStop.sub(result);
      return { zone: 'PastStop', pastBy: { dollars: beyond, r: beyond.div(state.baseline.oneR), crossed: crossedIn('Stop') } };
    }
    if (result.compare(atTarget) >= 0) {
      const beyond = result.sub(atTarget);
      return { zone: 'PastTarget', pastBy: { dollars: beyond, r: beyond.div(state.baseline.oneR), crossed: crossedIn('Target') } };
    }
    if (result.compare(ZERO) === 0) return { zone: 'Between' };
    return { zone: 'Between', share: result.compare(ZERO) > 0 ? result.div(atTarget) : result.div(atStop) };
  };
  const standingOf = (): CalculationResult<TradeStandingReading> => {
    const pnl = marked(currentMarked);
    // The Risk to stop is the evaluation's own, so an option's missing Underlying Mark gives its reason too.
    if (pnl.kind !== 'Value') return pnl;
    if (ongoingRiskToStop.kind !== 'Value') return ongoingRiskToStop;
    // Of the Risk to stop, the part that is open profit: all the profit, or the Risk when that is less.
    const openProfit = pnl.value.sub(realized);
    const atRisk = openProfit.compare(ZERO) <= 0 ? ZERO : openProfit.compare(ongoingRiskToStop.value) < 0 ? openProfit : ongoingRiskToStop.value;
    return value({ ...zoneOf(pnl.value), openProfitAtRisk: atRisk });
  };
  const standing = standingOf();
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
    maximumIncrementalReward: maxReward,
    maximumIncrementalRewardInPlanR: inPlanR(maxReward),
    conditions,
    outcomes,
    standing,
    expirationValueAtUnderlyingClose: expirationValueAtUnderlyingClose(),
    settlement: state.positions.flatMap((p): SettlementItem[] =>
      p.instrument.kind === 'Option' && p.openLots.length > 0
        ? [{ instrument: p.instrument, quantity: p.quantity, expiration: p.instrument.expiration, status: contractStatusOf(p.instrument) === 'Live' ? 'NotYetDue' : 'Due' }]
        : [],
    ),
    observation: { instrument: frame.instrument, tradingDate: date, mark: usableMark },
    deviations: [],
    coveredSubtotal: null,
    atEntry: atEntryOf(atEntryLots, state.baseline, multiplier,state.baseline.oneR),
    planBaseline: { kind: 'Value', value: state.baseline },
    oneR: value(state.baseline.oneR),
    entryQuality: state.entryQuality,
    ...(!foreign && covered && covered.resolution.kind !== 'Available' && covered.resolution.stale && { staleContext: covered.resolution.stale }),
  };
}
