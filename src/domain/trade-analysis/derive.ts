import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { frozenBaseline, type ConditionInput, type PlanBaseline, type PlannedLegInput } from './plan.ts';

export type LifecycleState = 'Planned' | 'Open' | 'Closed' | 'Abandoned';

// One effective fill. D2 records Buys and D6 Sells of the Plan's Stock serving its Planned Leg
// (D2 A18, D6 A76).
export interface ExecutionFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly action: 'Buy' | 'Sell';
  readonly instrument: { readonly kind: 'Stock'; readonly symbol: string };
  readonly quantity: string;
  readonly price: string;
  readonly fee: string;
  readonly intent: { readonly kind: 'ServesPlannedLeg'; readonly plannedLegId: string };
}

// One decision grouping its member Executions; its Economic Time is its earliest member's (A19).
export interface PositionChangeFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly executions: readonly ExecutionFact[];
}

// Trade Record's AnalysisInput projection: the complete effective facts of one Trade at one
// FactRevision.
export interface TradeAnalysisRecord {
  readonly tradeId: string;
  readonly factRevision: number;
  readonly storedLifecycle: LifecycleState;
  readonly plan: {
    readonly economicTime: Instant;
    readonly underlying: string;
    readonly thesis: string;
    readonly invalidation: string;
    readonly legs: readonly (PlannedLegInput & { readonly factId: string })[];
    readonly stops: readonly (ConditionInput & { readonly factId: string })[];
    readonly targets: readonly (ConditionInput & { readonly factId: string })[];
  };
  readonly positionChanges: readonly PositionChangeFact[];
  // Recorded Deviation occurrences, authoritative in Trade Record; absent means none recorded.
  readonly recordedDeviations?: readonly RecordedDeviation[];
}

// A prepared candidate's canonical digest and the before-state record: the reconciliation is bound
// to the digest and to the before-state's stored lifecycle and recorded occurrences, which the
// candidate leaves unchanged until it is applied.
export interface CandidateBinding {
  readonly digest: string;
  readonly before: TradeAnalysisRecord;
}

export interface TradeDerivationInput {
  readonly record: TradeAnalysisRecord;
  // Present when record is a prepared candidate.
  readonly candidate?: CandidateBinding;
  // The economic cutoff: only facts at or before it count. Absent means every effective fact.
  readonly cutoff?: Instant;
  // The date (YYYY-MM-DD) of the Marks required for remaining quantity; supplied by the coordinator,
  // since analysis knows no calendar. Absent means no observation is required.
  readonly valuationDate?: string;
}

// An exact Mark required on the valuation date for an Instrument with remaining quantity; it is
// relevant from the Instrument's exposure start.
export interface ObservationRequirement {
  readonly instrument: ExecutionFact['instrument'];
  readonly valuationDate: string;
  readonly earliestRelevance: Instant;
}

// Agreement between stored and expected Lifecycle State; a disagreement is reported, never repaired.
export type LifecycleAgreement =
  | { readonly kind: 'Agrees' }
  | { readonly kind: 'LifecycleDisagreement'; readonly stored: LifecycleState; readonly expected: LifecycleState };

// The unmatched portion of one opening Execution, with its basis and unconsumed opening fee.
export interface OpenLot {
  readonly openingExecutionId: string;
  readonly quantity: Rational;
  readonly price: Rational;
  readonly unconsumedOpeningFee: Rational;
}

// A derived FIFO link from one opening Execution to one disposing Execution (A78). It copies no
// price or P&L: allocated fees and the realized amount are separate results keyed to it.
export interface LotMatch {
  readonly openingExecutionId: string;
  readonly disposingExecutionId: string;
  readonly quantity: Rational;
  readonly policy: 'FIFO';
}

// The results keyed to one Lot Match by its identity (opening Execution, disposing Execution,
// policy), separate from the link itself (A78).
export interface LotMatchResult {
  readonly openingExecutionId: string;
  readonly disposingExecutionId: string;
  readonly policy: 'FIFO';
  // The disposing Execution's Economic Time, which places the realization in time.
  readonly disposedAt: Instant;
  readonly allocatedOpeningFee: CalculationResult<Rational>;
  readonly allocatedDisposalFee: CalculationResult<Rational>;
  readonly realized: CalculationResult<Rational>;
}

// One mechanism by which a Closed Trade's exposure ended, with the quantity it disposed (A84).
// Later variants add Expiration, Assignment, Exercise, and cash settlement.
export interface DispositionMechanism {
  readonly mechanism: 'Executions';
  readonly quantity: Rational;
}

export type TerminalDisposition = CalculationResult<readonly DispositionMechanism[], 'NotClosed'>;

// Derived signed net quantity and Open Lots for one exact Instrument within the Trade.
export interface InstrumentPosition {
  readonly instrument: ExecutionFact['instrument'];
  readonly quantity: Rational;
  readonly openLots: readonly OpenLot[];
}

// One independently useful calculation (Trade Analysis, shared values); reasons are stable codes.
export type CalculationResult<T, Reason extends string = string> =
  | { readonly kind: 'Value'; readonly value: T }
  | { readonly kind: 'Unbounded'; readonly direction: 'Above' | 'Below'; readonly explanation: string }
  | { readonly kind: 'NotApplicable'; readonly reason: Reason }
  | { readonly kind: 'Unavailable'; readonly reason: Reason; readonly detail: UnavailableDetail };

