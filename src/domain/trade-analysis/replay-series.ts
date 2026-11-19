import { Temporal } from 'temporal-polyfill';
import { instrumentKey, type Instrument } from '../instrument/index.ts';
import type { Instant } from '../time/index.ts';
import type { CalculationResult } from '../calculation-result/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { evaluate, oddsOf, type ConditionReading, type ConditionStatus, type ObservationFrame, type RewardRiskOdds, type TradeEvaluation } from './evaluate.ts';
import type { ConditionBasis, PlanBaseline } from './plan.ts';
import { derive, type DerivedTradeState, type IncoherentFact, type TradeAnalysisRecord } from './derive.ts';

// A211: one completed session's Mark points, one frame per Instrument (Available, Missing or AcknowledgedUnavailable,
// never carried forward). Structurally what Market Data's series gives; Trade Analysis never imports it.
export interface ReplaySessionInput {
  readonly tradingDate: string;
  readonly closeInstant: Instant;
  readonly frames: readonly ObservationFrame[];
}

export interface ReplayInput {
  readonly record: TradeAnalysisRecord;
  // Completed sessions, oldest first.
  readonly sessions: readonly ReplaySessionInput[];
}

// A change since an earlier session, named by that session's date.
export interface ReplayChange {
  readonly since: string;
  readonly dollars: Rational;
}

export interface ReplayMark {
  readonly instrument: Instrument;
  readonly resolution: ObservationFrame['resolution'];
  // The Mark's price change since this Instrument's previous Mark; null when it has none or has no Mark now.
  readonly change: ReplayChange | null;
}

// A250: one session's figures, as `evaluate` returns them for the Position held at that session's Mark; the field types
// are `TradeEvaluation`'s own.
export type ReplayFigures = {
  // W43: the open (unrealized) part of the session's Trade P&L.
  readonly openPnl: CalculationResult<Rational>;
} & Pick<
  TradeEvaluation,
  | 'ongoingRiskToStop'
  | 'ongoingRiskToStopInPlanR'
  | 'incrementalRewardToTarget'
  | 'incrementalRewardToTargetInPlanR'
  | 'worstCaseOngoingRisk'
  | 'worstCaseOngoingRiskInPlanR'
  | 'maximumIncrementalReward'
  | 'maximumIncrementalRewardInPlanR'
  | 'rewardRiskNow'
  | 'currentMarkedPnlInPlanR'
  | 'conditions'
  | 'outcomes'
  | 'standing'
  // A267, A268: the estimated odds from here, and the extremes' weight.
  | 'rewardRiskOdds'
  | 'extremes'
>;

// A251: one fill of a Position Change.
export interface ReplayMarkerFill {
  readonly instrument: Instrument;
  // `Expire` for an Expiration, which has no side.
  readonly action: 'Buy' | 'Sell' | 'Expire';
  readonly quantity: Rational;
  // Absent for an Expiration.
  readonly price?: Rational;
  // A270: the line this fill is measured against, where its price lies against it, and the distance in price. Absent for an
  // Expiration and when the Plan has no such condition. Never a verdict on the fill. Not filled until T9AR.4.
  readonly againstPlan?: {
    readonly line: 'Entry' | 'Stop' | 'Target';
    readonly side: 'At' | 'Above' | 'Below';
    readonly distance: Rational;
  };
}

// A251: a Position Change in the session, in fact order.
export interface ReplayMarker {
  readonly id: string;
  readonly kind: 'Execution' | 'Expiration';
  // Its effect on the Position.
  readonly effect: 'Opened' | 'Added' | 'Reduced' | 'Closed';
  readonly fills: readonly ReplayMarkerFill[];
}

// A252: the Plan column: the Trade's result at the Stop and at the Target as planned (minus 1R, the Original Planned
// Reward) and the Plan Baseline's reward to risk. Later fills never change it.
export interface ReplayPlan {
  readonly atStop: Rational;
  readonly atTarget: Rational;
  readonly rewardRisk: Rational;
  // A267: the Plan's own odds beside its ratio. Not filled until T9AR.4.
  readonly odds?: RewardRiskOdds;
  // A269: the confirmed Plan's facts. Not filled until T9AR.4.
  readonly terms?: ReplayPlanTerms;
}

// A269: what a Plan Stop's or Target's price is a price of: the Underlying, or the option contract itself.
export type ReplayPriceOf = 'Underlying' | 'Option';

// A269: a Planned Leg as confirmed: its Instrument, side, quantity (unsigned) and intended entry price.
export interface ReplayPlanLeg {
  readonly instrument: Instrument;
  readonly side: 'Long' | 'Short';
  readonly quantity: Rational;
  readonly entryPrice: Rational;
}