// What an Unavailable result names: the Instrument and date lacking an exact Mark, or the close
// still awaited.
export type UnavailableDetail =
  | { readonly instrument: ExecutionFact['instrument']; readonly date: string }
  | { readonly after: string };

// D2's Entry Resolution Point: the Position Change at which the entry window resolves (A23).
export type EntryResolution = { readonly kind: 'Unresolved' } | { readonly kind: 'Resolved'; readonly positionChangeId: string };

// Entry Quality over the entry window's opening Executions (A24), each figure its own result.
export interface EntryQualityFigures {
  readonly averageEntry: CalculationResult<Rational>;
  readonly windowQuantity: CalculationResult<Rational>;
  readonly windowFees: CalculationResult<Rational>;
  readonly actualInitialRisk: CalculationResult<Rational>;
  readonly actualInitialReward: CalculationResult<Rational>;
  readonly riskInPlanR: CalculationResult<Rational>;
  readonly slippage: CalculationResult<Rational>;
  readonly sizeRatio: CalculationResult<Rational>;
  readonly plannedRewardRisk: CalculationResult<Rational>;
  readonly actualRewardRisk: CalculationResult<Rational, EntryFlag>;
  readonly flags: readonly EntryFlag[];
}

// An average entry at or beyond a boundary: the actual reward/risk ratio is then not applicable.
export type EntryFlag = 'EntryAtOrBeyondStop' | 'EntryAtOrBeyondTarget';

export type EntryQuality = CalculationResult<EntryQualityFigures, 'EntryNotResolved'>;

// D2's per-leg fulfillment (A25); Not Entered and Not Verifiable arrive with later variants.
export interface LegFulfillment {
  readonly plannedLegId: string;
  readonly fulfillment: 'Unfilled' | 'PartiallyFilled' | 'FilledAsPlanned' | 'FilledWithDeviation';
}

// Identifies one Entry Size (Excess) occurrence: the Planned Leg and the Position Change that
// raised its open quantity above plan (P4).
// The members absent from the other variant are typed `undefined`, so reading either variant's
// member from the union stays legal and its absence is the discriminant.
export interface ExcessFingerprint {
  readonly tradeId: string;
  readonly plannedLegId: string;
  readonly positionChangeId: string;
  readonly form?: undefined;
}

// Identifies one Entry Size (Shortfall) occurrence: the Planned Leg alone, so a moved cutoff changes
// its cause and quantity but not its identity (A83).
export interface ShortfallFingerprint {
  readonly tradeId: string;
  readonly plannedLegId: string;
  readonly form: 'Shortfall';
  readonly positionChangeId?: undefined;
}

export type DeviationFingerprint = ExcessFingerprint | ShortfallFingerprint;

// A deterministic fact-only Deviation the facts imply (A26's version, without its status).
export type ExpectedDeviation =
  | {
      readonly fingerprint: ExcessFingerprint;
      readonly type: 'EntrySize';
      readonly form: 'Excess';
      readonly quantityAbovePlan: Rational;
      readonly quantityBelowPlan?: undefined;
      readonly causingPositionChangeId: string;
      readonly economicTime: Instant;
    }
  // A83: the planned quantity less the quantity entered at resolution, caused by the cutting Sell's
  // Position Change at its Economic Time.
  | {
      readonly fingerprint: ShortfallFingerprint;
      readonly type: 'EntrySize';
      readonly form: 'Shortfall';
      readonly quantityAbovePlan?: undefined;
      readonly quantityBelowPlan: Rational;
      readonly causingPositionChangeId: string;
      readonly economicTime: Instant;
    };

// A structured integrity finding: stored state that disagrees with what the facts imply. Analysis
// reports it and never repairs it.
export type IntegrityFinding =
  | Extract<LifecycleAgreement, { kind: 'LifecycleDisagreement' }>
  | {
      readonly kind: 'DeviationMissing';
      readonly fingerprint: DeviationFingerprint;
      readonly expected: ExpectedDeviation;
    }
  | {
      readonly kind: 'DeviationQuantityDisagreement';
      readonly fingerprint: DeviationFingerprint;
      readonly occurrenceId: string;
      readonly recorded: Rational;
      readonly expected: Rational;
    }
  | {
      readonly kind: 'DeviationUnexpected';
      readonly fingerprint: DeviationFingerprint;
      readonly occurrenceId: string;
    };

// One version of a recorded occurrence (A26): supersession appends a Superseded version.
export type RecordedDeviationVersion = (
  | {
      readonly fingerprint: ExcessFingerprint;
      readonly type: 'EntrySize';
      readonly form: 'Excess';
      readonly quantityAbovePlan: string;
      readonly quantityBelowPlan?: undefined;
      readonly causingPositionChangeId: string;
      readonly economicTime: Instant;
    }
  | {
      readonly fingerprint: ShortfallFingerprint;
      readonly type: 'EntrySize';
      readonly form: 'Shortfall';
      readonly quantityAbovePlan?: undefined;
      readonly quantityBelowPlan: string;
      readonly causingPositionChangeId: string;
      readonly economicTime: Instant;
    }
) &
  ({ readonly status: 'Active' } | { readonly status: 'Superseded'; readonly reason: 'NoLongerExpected' });

// A recorded Deviation occurrence: a stable occurrence identity with its version list (A26).
export interface RecordedDeviation {
  readonly occurrenceId: string;
  readonly versions: readonly RecordedDeviationVersion[];
}

// What applying the candidate must do to each recorded occurrence, by fingerprint (A26).
export type DeviationAction =
  | { readonly kind: 'Create'; readonly occurrence: ExpectedDeviation }
  | {
      readonly kind: 'Retain';
      readonly occurrenceId: string;
      readonly fingerprint: DeviationFingerprint;
    }
  | {
      readonly kind: 'NewVersion';
      readonly occurrenceId: string;
      readonly occurrence: ExpectedDeviation;
    }
  | {
      readonly kind: 'Supersede';
      readonly occurrenceId: string;
      readonly fingerprint: DeviationFingerprint;
      readonly reason: 'NoLongerExpected';
    };

export type CloseRequirement = 'TerminalWithAgency' | 'NotTerminal';

// Trade Analysis's expected state for one exact candidate, which Trade Record's apply requires.
export interface DerivedTradeReconciliation {
  readonly candidateDigest: string;
  readonly expectedLifecycle: LifecycleState;
  // The candidate's exposure start, which Trade Record stores in the Trade document (D4 A38).
  readonly exposureStart: Instant | null;
  // Whether the candidate's new Position Change closes the Trade with trader agency, which requires
  // a Close Reason (A77); the workflow turns this into its issues.
  readonly closeRequirement: CloseRequirement;
  readonly deviationActions: readonly DeviationAction[];
  // Where the before-state's stored lifecycle or recorded occurrences disagreed with its own
  // coherent facts: repaired by applying the candidate and disclosed (P7).
  readonly repairs: readonly IntegrityFinding[];
  // What the change itself does to expected state, from the before facts to the candidate's.
  readonly effects: readonly ChangeEffect[];
}

export type ChangeEffect =
  | {
      readonly kind: 'LifecycleTransition';
      readonly from: LifecycleState;
      readonly to: LifecycleState;
    }
  | {
      readonly kind: 'DeviationChange';
      readonly fingerprint: DeviationFingerprint;
      readonly from: Rational | null;
      readonly to: Rational | null;
    };

export interface DerivedTradeState {
  readonly kind: 'Derived';
  readonly tradeId: string;
  readonly factRevision: number;
  readonly expectedLifecycle: LifecycleState;
  readonly agreement: LifecycleAgreement;
  // Effective Executions in Fact Order, each with its Position Change.
  readonly facts: readonly (ExecutionFact & { readonly positionChangeId: string })[];
  readonly positions: readonly InstrumentPosition[];
  // Expected FIFO Lot Matches in disposing Fact Order, oldest Lot first within one Execution (A79).
  readonly lotMatches: readonly LotMatch[];
  // One result per Lot Match, in the same order, keyed by the match's identity (A78, A80, A81).
  readonly lotMatchResults: readonly LotMatchResult[];
  // The sum of the realized amounts of the Lot Matches among the effective facts, so at the cutoff
  // when one is given (A81).
  readonly realizedToDate: Rational;
  // The Economic Time of the first effective opening Execution; null while the Trade is Planned.
  readonly exposureStart: Instant | null;
  // The terminal Position Change's Economic Time; null unless the expected lifecycle is Closed (A87).
  readonly terminalTime: Instant | null;
  // How the exposure ended; NotApplicable(NotClosed) unless the expected lifecycle is Closed (A84).
  readonly terminalDisposition: TerminalDisposition;
  // Net realized P&L over 1R; NotApplicable(NotClosed) unless the expected lifecycle is Closed (A81).
  readonly realizedR: CalculationResult<Rational, 'NotClosed'>;  // One per Instrument with remaining quantity; none for a Planned Trade.
  readonly observationRequirements: readonly ObservationRequirement[];
  // Actual fees, each Execution's counted once: the opening Executions' alone, and every Execution's
  // (A80). Neither is ever subtracted from realized P&L again.
  readonly fees: { readonly incurredOpening: Rational; readonly incurred: Rational };
  // Signed cost of the remaining open exposure: quantity x price over the Open Lots plus their unconsumed
  // opening fees (D4's C + F). Stock only until options add a multiplier.
  readonly netCost: CalculationResult<Rational, 'NoOpenQuantity'>;
  readonly baseline: PlanBaseline;
  readonly entryResolution: EntryResolution;
  readonly entryQuality: EntryQuality;
  readonly legFulfillment: readonly LegFulfillment[];
  readonly deviations: readonly ExpectedDeviation[];
  readonly findings: readonly IntegrityFinding[];
  // Present when a candidate binding was supplied.
  readonly reconciliation?: DerivedTradeReconciliation;
}