// A269: one original Stop or Target, with what its price is a price of, the price, and its own planned result (the Trade's
// result if it is hit, from the Plan Baseline's per-condition basis).
export interface ReplayPlanCondition {
  readonly role: 'Stop' | 'Target';
  readonly priceOf: ReplayPriceOf;
  readonly price: Rational;
  readonly pnlIfHit: Rational;
}

// A269: every Planned Leg and every Stop and Target, not only the headline one.
export interface ReplayPlanTerms {
  readonly legs: readonly ReplayPlanLeg[];
  readonly conditions: readonly ReplayPlanCondition[];
}

// A271: a date a role or condition was crossed. `afterGap` is true when the session before it had no reading, so a screen says
// "first seen" and never names an earlier date.
export interface ReplayCrossingDate {
  readonly date: string;
  readonly afterGap: boolean;
}

// A271: `first` is the earliest session crossed, kept on every later session; `since` is the start of the unbroken crossed run that
// holds this session, absent when it is not crossed now.
export interface ReplayCrossingDates {
  readonly first?: ReplayCrossingDate;
  readonly since?: ReplayCrossingDate;
}

// A271: a role's dates, and the same for each of its conditions (by `ConditionStatus.id`), since each keeps its own status.
export interface ReplayRoleCrossings extends ReplayCrossingDates {
  readonly conditions: readonly (ReplayCrossingDates & { readonly id: string })[];
}

export interface ReplayCrossings {
  readonly stop: ReplayRoleCrossings;
  readonly target: ReplayRoleCrossings;
}

export interface ReplayedSession {
  readonly date: string;
  readonly positions: readonly { readonly instrument: Instrument; readonly quantity: Rational }[];
  readonly heldQuantity: Rational;
  readonly realizedPnl: Rational;
  readonly tradePnl: CalculationResult<Rational>;
  readonly change: ReplayChange | null;
  readonly marks: readonly ReplayMark[];
  readonly positionChangeIds: readonly string[];
  // A250: this session's figures.
  readonly figures?: ReplayFigures;
  // A251: the Position Changes in this session.
  readonly markers?: readonly ReplayMarker[];
  // A271: each role's first crossing and current run. Not filled until T9AR.5.
  readonly crossings?: ReplayCrossings;
}

export type ReplayResult =
  | { readonly kind: 'Replayed'; readonly sessions: readonly ReplayedSession[]; readonly plan?: ReplayPlan }
  // A Planned or Abandoned Trade was never exposed.
  | { readonly kind: 'NotApplicable'; readonly reason: 'NeverExposed' }
  // The facts cannot be replayed: each finding describes itself (P69).
  | { readonly kind: 'NotApplicable'; readonly reason: 'FactsIncoherent'; readonly findings: readonly IncoherentFact[] };

const ZERO = Rational.of(0n);