// Facts that cannot be replayed are a typed rejection naming each fact, never a number.
export type IncoherentFact =
  | { readonly factId: string; readonly reason: 'UnknownPlannedLeg' | 'NonpositiveQuantity' | 'DuplicateFactId' }
  // P22: a Sell above the quantity open at its own point in Fact Order; names that quantity.
  | { readonly factId: string; readonly reason: 'ExceedsOpenQuantity'; readonly available: Rational }
  // P22: a Sell that leaves the Position flat although a later fact follows it.
  | { readonly factId: string; readonly reason: 'FlatBeforeLaterFacts' };

export interface IncoherentFacts {
  readonly kind: 'IncoherentFacts';
  readonly findings: readonly IncoherentFact[];
}

export type DerivationResult = DerivedTradeState | IncoherentFacts;

function incoherence(record: TradeAnalysisRecord): IncoherentFact[] {
  const findings: IncoherentFact[] = [];
  const legs = new Set(record.plan.legs.map((l) => l.factId));
  const seen = new Set<string>();
  for (const pc of record.positionChanges) {
    for (const fact of [pc, ...pc.executions]) {
      if (seen.has(fact.factId)) findings.push({ factId: fact.factId, reason: 'DuplicateFactId' });
      seen.add(fact.factId);
    }
    for (const e of pc.executions) {
      if (!legs.has(e.intent.plannedLegId)) findings.push({ factId: e.factId, reason: 'UnknownPlannedLeg' });
      if (!parseDecimal(e.quantity, { positive: true }).ok) findings.push({ factId: e.factId, reason: 'NonpositiveQuantity' });
    }
  }
  return findings;
}

// P22: replaying in Fact Order, the open quantity never goes below zero and may reach zero only at
// the last fact. A Sell above the open quantity is reported with the quantity then available and
// does not reduce it.
function positionPathFindings(facts: readonly ExecutionFact[]): IncoherentFact[] {
  const findings: IncoherentFact[] = [];
  let open = Rational.of(0n);
  facts.forEach((e, index) => {
    const quantity = decimal(e.quantity);
    if (e.action === 'Buy') {
      open = open.add(quantity);
    } else if (quantity.compare(open) > 0) {
      findings.push({ factId: e.factId, reason: 'ExceedsOpenQuantity', available: open });
    } else {
      open = open.sub(quantity);
      if (open.compare(Rational.of(0n)) === 0 && index < facts.length - 1) findings.push({ factId: e.factId, reason: 'FlatBeforeLaterFacts' });
    }
  });
  return findings;
}

// Facts reaching analysis were validated when recorded, so their decimals parse.
function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`Invalid stored decimal: ${text}`);
  return parsed.value;
}

function netCostOf(positions: readonly InstrumentPosition[]): DerivedTradeState['netCost'] {
  const lots = positions.flatMap((p) => p.openLots);
  if (lots.length === 0) return { kind: 'NotApplicable', reason: 'NoOpenQuantity' };
  const total = lots.reduce((sum, l) => sum.add(l.quantity.mul(l.price)).add(l.unconsumedOpeningFee), Rational.of(0n));
  return { kind: 'Value', value: total };
}

// Replays the facts in Fact Order. Each Buy creates one Open Lot holding its whole fee (D2 A22);
// each Sell consumes the oldest Lots first (A79), one Lot Match per Lot it touches. Nothing is
// stored (P23).
function replayOf(facts: readonly ExecutionFact[]): {
  positions: InstrumentPosition[];
  lotMatches: LotMatch[];
  lotMatchResults: LotMatchResult[];
} {
  const lots: OpenLot[] = [];
  const originals = new Map<string, { quantity: Rational; price: Rational; fee: Rational }>();
  const lotMatches: LotMatch[] = [];
  const lotMatchResults: LotMatchResult[] = [];
  for (const e of facts) {
    if (e.action === 'Buy') {
      const lot = { quantity: decimal(e.quantity), price: decimal(e.price), fee: decimal(e.fee) };
      originals.set(e.factId, lot);
      lots.push({ openingExecutionId: e.factId, quantity: lot.quantity, price: lot.price, unconsumedOpeningFee: lot.fee });
      continue;
    }
    const sold = decimal(e.quantity);
    let remaining = sold;
    while (remaining.compare(Rational.of(0n)) > 0 && lots.length > 0) {
      const lot = lots[0]!;
      const matched = lot.quantity.compare(remaining) < 0 ? lot.quantity : remaining;
      const original = originals.get(lot.openingExecutionId)!;
      // A Lot's opening fee is allocated in proportion to matched quantity over its original quantity (A80).
      const allocatedOpeningFee = original.fee.mul(matched).div(original.quantity);
      lotMatches.push({ openingExecutionId: lot.openingExecutionId, disposingExecutionId: e.factId, quantity: matched, policy: 'FIFO' });
      // A Sell's fee is allocated across its Lot Matches in proportion to matched quantity (A80).
      const allocatedDisposalFee = decimal(e.fee).mul(matched).div(sold);
      lotMatchResults.push({
        openingExecutionId: lot.openingExecutionId,
        disposingExecutionId: e.factId,
        policy: 'FIFO',
        disposedAt: e.economicTime,
        allocatedOpeningFee: value(allocatedOpeningFee),
        allocatedDisposalFee: value(allocatedDisposalFee),
        // q x (sell price - buy price) less both allocated fees (A80).
        realized: value(matched.mul(decimal(e.price).sub(original.price)).sub(allocatedOpeningFee).sub(allocatedDisposalFee)),
      });
      remaining = remaining.sub(matched);
      const left = { ...lot, unconsumedOpeningFee: lot.unconsumedOpeningFee.sub(allocatedOpeningFee) };
      if (lot.quantity.compare(matched) === 0) lots.shift();
      else lots[0] = { ...left, quantity: lot.quantity.sub(matched) };
    }
  }
  if (facts.length === 0) return { positions: [], lotMatches, lotMatchResults };
  return {
    positions: [
      {
        instrument: facts[0]!.instrument,
        quantity: lots.reduce((sum, l) => sum.add(l.quantity), Rational.of(0n)),
        openLots: lots,
      },
    ],
    lotMatches,
    lotMatchResults,
  };
}

function lifecycleOf(facts: readonly ExecutionFact[], positions: readonly InstrumentPosition[]): LifecycleState {
  if (facts.length === 0) return 'Planned';
  return positions.some((p) => p.quantity.compare(Rational.of(0n)) !== 0) ? 'Open' : 'Closed';
}

// The Position Change holding the last effective fact: with a flat Position it is the terminal one (A87).
function terminalPositionChangeOf(
  record: TradeAnalysisRecord,
  facts: readonly (ExecutionFact & { readonly positionChangeId: string })[],
): PositionChangeFact {
  const id = facts[facts.length - 1]!.positionChangeId;
  return record.positionChanges.find((pc) => pc.factId === id)!;
}

// Whether the candidate's new (latest-recorded) Position Change is the terminal one. Every D6
// Execution, Buy or Sell, carries trader agency (A77), so a terminal change always has it.
function closeRequirementOf(
  record: TradeAnalysisRecord,
  facts: readonly (ExecutionFact & { readonly positionChangeId: string })[],
  closed: boolean,
): CloseRequirement {
  if (!closed) return 'NotTerminal';
  const newest = record.positionChanges.reduce((a, b) => (b.recordedSequence > a.recordedSequence ? b : a));
  return terminalPositionChangeOf(record, facts).factId === newest.factId ? 'TerminalWithAgency' : 'NotTerminal';
}

// How a Closed Trade's exposure ended (A84, ADR 0003): derived from the disposing facts, never
// stored. D6 has one mechanism, Executions, holding the quantity they disposed.
function terminalDispositionOf(lifecycle: LifecycleState, lotMatches: readonly LotMatch[]): TerminalDisposition {
  if (lifecycle !== 'Closed') return { kind: 'NotApplicable', reason: 'NotClosed' };
  const disposed = lotMatches.reduce((sum, m) => sum.add(m.quantity), Rational.of(0n));
  return { kind: 'Value', value: [{ mechanism: 'Executions', quantity: disposed }] };
}

function observationRequirementsOf(
  positions: readonly InstrumentPosition[],
  facts: readonly ExecutionFact[],
  valuationDate: string,
): ObservationRequirement[] {
  return positions
    .filter((p) => p.quantity.compare(Rational.of(0n)) !== 0)
    .map((p) => ({
      instrument: p.instrument,
      valuationDate,
      earliestRelevance: facts.find((e) => e.instrument.symbol === p.instrument.symbol)!.economicTime,
    }));
}

// FactOrder: Economic Time, then the stable Recorded Sequence for ties.
type Ordered = Pick<ExecutionFact, 'economicTime' | 'recordedSequence'>;
function factOrder(a: Ordered, b: Ordered): number {
  return Temporal.Instant.compare(a.economicTime, b.economicTime) || a.recordedSequence - b.recordedSequence;
}

// The entry window opens with the first Position Change and resolves at the first one, in Fact
// Order, after which every Planned Leg's entered quantity reaches its planned quantity (A23), or
// immediately before the first Position Change holding a Sell, whichever comes first (A82). The
// window holds every Execution of the Position Changes up to and including the resolving one; a
// window cut by a Sell names that cutting Position Change.
function entryWindowOf(record: TradeAnalysisRecord): {
  resolution: EntryResolution;
  window: ExecutionFact[];
  cutBy?: PositionChangeFact;
} {
  const entered = new Map<string, Rational>();
  const window: ExecutionFact[] = [];
  let last: PositionChangeFact | undefined;
  for (const pc of [...record.positionChanges].sort(factOrder)) {
    if (last && pc.executions.some((e) => e.action === 'Sell'))
      return { resolution: { kind: 'Resolved', positionChangeId: last.factId }, window, cutBy: pc };
    last = pc;
    for (const e of pc.executions) {
      const leg = e.intent.plannedLegId;
      // Only a Buy enters; a Sell reduces exposure (P4).
      if (e.action === 'Buy') entered.set(leg, (entered.get(leg) ?? Rational.of(0n)).add(decimal(e.quantity)));
      window.push(e);
    }
    const filled = record.plan.legs.every((leg) => (entered.get(leg.factId)?.compare(decimal(leg.quantity)) ?? -1) >= 0);
    if (filled) return { resolution: { kind: 'Resolved', positionChangeId: pc.factId }, window };
  }
  return { resolution: { kind: 'Unresolved' }, window };
}