export function replay(input: ReplayInput): ReplayResult {
  const whole = derive({ record: input.record });
  if (whole.kind !== 'Derived') return { kind: 'NotApplicable', reason: 'FactsIncoherent', findings: whole.findings };
  if (input.record.positionChanges.length === 0) return { kind: 'NotApplicable', reason: 'NeverExposed' };
  const terms = termsOf(input.record, whole.baseline);
  // The latest session so far with a Trade P&L figure: the next figure's change is measured from it (A211).
  let lastFigure: { readonly date: string; readonly value: Rational } | undefined;
  // Each Instrument's latest Available Mark so far: a gap is skipped, never filled.
  const lastMark = new Map<string, { readonly date: string; readonly price: Rational }>();
  // Each role's crossings so far (A271); the first session has no session before it, so no gap.
  const stopCrossings: RoleCrossingState = { previousRead: true, conditions: new Map() };
  const targetCrossings: RoleCrossingState = { previousRead: true, conditions: new Map() };
  const sessions = input.sessions.map((session, index): ReplayedSession => {
    // The Position at the session's close, valued with that session's own Marks (A211).
    const state = derive({ record: input.record, cutoff: session.closeInstant, valuationDate: session.tradingDate });
    if (state.kind !== 'Derived') throw new Error('facts cannot be replayed');
    const positions = state.positions.filter((p) => p.openLots.length > 0).map((p) => ({ instrument: p.instrument, quantity: p.quantity }));
    const { held, evaluation } = evaluationOf(state, session, input.record);
    // Nothing held: the Trade P&L is what was realized, and no Mark is needed.
    const tradePnl: CalculationResult<Rational> = held ? evaluation.currentMarkedPnl : { kind: 'Value', value: state.realizedToDate };
    const change = tradePnl.kind === 'Value' && lastFigure ? { since: lastFigure.date, dollars: tradePnl.value.sub(lastFigure.value) } : null;
    if (tradePnl.kind === 'Value') lastFigure = { date: session.tradingDate, value: tradePnl.value };
    // The Position Changes after the previous session's close, up to this one's.
    const previousClose = input.sessions[index - 1]?.closeInstant;
    const positionChangeIds = input.record.positionChanges
      .filter((pc) => (previousClose === undefined || Temporal.Instant.compare(pc.economicTime, previousClose) > 0) && Temporal.Instant.compare(pc.economicTime, session.closeInstant) <= 0)
      .map((pc) => pc.factId);
    const sessionIds = new Set(positionChangeIds);
    return {
      date: session.tradingDate,
      markers: markersOf(input.record, session.closeInstant, terms).filter((m) => sessionIds.has(m.id)),
      positions,
      heldQuantity: positions.reduce((total, p) => total.add(p.quantity), ZERO),
      realizedPnl: state.realizedToDate,
      tradePnl,
      change,
      marks: session.frames.map((frame) => markOf(frame, lastMark)),
      positionChangeIds,
      figures: figuresOf(evaluation, openPnlOf(tradePnl, state.realizedToDate)),
      crossings: {
        stop: crossingsOf(evaluation.conditions, 'Stop', session.tradingDate, stopCrossings),
        target: crossingsOf(evaluation.conditions, 'Target', session.tradingDate, targetCrossings),
      },
    };
  });
  const { oneR, originalPlannedReward, rewardRiskRatio } = whole.baseline;
  return { kind: 'Replayed', sessions, plan: { atStop: ZERO.sub(oneR), atTarget: originalPlannedReward, rewardRisk: rewardRiskRatio, odds: oddsOf(oneR, originalPlannedReward), terms } };
}

// A271: what a role's crossings remember between sessions: its first crossing, the run it is in, and whether the session before had
// a reading for it.
interface CrossingState {
  first?: ReplayCrossingDate;
  run?: ReplayCrossingDate;
  previousRead: boolean;
}

// A271, A110: a condition's own reading, or while only the contract's Mark is missing its Underlying reading; undefined with none.
function statusOf(condition: ConditionStatus): ConditionReading['status'] | undefined {
  return condition.result.kind === 'Value' ? condition.result.value.status : condition.underlyingReading?.status;
}

// A271: a role's state, with each of its conditions' own.
interface RoleCrossingState extends CrossingState {
  readonly conditions: Map<string, CrossingState>;
}

// A271: one session's reading moves a state on: crossed starts a run (and the first crossing) if none is held, Active ends the run,
// and no reading changes neither. `since` is given only on a session where it is crossed.
function advance(state: CrossingState, reading: 'crossed' | 'active' | undefined, date: string): ReplayCrossingDates {
  if (reading === 'crossed') {
    state.run ??= { date, afterGap: !state.previousRead };
    state.first ??= { date, afterGap: !state.previousRead };
  } else if (reading === 'active') {
    state.run = undefined;
  }
  state.previousRead = reading !== undefined;
  return { ...(state.first && { first: state.first }), ...(reading === 'crossed' && state.run && { since: state.run }) };
}

const readingOf = (condition: ConditionStatus): 'crossed' | 'active' | undefined => {
  const status = statusOf(condition);
  if (status === undefined) return undefined;
  return status === 'Active' ? 'active' : 'crossed';
};

// A271: a role is crossed in this session when any of its conditions is, by its own reading; not crossed only when every one has a
// reading and none is crossed; with one unreadable and none crossed it has no reading (AC-RPT-004: gaps cannot prove no episode).
function crossingsOf(conditions: readonly ConditionStatus[], role: 'Stop' | 'Target', date: string, state: RoleCrossingState): ReplayRoleCrossings {
  const own = conditions.filter((c) => c.role === role);
  const readings = own.map(readingOf);
  for (const c of own) if (!state.conditions.has(c.id)) state.conditions.set(c.id, { previousRead: true });
  const perCondition = [...state.conditions].map(([id, s]) => ({ id, ...advance(s, readings[own.findIndex((c) => c.id === id)], date) }));
  let reading: 'crossed' | 'active' | undefined;
  if (readings.includes('crossed')) reading = 'crossed';
  else if (readings.length > 0 && !readings.includes(undefined)) reading = 'active';
  return { ...advance(state, reading, date), conditions: perCondition };
}