const value = (v: Rational) => ({ kind: 'Value', value: v }) as const;
const total = (executions: readonly ExecutionFact[], of: (e: ExecutionFact) => Rational) =>
  executions.reduce((sum, e) => sum.add(of(e)), Rational.of(0n));

// Uses the Stop and Target effective at the Entry Resolution Point: before D17, the Plan's single
// original ones (D1 A1).
function entryQualityOf(
  resolution: EntryResolution,
  window: readonly ExecutionFact[],
  plan: TradeAnalysisRecord['plan'],
  baseline: PlanBaseline,
): EntryQuality {
  if (resolution.kind === 'Unresolved') return { kind: 'NotApplicable', reason: 'EntryNotResolved' };
  const zero = Rational.of(0n);
  const quantity = total(window, (e) => decimal(e.quantity));
  const cost = total(window, (e) => decimal(e.quantity).mul(decimal(e.price)));
  const fees = total(window, (e) => decimal(e.fee));
  const average = cost.div(quantity);
  const stop = decimal(plan.stops[0]!.price);
  const target = decimal(plan.targets[0]!.price);
  const flags: EntryFlag[] = [];
  if (average.compare(stop) <= 0) flags.push('EntryAtOrBeyondStop');
  if (average.compare(target) >= 0) flags.push('EntryAtOrBeyondTarget');
  const nonnegative = (r: Rational) => (r.compare(zero) > 0 ? r : zero);
  const risk = nonnegative(quantity.mul(average.sub(stop))).add(fees);
  const reward = nonnegative(quantity.mul(target.sub(average))).sub(fees);
  const leg = plan.legs[0]!;
  return {
    kind: 'Value',
    value: {
      averageEntry: value(average),
      windowQuantity: value(quantity),
      windowFees: value(fees),
      actualInitialRisk: value(risk),
      actualInitialReward: value(reward),
      riskInPlanR: value(risk.div(baseline.oneR)),
      slippage: value(average.sub(decimal(leg.intendedEntry)).mul(quantity)),
      sizeRatio: value(quantity.div(decimal(leg.quantity))),
      plannedRewardRisk: value(baseline.rewardRiskRatio),
      actualRewardRisk: flags[0] ? { kind: 'NotApplicable', reason: flags[0] } : value(reward.div(risk)),
      flags,
    },
  };
}

function legFulfillmentOf(
  plan: TradeAnalysisRecord['plan'],
  facts: readonly ExecutionFact[],
  deviations: readonly ExpectedDeviation[],
): LegFulfillment[] {
  return plan.legs.map((leg) => {
    const entered = total(
      facts.filter((e) => e.action === 'Buy' && e.intent.plannedLegId === leg.factId),
      (e) => decimal(e.quantity),
    );
    // Any active Entry Size occurrence on the leg is a Deviation (A25).
    const fulfillment: LegFulfillment['fulfillment'] = deviations.some((d) => d.fingerprint.plannedLegId === leg.factId)
      ? 'FilledWithDeviation'
      : entered.compare(Rational.of(0n)) === 0
        ? 'Unfilled'
        : entered.compare(decimal(leg.quantity)) < 0
          ? 'PartiallyFilled'
          : 'FilledAsPlanned';
    return { plannedLegId: leg.factId, fulfillment };
  });
}

// Entry Size excess (P4): one occurrence per Position Change that raises a Planned Leg's open
// quantity above its planned quantity, carrying the quantity it added above plan.
function deviationsOf(record: TradeAnalysisRecord): ExpectedDeviation[] {
  return record.plan.legs.flatMap((leg) => {
    const planned = decimal(leg.quantity);
    let entered = Rational.of(0n);
    return [...record.positionChanges].sort(factOrder).flatMap((pc): ExpectedDeviation[] => {
      const before = entered;
      for (const e of pc.executions) if (e.action === 'Buy' && e.intent.plannedLegId === leg.factId) entered = entered.add(decimal(e.quantity));
      const above = entered.sub(before.compare(planned) > 0 ? before : planned);
      if (above.compare(Rational.of(0n)) <= 0) return [];
      return [
        {
          fingerprint: {
            tradeId: record.tradeId,
            plannedLegId: leg.factId,
            positionChangeId: pc.factId,
          },
          type: 'EntrySize',
          form: 'Excess',
          quantityAbovePlan: above,
          causingPositionChangeId: pc.factId,
          economicTime: pc.economicTime,
        },
      ];
    });
  });
}

// Entry Size shortfall (A83): when the first reduction cuts the entry window before a Planned Leg is
// entered in full, one occurrence per such leg holds the planned quantity less the quantity entered
// at resolution, caused by the cutting Sell's Position Change.
function shortfallsOf(
  record: TradeAnalysisRecord,
  entry: { window: readonly ExecutionFact[]; cutBy?: PositionChangeFact },
): ExpectedDeviation[] {
  const cut = entry.cutBy;
  if (!cut) return [];
  return record.plan.legs.flatMap((leg): ExpectedDeviation[] => {
    const entered = total(
      entry.window.filter((e) => e.intent.plannedLegId === leg.factId),
      (e) => decimal(e.quantity),
    );
    const short = decimal(leg.quantity).sub(entered);
    if (short.compare(Rational.of(0n)) <= 0) return [];
    return [
      {
        fingerprint: { tradeId: record.tradeId, plannedLegId: leg.factId, form: 'Shortfall' },
        type: 'EntrySize',
        form: 'Shortfall',
        quantityBelowPlan: short,
        causingPositionChangeId: cut.factId,
        economicTime: cut.economicTime,
      },
    ];
  });
}

const fingerprintKey = (f: DeviationFingerprint) =>
  JSON.stringify([f.tradeId, f.plannedLegId, f.form === 'Shortfall' ? f.form : f.positionChangeId]);

const latestVersion = (r: RecordedDeviation) => r.versions[r.versions.length - 1]!;

// The quantity an occurrence holds: above plan for Excess, below plan for Shortfall.
const quantityOf = (d: ExpectedDeviation): Rational => (d.form === 'Excess' ? d.quantityAbovePlan : d.quantityBelowPlan);
const recordedQuantityOf = (v: RecordedDeviationVersion): Rational =>
  decimal(v.form === 'Excess' ? v.quantityAbovePlan : v.quantityBelowPlan);

// Pairs each expected occurrence with the recorded one of the same fingerprint, and returns the
// recorded occurrences left unpaired.
function matchOccurrences(expected: readonly ExpectedDeviation[], recorded: readonly RecordedDeviation[]) {
  const unpaired = new Map(recorded.map((r) => [fingerprintKey(latestVersion(r).fingerprint), r]));
  const pairs = expected.map((occurrence) => {
    const key = fingerprintKey(occurrence.fingerprint);
    const match = unpaired.get(key);
    unpaired.delete(key);
    return {
      occurrence,
      match: match && {
        occurrenceId: match.occurrenceId,
        version: latestVersion(match),
      },
    };
  });
  return {
    pairs,
    unpaired: [...unpaired.values()].map((r) => ({
      occurrenceId: r.occurrenceId,
      version: latestVersion(r),
    })),
  };
}

// Compares expected and active recorded occurrences by fingerprint.
function deviationFindings(expected: readonly ExpectedDeviation[], recorded: readonly RecordedDeviation[]): IntegrityFinding[] {
  const { pairs, unpaired } = matchOccurrences(expected, recorded);
  const findings: IntegrityFinding[] = [];
  for (const { occurrence, match } of pairs) {
    if (match?.version.status !== 'Active') {
      findings.push({
        kind: 'DeviationMissing',
        fingerprint: occurrence.fingerprint,
        expected: occurrence,
      });
      continue;
    }
    const stored = recordedQuantityOf(match.version);
    if (stored.compare(quantityOf(occurrence)) !== 0)
      findings.push({
        kind: 'DeviationQuantityDisagreement',
        fingerprint: occurrence.fingerprint,
        occurrenceId: match.occurrenceId,
        recorded: stored,
        expected: quantityOf(occurrence),
      });
  }
  for (const { occurrenceId, version } of unpaired)
    if (version.status === 'Active')
      findings.push({
        kind: 'DeviationUnexpected',
        fingerprint: version.fingerprint,
        occurrenceId,
      });
  return findings;
}

// Create, retain, append a new version when an occurrence changed or returns, or supersede.
function deviationActions(expected: readonly ExpectedDeviation[], recorded: readonly RecordedDeviation[]): DeviationAction[] {
  const { pairs, unpaired } = matchOccurrences(expected, recorded);
  return [
    ...pairs.map(({ occurrence, match }): DeviationAction => {
      if (!match) return { kind: 'Create', occurrence };
      const unchanged =
        match.version.status === 'Active' && recordedQuantityOf(match.version).compare(quantityOf(occurrence)) === 0;
      return unchanged
        ? {
            kind: 'Retain',
            occurrenceId: match.occurrenceId,
            fingerprint: occurrence.fingerprint,
          }
        : { kind: 'NewVersion', occurrenceId: match.occurrenceId, occurrence };
    }),
    ...unpaired.map(({ occurrenceId, version }): DeviationAction =>
      version.status === 'Active'
        ? {
            kind: 'Supersede',
            occurrenceId,
            fingerprint: version.fingerprint,
            reason: 'NoLongerExpected',
          }
        : { kind: 'Retain', occurrenceId, fingerprint: version.fingerprint },
    ),
  ];
}

// The change's own effects: expected state before the change versus after it.
function changeEffects(before: DerivedTradeState, lifecycle: LifecycleState, deviations: readonly ExpectedDeviation[]): ChangeEffect[] {
  const effects: ChangeEffect[] = [];
  if (before.expectedLifecycle !== lifecycle)
    effects.push({
      kind: 'LifecycleTransition',
      from: before.expectedLifecycle,
      to: lifecycle,
    });
  const prior = new Map(before.deviations.map((d) => [fingerprintKey(d.fingerprint), d]));
  for (const d of deviations) {
    const key = fingerprintKey(d.fingerprint);
    const earlier = prior.get(key);
    const from = earlier ? quantityOf(earlier) : null;
    prior.delete(key);
    if (from?.compare(quantityOf(d)) !== 0)
      effects.push({
        kind: 'DeviationChange',
        fingerprint: d.fingerprint,
        from,
        to: quantityOf(d),
      });
  }
  for (const d of prior.values())
    effects.push({
      kind: 'DeviationChange',
      fingerprint: d.fingerprint,
      from: quantityOf(d),
      to: null,
    });
  return effects;
}