// A269: the confirmed Plan's legs, and every Stop and Target with the planned result it carries in the Plan Baseline.
function termsOf(record: TradeAnalysisRecord, baseline: PlanBaseline): ReplayPlanTerms {
  const legs = record.plan.legs.map((leg): ReplayPlanLeg => {
    const quantity = decimal(leg.quantity);
    return { instrument: leg.instrument, side: leg.side, quantity: quantity.compare(ZERO) < 0 ? ZERO.sub(quantity) : quantity, entryPrice: decimal(leg.intendedEntry) };
  });
  const conditionOf = (role: 'Stop' | 'Target') => (b: ConditionBasis): ReplayPlanCondition => ({
    role,
    priceOf: b.condition.kind === 'StructureValue' ? 'Option' : 'Underlying',
    price: decimal(b.condition.price),
    pnlIfHit: role === 'Stop' ? ZERO.sub(b.distance) : b.distance,
  });
  return { legs, conditions: [...baseline.stopBasis.map(conditionOf('Stop')), ...baseline.targetBasis.map(conditionOf('Target'))] };
}

// A251: one marker per Position Change, in fact order (Economic Time, then Recorded Sequence), made from the fills up to
// the session's close, as `derive` keeps them at that cutoff: a Position Change straddling the close shows only its
// earlier fills there. Its effect compares the open quantity before and after it, in magnitude.
function markersOf(record: TradeAnalysisRecord, cutoff: Instant, terms: ReplayPlanTerms): readonly ReplayMarker[] {
  const upTo = (at: Instant) => Temporal.Instant.compare(at, cutoff) <= 0;
  const byFactOrder = (a: { economicTime: Instant; recordedSequence: number }, b: { economicTime: Instant; recordedSequence: number }) =>
    Temporal.Instant.compare(a.economicTime, b.economicTime) || a.recordedSequence - b.recordedSequence;
  const shortLegs = new Set(record.plan.legs.filter((l) => l.side === 'Short').map((l) => l.factId));
  let open = ZERO;
  return [...record.positionChanges].sort(byFactOrder).map((pc): ReplayMarker => {
    const before = open;
    const executions = pc.executions.filter((e) => upTo(e.economicTime)).sort(byFactOrder);
    const settlements = (pc.settlements ?? []).filter((s) => upTo(s.economicTime)).sort(byFactOrder);
    const fills = [
      ...executions.map((e): ReplayMarkerFill => {
        const price = decimal(e.price);
        const opens = shortLegs.has(e.intent.plannedLegId) === (e.action === 'Sell');
        const leg = terms.legs[record.plan.legs.findIndex((l) => l.factId === e.intent.plannedLegId)];
        let againstPlan: ReplayMarkerFill['againstPlan'];
        if (!leg) againstPlan = undefined;
        else if (opens) againstPlan = against('Entry', price, leg.entryPrice);
        else againstPlan = againstConditions(e.instrument, price, leg.side, terms);
        return { instrument: e.instrument, action: e.action, quantity: decimal(e.quantity), price, ...(againstPlan && { againstPlan }) };
      }),
      ...settlements.map((s): ReplayMarkerFill => ({ instrument: s.instrument, action: 'Expire', quantity: decimal(s.quantity) })),
    ];
    for (const e of executions) open = shortLegs.has(e.intent.plannedLegId) === (e.action === 'Sell') ? open.add(decimal(e.quantity)) : open.sub(decimal(e.quantity));
    for (const s of settlements) open = open.sub(decimal(s.quantity));
    let effect: ReplayMarker['effect'];
    if (before.compare(ZERO) === 0) effect = 'Opened';
    else if (open.compare(ZERO) === 0) effect = 'Closed';
    else if (open.compare(before) > 0) effect = 'Added';
    else effect = 'Reduced';
    return { id: pc.factId, kind: settlements.length > 0 ? 'Expiration' : 'Execution', effect, fills };
  });
}

// A270: where a price lies against a line of the Plan, and how far: a line, a side and a distance, never a verdict.
function against(line: 'Entry' | 'Stop' | 'Target', price: Rational, lineAt: Rational): NonNullable<ReplayMarkerFill['againstPlan']> {
  const difference = price.sub(lineAt);
  const order = difference.compare(ZERO);
  let side: 'At' | 'Above' | 'Below';
  if (order === 0) side = 'At';
  else if (order > 0) side = 'Above';
  else side = 'Below';
  return { line, side, distance: order < 0 ? ZERO.sub(difference) : difference };
}