// The record's effective facts at or before the cutoff; a Position Change keeps its members that are.
function atCutoff(record: TradeAnalysisRecord, cutoff: Instant | undefined): TradeAnalysisRecord {
  if (cutoff === undefined) return record;
  const upTo = (at: Instant) => Temporal.Instant.compare(at, cutoff) <= 0;
  return {
    ...record,
    positionChanges: record.positionChanges
      .map((pc) => ({ ...pc, executions: pc.executions.filter((e) => upTo(e.economicTime)) }))
      .filter((pc) => pc.executions.length > 0),
    // A recorded Deviation is placed by the Economic Time of the Position Change that raised it.
    ...(record.recordedDeviations && {
      recordedDeviations: record.recordedDeviations.filter((d) => upTo(latestVersion(d).economicTime)),
    }),
  };
}

export function derive(input: TradeDerivationInput): DerivationResult {
  const record = atCutoff(input.record, input.cutoff);
  const findings = incoherence(record);
  if (findings.length > 0) return { kind: 'IncoherentFacts', findings };
  const facts = record.positionChanges
    // Nested values are copied so the inert output never aliases the caller's input.
    .flatMap((pc) =>
      pc.executions.map((e) => ({ ...e, instrument: { ...e.instrument }, intent: { ...e.intent }, positionChangeId: pc.factId })),
    )
    .sort(factOrder);
  const pathFindings = positionPathFindings(facts);
  if (pathFindings.length > 0) return { kind: 'IncoherentFacts', findings: pathFindings };
  const { positions, lotMatches, lotMatchResults } = replayOf(facts);
  const entry = entryWindowOf(record);
  const baseline = frozenBaseline(record.plan);
  // Nonzero exposure makes the Trade Open; exposure that existed and is gone makes it Closed (the
  // path checks make that flat point the last fact); no effective fact leaves it Planned.
  const expectedLifecycle: LifecycleState = lifecycleOf(facts, positions);
  const closed = expectedLifecycle === 'Closed';
  const realizedToDate = lotMatchResults.reduce((sum, r) => (r.realized.kind === 'Value' ? sum.add(r.realized.value) : sum), Rational.of(0n));
  const deviations = [...deviationsOf(record), ...shortfallsOf(record, entry)];
  const before = input.candidate && derive({ record: input.candidate.before, ...(input.cutoff && { cutoff: input.cutoff }) });
  if (before?.kind === 'IncoherentFacts') return before;
  const agreement: LifecycleAgreement =
    record.storedLifecycle === expectedLifecycle
      ? { kind: 'Agrees' }
      : {
          kind: 'LifecycleDisagreement',
          stored: record.storedLifecycle,
          expected: expectedLifecycle,
        };
  return {
    kind: 'Derived',
    tradeId: record.tradeId,
    factRevision: record.factRevision,
    expectedLifecycle,
    agreement,
    facts,
    positions,
    lotMatches,
    lotMatchResults,
    realizedToDate,
    exposureStart: facts[0]?.economicTime ?? null,
    terminalTime: closed ? terminalPositionChangeOf(record, facts).economicTime : null,
    terminalDisposition: terminalDispositionOf(expectedLifecycle, lotMatches),
    // Every D6 Trade has a positive 1R, so the quotient is always a Value.
    realizedR: closed ? value(realizedToDate.div(baseline.oneR)) : { kind: 'NotApplicable', reason: 'NotClosed' },
    observationRequirements: input.valuationDate === undefined ? [] : observationRequirementsOf(positions, facts, input.valuationDate),
    fees: {
      incurredOpening: facts.filter((e) => e.action === 'Buy').reduce((sum, e) => sum.add(decimal(e.fee)), Rational.of(0n)),
      incurred: facts.reduce((sum, e) => sum.add(decimal(e.fee)), Rational.of(0n)),
    },
    netCost: netCostOf(positions),
    baseline,
    entryResolution: entry.resolution,
    entryQuality: entryQualityOf(entry.resolution, entry.window, record.plan, baseline),
    legFulfillment: legFulfillmentOf(record.plan, facts, deviations),
    deviations,
    findings: [...(agreement.kind === 'Agrees' ? [] : [agreement]), ...deviationFindings(deviations, record.recordedDeviations ?? [])],
    ...(input.candidate &&
      before && {
        reconciliation: {
          candidateDigest: input.candidate.digest,
          expectedLifecycle,
          exposureStart: facts[0]?.economicTime ?? null,
          closeRequirement: closeRequirementOf(record, facts, closed),
          deviationActions: deviationActions(deviations, input.candidate.before.recordedDeviations ?? []),
          repairs: before.findings,
          effects: changeEffects(before, expectedLifecycle, deviations),
        },
      }),
  };
}