// A270: a reducing or closing fill against the Plan's conditions that are prices of the fill's own Instrument: the nearest Stop
// the fill is at or beyond (below it for a long leg, above it for a short one), otherwise the nearest Target.
function againstConditions(instrument: Instrument, price: Rational, side: 'Long' | 'Short', terms: ReplayPlanTerms): ReplayMarkerFill['againstPlan'] {
  const priceOf: ReplayPriceOf = instrument.kind === 'Stock' ? 'Underlying' : 'Option';
  const own = terms.conditions.filter((c) => c.priceOf === priceOf);
  const nearestOf = (role: 'Stop' | 'Target', conditions: readonly ReplayPlanCondition[]) =>
    conditions.map((c) => against(role, price, c.price)).sort((a, b) => a.distance.compare(b.distance))[0];
  const beyond = own.filter((c) => c.role === 'Stop' && (side === 'Long' ? price.compare(c.price) <= 0 : price.compare(c.price) >= 0));
  return nearestOf('Stop', beyond) ?? nearestOf('Target', own.filter((c) => c.role === 'Target'));
}

function markOf(frame: ObservationFrame, lastMark: Map<string, { readonly date: string; readonly price: Rational }>): ReplayMark {
  const { instrument, resolution } = frame;
  if (resolution.kind !== 'Available') return { instrument, resolution, change: null };
  const key = instrumentKey(instrument);
  const price = decimal(resolution.mark.price);
  const previous = lastMark.get(key);
  lastMark.set(key, { date: frame.tradingDate, price });
  return { instrument, resolution, change: previous ? { since: previous.date, dollars: price.sub(previous.price) } : null };
}

// Marks reaching analysis were validated when recorded, so their decimals parse.
function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

// W43: the open part of the Trade P&L is what the Trade P&L holds beyond what was realized; unavailable when it is.
function openPnlOf(tradePnl: CalculationResult<Rational>, realized: Rational): CalculationResult<Rational> {
  return tradePnl.kind === 'Value' ? { kind: 'Value', value: tradePnl.value.sub(realized) } : tradePnl;
}

function figuresOf(e: TradeEvaluation, openPnl: CalculationResult<Rational>): ReplayFigures {
  return {
    openPnl,
    ongoingRiskToStop: e.ongoingRiskToStop,
    ongoingRiskToStopInPlanR: e.ongoingRiskToStopInPlanR,
    incrementalRewardToTarget: e.incrementalRewardToTarget,
    incrementalRewardToTargetInPlanR: e.incrementalRewardToTargetInPlanR,
    worstCaseOngoingRisk: e.worstCaseOngoingRisk,
    worstCaseOngoingRiskInPlanR: e.worstCaseOngoingRiskInPlanR,
    maximumIncrementalReward: e.maximumIncrementalReward,
    maximumIncrementalRewardInPlanR: e.maximumIncrementalRewardInPlanR,
    rewardRiskNow: e.rewardRiskNow,
    currentMarkedPnlInPlanR: e.currentMarkedPnlInPlanR,
    conditions: e.conditions,
    outcomes: e.outcomes,
    standing: e.standing,
    ...(e.rewardRiskOdds && { rewardRiskOdds: e.rewardRiskOdds }),
    ...(e.extremes && { extremes: e.extremes }),
  };
}

// A session's frame for an Instrument: a session without it has a Missing Mark for it, a gap, never a crash.
function frameFor(instrument: Instrument, session: ReplaySessionInput): ObservationFrame {
  return (
    session.frames.find((f) => instrumentKey(f.instrument) === instrumentKey(instrument)) ?? {
      instrument,
      tradingDate: session.tradingDate,
      closeInstant: session.closeInstant,
      resolution: { kind: 'Missing' },
    }
  );
}

// A250: the Position held at the session's close evaluated with that session's frames: the held Instrument's, and for an
// option Trade the Underlying's too, which its Underlying condition reads.
function evaluationOf(state: DerivedTradeState, session: ReplaySessionInput, record: TradeAnalysisRecord): { held: Instrument | undefined; evaluation: TradeEvaluation } {
  const held = state.positions.find((p) => p.openLots.length > 0)?.instrument;
  const instrument = held ?? state.positions[0]?.instrument ?? record.plan.legs[0]!.instrument;
  const frame = frameFor(instrument, session);
  const evaluation =
    instrument.kind === 'Stock'
      ? evaluate({ state, frame })
      : evaluate({ state, frame, underlyingFrame: frameFor({ kind: 'Stock', symbol: record.plan.underlying }, session) });
  return { held, evaluation };
}
