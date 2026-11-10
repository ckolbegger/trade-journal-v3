import { Temporal } from 'temporal-polyfill';
import type { Instant } from '../time/index.ts';
import type { CalculationResult, ExecutionDescription, ExpirationDescription, IncoherentFact, NotApplicableReason } from '../calculation-result/index.ts';
import { expiredOn, instrumentKey, multiplierOf, settlementDueOn, type OptionInstrument, type StockInstrument } from '../instrument/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { frozenBaseline, type ConditionInput, type PlanBaseline, type PlannedLegInput } from './plan.ts';

export type LifecycleState = 'Planned' | 'Open' | 'Closed' | 'Abandoned';

// One effective fill. D2 records Buys and D6 Sells of the Plan's Stock serving its Planned Leg
// (D2 A18, D6 A76); D7 adds fills of the Plan's option contract (A102).
export interface ExecutionFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly action: 'Buy' | 'Sell';
  readonly instrument: StockInstrument | OptionInstrument;
  readonly quantity: string;
  readonly price: string;
  readonly fee: string;
  readonly intent: { readonly kind: 'ServesPlannedLeg'; readonly plannedLegId: string };
}

// A settlement fact (A106): the option Instrument, the quantity, and the settlement time (P26). It has no
// price, no fee and no agency, and is never an Execution. The Instrument may be a stock only so that
// analysis can report NotAnOption.
export interface ExpirationFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly instrument: StockInstrument | OptionInstrument;
  readonly quantity: string;
}

// One decision grouping its member Executions, or (D7) holding one Expiration member; its Economic Time
// is its earliest Execution's (A19), or the settlement time for an Expiration (A106).
export interface PositionChangeFact {
  readonly factId: string;
  readonly economicTime: Instant;
  readonly recordedSequence: number;
  readonly executions: readonly ExecutionFact[];
  readonly settlements?: readonly ExpirationFact[];
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
    // A long option Plan's Exercise Intent (A100); absent for stock and the Cash-Secured Put.
    readonly exerciseIntent?: 'Authorized' | 'NotAuthorized';
    readonly legs: readonly (PlannedLegInput & { readonly factId: string })[];
    readonly stops: readonly (ConditionInput & { readonly factId: string })[];
    readonly targets: readonly (ConditionInput & { readonly factId: string })[];
  };
  readonly positionChanges: readonly PositionChangeFact[];
  // Recorded Deviation occurrences, authoritative in Trade Record; absent means none recorded.
  readonly recordedDeviations?: readonly RecordedDeviation[];
  // The Close Reason a terminal Position Change was recorded with (D6 A85); absent while no fact
  // has one.
  readonly closeReason?: {
    readonly factId: string;
    readonly recordedSequence: number;
    readonly closeReasonId: string;
    readonly terminalPositionChangeId: string;
  };
  // The stored Terminal Time of a Closed Trade: the terminal Position Change's Economic Time (A87).
  readonly terminalTime?: Instant;
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

// An open option contract's standing against its expiration date (P81): Live before it, DueToday on
// it (Settlement Due, P25), PastExpiration after it.
export type ContractStatus = 'Live' | 'DueToday' | 'PastExpiration';
export interface ContractStatusEntry {
  readonly instrument: OptionInstrument;
  readonly status: ContractStatus;
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
// Later variants add Assignment, Exercise, and cash settlement.
export interface DispositionMechanism {
  readonly mechanism: 'Executions' | 'Expiration';
  readonly quantity: Rational;
}

export type TerminalDisposition = CalculationResult<readonly DispositionMechanism[], never, Extract<NotApplicableReason, { reason: 'NotClosed' }>>;

// A108: how a Closed option Trade's opened contracts were disposed, with both quantities.
export interface OptionDispositionTiming {
  readonly timing: 'FullyDisposedPreExpiration' | 'FullyHeldToExpirationSettlement' | 'Mixed';
  readonly disposedByExecutions: Rational;
  readonly disposedBySettlement: Rational;
}

export type OptionDispositionTimingResult = CalculationResult<
  OptionDispositionTiming,
  never,
  Extract<NotApplicableReason, { reason: 'NotClosed' | 'NoOptionExpirationAnchor' }>
>;

// Derived signed net quantity and Open Lots for one exact Instrument within the Trade.
export interface InstrumentPosition {
  readonly instrument: ExecutionFact['instrument'];
  readonly quantity: Rational;
  readonly openLots: readonly OpenLot[];
}

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
  readonly actualRewardRisk: CalculationResult<Rational, never, Extract<NotApplicableReason, { reason: EntryFlag }>>;
  readonly flags: readonly EntryFlag[];
}

// An average entry at or beyond a boundary: the actual reward/risk ratio is then not applicable.
export type EntryFlag = 'EntryAtOrBeyondStop' | 'EntryAtOrBeyondTarget';

export type EntryQuality = CalculationResult<EntryQualityFigures, never, Extract<NotApplicableReason, { reason: 'EntryNotResolved' }>>;

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

// An Expiration closes a Trade with no agency (A107), so it needs no Close Reason.
export type CloseRequirement = 'TerminalWithAgency' | 'TerminalWithoutAgency' | 'NotTerminal';

// Trade Analysis's expected state for one exact candidate, which Trade Record's apply requires.
export type DerivedTradeReconciliation = ReconciliationBase &
  (
    | {
        readonly expectedLifecycle: 'Closed';
        // The candidate's Position Change holding the last fact in Fact Order: the one a Close
        // Reason names and whose Economic Time is the Terminal Time (decision 96, D6 A87).
        readonly terminalPositionChangeId: string;
      }
    | { readonly expectedLifecycle: Exclude<LifecycleState, 'Closed'>; readonly terminalPositionChangeId: null }
  );
interface ReconciliationBase {
  readonly candidateDigest: string;
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
  // NotApplicable(NotClosed) unless Closed; NotApplicable(NoOptionExpirationAnchor) for a stock-only Trade (A108).
  readonly optionDispositionTiming: OptionDispositionTimingResult;
  // Net realized P&L over 1R; NotApplicable(NotClosed) unless the expected lifecycle is Closed (A81).
  readonly realizedR: CalculationResult<Rational, never, Extract<NotApplicableReason, { reason: 'NotClosed' }>>;  // One per Instrument with remaining quantity; none for a Planned Trade.
  readonly observationRequirements: readonly ObservationRequirement[];
  // The date the statuses and requirements are for; absent when derive had none (A192).
  readonly valuationDate?: string;
  // One per option position with remaining quantity at the valuation date (P81); none without a date.
  readonly contractStatuses: readonly ContractStatusEntry[];
  // Actual fees, each Execution's counted once: the opening Executions' alone, and every Execution's
  // (A80). Neither is ever subtracted from realized P&L again.
  readonly fees: { readonly incurredOpening: Rational; readonly incurred: Rational };
  // Signed cost of the remaining open exposure: quantity x price over the Open Lots plus their unconsumed
  // opening fees (D4's C + F). Stock only until options add a multiplier.
  readonly netCost: CalculationResult<Rational, never, Extract<NotApplicableReason, { reason: 'NoRemainingPosition' }>>;
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
// Each finding describes itself (P69). An Execution's quantity is the recorded decimal text, since a
// nonpositive one is itself a finding; Economic Time is the fact's Instant.
// The types live in calculation-result, since an Unavailable result carries them; re-exported here.
export type { ExecutionDescription, ExpirationDescription, IncoherentFact };

function described(e: ExecutionFact): ExecutionDescription {
  return { factId: e.factId, kind: 'Execution', instrument: { ...e.instrument }, economicTime: e.economicTime, side: e.action, quantity: e.quantity };
}

function describedExpiration(s: ExpirationFact): ExpirationDescription {
  return { factId: s.factId, kind: 'Expiration', instrument: { ...s.instrument }, economicTime: s.economicTime, quantity: s.quantity };
}

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
    if (seen.has(pc.factId)) findings.push({ factId: pc.factId, kind: 'PositionChange', economicTime: pc.economicTime, reason: 'DuplicateFactId' });
    seen.add(pc.factId);
    for (const e of pc.executions) {
      if (seen.has(e.factId)) findings.push({ ...described(e), reason: 'DuplicateFactId' });
      seen.add(e.factId);
    }
    for (const e of pc.executions) {
      if (!legs.has(e.intent.plannedLegId)) findings.push({ ...described(e), reason: 'UnknownPlannedLeg' });
      const quantity = parseDecimal(e.quantity, { positive: true });
      if (!quantity.ok) findings.push({ ...described(e), reason: 'NonpositiveQuantity' });
      if (e.instrument.kind !== 'Option') continue;
      // A102: whole contracts, and no Execution after the contract's expiration (New York date).
      if (quantity.ok && quantity.value.denominator !== 1n) findings.push({ ...described(e), reason: 'ContractQuantityNotWhole' });
      const day = Temporal.Instant.from(e.economicTime).toZonedDateTimeISO('America/New_York').toPlainDate().toString();
      if (expiredOn(e.instrument, day)) findings.push({ ...described(e), reason: 'AfterExpiration' });
    }
  }
  for (const s of record.positionChanges.flatMap((pc) => pc.settlements ?? [])) {
    if (seen.has(s.factId)) findings.push({ ...describedExpiration(s), reason: 'DuplicateFactId' });
    seen.add(s.factId);
    if (!parseDecimal(s.quantity, { positive: true }).ok) findings.push({ ...describedExpiration(s), reason: 'NonpositiveQuantity' });
    if (s.instrument.kind !== 'Option') {
      findings.push({ ...describedExpiration(s), reason: 'NotAnOption' });
      continue;
    }
    // A106: the New York date is on or before the expiration date, and the time is after every Execution on the contract.
    const day = Temporal.Instant.from(s.economicTime).toZonedDateTimeISO('America/New_York').toPlainDate().toString();
    const key = instrumentKey(s.instrument);
    const beforeExecution = record.positionChanges.some((pc) =>
      pc.executions.some((e) => instrumentKey(e.instrument) === key && Temporal.Instant.compare(s.economicTime, e.economicTime) <= 0),
    );
    if (expiredOn(s.instrument, day) || beforeExecution) findings.push({ ...describedExpiration(s), reason: 'SettlementTimeInvalid' });
  }
  return findings;
}

// One member of Fact Order: an Execution, or an Expiration (a Position Change member with no agency),
// with the Position Change that holds it.
type Step =
  | { readonly kind: 'Execution'; readonly fact: ExecutionFact; readonly positionChangeId: string }
  | { readonly kind: 'Expiration'; readonly fact: ExpirationFact; readonly positionChangeId: string };
// What disposes Lots: an Execution, or an Expiration with price 0 and no fee.
type Disposal = Pick<ExecutionFact, 'factId' | 'economicTime' | 'quantity' | 'price' | 'fee' | 'instrument'>;

// Whether an Execution opens exposure: by its Planned Leg's role, a long leg's Buy or a short leg's
// Sell (A102); the other action closes. Every Execution's leg is known once incoherence() has passed.
type Opens = (e: ExecutionFact) => boolean;
function opensOf(legs: TradeAnalysisRecord['plan']['legs']): Opens {
  const short = new Set(legs.filter((l) => l.side === 'Short').map((l) => l.factId));
  return (e) => short.has(e.intent.plannedLegId) === (e.action === 'Sell');
}

// P22, A103: replaying in Fact Order, the open quantity never crosses zero and may reach zero only at
// the last fact. A closing Execution above the quantity open is reported with the magnitude then
// available and does not reduce it.
// An Expiration must settle the whole quantity open (A106).
function positionPathFindings(steps: readonly Step[], opens: Opens): IncoherentFact[] {
  const findings: IncoherentFact[] = [];
  let open = Rational.of(0n);
  steps.forEach((step, index) => {
    const quantity = decimal(step.fact.quantity);
    if (step.kind === 'Expiration') {
      if (quantity.compare(open) === 0) open = Rational.of(0n);
      else findings.push({ ...describedExpiration(step.fact), reason: 'ExpirationMustSettleAllOpen', available: open });
      return;
    }
    const e = step.fact;
    if (opens(e)) {
      open = open.add(quantity);
    } else if (quantity.compare(open) > 0) {
      findings.push({ ...described(e), reason: 'ExceedsOpenQuantity', available: open });
    } else {
      open = open.sub(quantity);
      if (open.compare(Rational.of(0n)) === 0 && index < steps.length - 1) findings.push({ ...described(e), reason: 'FlatBeforeLaterFacts' });
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
  const lots = positions.flatMap((p) => {
    const multiplier = Rational.of(BigInt(multiplierOf(p.instrument)));
    return p.openLots.map((lot) => ({ lot, multiplier }));
  });
  if (lots.length === 0) return { kind: 'NotApplicable', reason: 'NoRemainingPosition' };
  const total = lots.reduce((sum, { lot: l, multiplier }) => sum.add(l.quantity.mul(l.price).mul(multiplier)).add(l.unconsumedOpeningFee), Rational.of(0n));
  return { kind: 'Value', value: total };
}

// Replays the facts in Fact Order. Each opening Execution creates one Open Lot holding its whole fee
// (D2 A22), signed negative for a short role; each closing one consumes the oldest Lots first (A79,
// A104), one Lot Match per Lot it touches. An Expiration disposes the Lots the same way at price 0 with no
// fee (A106), so a long Lot realizes -q x 100 x basis less its opening fee and a short Lot the reverse sign.
// Nothing is stored (P23).
function replayOf(steps: readonly Step[], opens: Opens): {
  positions: InstrumentPosition[];
  lotMatches: LotMatch[];
  lotMatchResults: LotMatchResult[];
} {
  const lots: OpenLot[] = [];
  const originals = new Map<string, { quantity: Rational; price: Rational; fee: Rational; direction: 1 | -1 }>();
  const lotMatches: LotMatch[] = [];
  const lotMatchResults: LotMatchResult[] = [];
  for (const step of steps) {
    const e: Disposal = step.kind === 'Execution' ? step.fact : { ...step.fact, price: '0', fee: '0' };
    if (step.kind === 'Execution' && opens(step.fact)) {
      const lot = { quantity: decimal(e.quantity), price: decimal(e.price), fee: decimal(e.fee), direction: step.fact.action === 'Buy' ? (1 as const) : (-1 as const) };
      originals.set(e.factId, lot);
      lots.push({ openingExecutionId: e.factId, quantity: lot.quantity, price: lot.price, unconsumedOpeningFee: lot.fee });
      continue;
    }
    const sold = decimal(e.quantity);
    const multiplier = Rational.of(BigInt(multiplierOf(e.instrument)));
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
        // q x multiplier x (sell price - buy price) less both allocated fees (A80); a short Lot's
        // direction reverses the price difference (A104).
        realized: value(
          matched
            .mul(multiplier)
            .mul(decimal(e.price).sub(original.price))
            .mul(Rational.of(BigInt(original.direction)))
            .sub(allocatedOpeningFee)
            .sub(allocatedDisposalFee),
        ),
      });
      remaining = remaining.sub(matched);
      const left = { ...lot, unconsumedOpeningFee: lot.unconsumedOpeningFee.sub(allocatedOpeningFee) };
      if (lot.quantity.compare(matched) === 0) lots.shift();
      else lots[0] = { ...left, quantity: lot.quantity.sub(matched) };
    }
  }
  if (steps.length === 0) return { positions: [], lotMatches, lotMatchResults };
  // A short Lot reads back signed negative, so the Position's quantity is signed too.
  const signed = lots.map((l) => ({ ...l, quantity: l.quantity.mul(Rational.of(BigInt(originals.get(l.openingExecutionId)!.direction))) }));
  return {
    positions: [
      {
        instrument: steps[0]!.fact.instrument,
        quantity: signed.reduce((sum, l) => sum.add(l.quantity), Rational.of(0n)),
        openLots: signed,
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

// Whether the candidate's new (latest-recorded) Position Change closes the Trade. Every
// Execution, Buy or Sell, carries trader agency (A77); an Expiration carries none (A107).
function closeRequirementOf(
  record: TradeAnalysisRecord,
  steps: readonly Step[],
  closed: boolean,
): CloseRequirement {
  if (!closed) return 'NotTerminal';
  const newest = record.positionChanges.reduce((a, b) => (b.recordedSequence > a.recordedSequence ? b : a));
  // Decision 96: the commit that makes the Trade Closed is the closing one, even when it is dated
  // before the last fill. An Expiration is always the last fact, so it is never the earlier-dated one.
  return steps.some((s) => s.positionChangeId === newest.factId && s.kind === 'Expiration') ? 'TerminalWithoutAgency' : 'TerminalWithAgency';
}

// How a Closed Trade's exposure ended (A84, ADR 0003): derived from the disposing facts, never
// stored. Each mechanism that disposed a quantity is listed with it: Executions, then Expiration (A108).
function terminalDispositionOf(lifecycle: LifecycleState, disposed: Disposed): TerminalDisposition {
  if (lifecycle !== 'Closed') return { kind: 'NotApplicable', reason: 'NotClosed' };
  const zero = Rational.of(0n);
  const mechanisms: DispositionMechanism[] = [
    { mechanism: 'Executions', quantity: disposed.byExecutions },
    { mechanism: 'Expiration', quantity: disposed.bySettlement },
  ];
  return { kind: 'Value', value: mechanisms.filter((m) => m.quantity.compare(zero) > 0) };
}

// The quantities Lot Matches disposed by Executions and by settlement (a Lot Match whose disposing fact is an Expiration).
interface Disposed {
  readonly byExecutions: Rational;
  readonly bySettlement: Rational;
}
function disposedOf(lotMatches: readonly LotMatch[], steps: readonly Step[]): Disposed {
  const settlements = new Set(steps.filter((s) => s.kind === 'Expiration').map((s) => s.fact.factId));
  const sum = (settled: boolean) =>
    lotMatches.filter((m) => settlements.has(m.disposingExecutionId) === settled).reduce((total, m) => total.add(m.quantity), Rational.of(0n));
  return { byExecutions: sum(false), bySettlement: sum(true) };
}

// A108: for a Closed option Trade, the opened contracts' disposal by Executions and by settlement.
function optionDispositionTimingOf(lifecycle: LifecycleState, positions: readonly InstrumentPosition[], disposed: Disposed): OptionDispositionTimingResult {
  if (lifecycle !== 'Closed') return { kind: 'NotApplicable', reason: 'NotClosed' };
  if (positions[0]?.instrument.kind !== 'Option') return { kind: 'NotApplicable', reason: 'NoOptionExpirationAnchor' };
  const zero = Rational.of(0n);
  const timing =
    disposed.bySettlement.compare(zero) === 0
      ? 'FullyDisposedPreExpiration'
      : disposed.byExecutions.compare(zero) === 0
        ? 'FullyHeldToExpirationSettlement'
        : 'Mixed';
  return { kind: 'Value', value: { timing, disposedByExecutions: disposed.byExecutions, disposedBySettlement: disposed.bySettlement } };
}

function contractStatusesOf(positions: readonly InstrumentPosition[], valuationDate: string): ContractStatusEntry[] {
  return positions.flatMap((p) => {
    if (p.instrument.kind !== 'Option' || p.quantity.compare(Rational.of(0n)) === 0) return [];
    const status: ContractStatus = expiredOn(p.instrument, valuationDate)
      ? 'PastExpiration'
      : settlementDueOn(p.instrument, valuationDate)
        ? 'DueToday'
        : 'Live';
    return [{ instrument: p.instrument, status }];
  });
}

function observationRequirementsOf(
  positions: readonly InstrumentPosition[],
  facts: readonly ExecutionFact[],
  valuationDate: string,
  statuses: readonly ContractStatusEntry[],
): ObservationRequirement[] {
  // An option needs the contract's Mark and its Underlying's (A110) while Live or DueToday.
  // Once PastExpiration a contract needs no Mark and neither does its Underlying: it is Settlement Due (P25).
  const pastExpiration = new Set(statuses.filter((s) => s.status === 'PastExpiration').map((s) => instrumentKey(s.instrument)));
  return positions
    .filter((p) => p.quantity.compare(Rational.of(0n)) !== 0)
    .filter((p) => !pastExpiration.has(instrumentKey(p.instrument)))
    .flatMap((p) => {
      const earliestRelevance = facts.find((e) => e.instrument.symbol === p.instrument.symbol)!.economicTime;
      const underlying: StockInstrument[] = p.instrument.kind === 'Option' ? [{ kind: 'Stock', symbol: p.instrument.symbol }] : [];
      return [p.instrument, ...underlying].map((instrument) => ({ instrument, valuationDate, earliestRelevance }));
    });
}

// FactOrder: Economic Time, then the stable Recorded Sequence for ties.
type Ordered = Pick<ExecutionFact, 'economicTime' | 'recordedSequence'>;
function factOrder(a: Ordered, b: Ordered): number {
  return Temporal.Instant.compare(a.economicTime, b.economicTime) || a.recordedSequence - b.recordedSequence;
}

// What the terminal Position Change needs of a change: its Economic Time and the ordering keys of
// the members it lists (a change's own Economic Time is its earliest member's, D2 A19).
export interface TerminalCandidate {
  readonly economicTime: Instant;
  readonly executions: readonly Ordered[];
  readonly settlements?: readonly Ordered[];
}

// The one source of the terminal Position Change (D6 A87, P22): the change holding the last member
// in Fact Order, counting only the members a change lists, at their effective versions. At a full
// tie an Execution precedes an Expiration. It need not have the latest Economic Time itself.
// Undefined when no change lists a member.
export function terminalPositionChangeOf<C extends TerminalCandidate>(changes: readonly C[]): C | undefined {
  const membersOf = (listed: (change: C) => readonly Ordered[]) =>
    changes.flatMap((change) => listed(change).map((member) => ({ change, member })));
  return [...membersOf((c) => c.executions), ...membersOf((c) => c.settlements ?? [])]
    .sort((a, b) => factOrder(a.member, b.member))
    .at(-1)?.change;
}

// The entry window opens with the first Position Change and resolves at the first one, in Fact
// Order, after which every Planned Leg's entered quantity reaches its planned quantity (A23), or
// immediately before the first Position Change holding a closing Execution (a Sell for a long leg, a
// Buy for a short one), whichever comes first (A82). The window holds every Execution of the
// Position Changes up to and including the resolving one; a window cut by a closing Execution names
// that cutting Position Change.
function entryWindowOf(record: TradeAnalysisRecord, opens: Opens): {
  resolution: EntryResolution;
  window: ExecutionFact[];
  cutBy?: PositionChangeFact;
} {
  const entered = new Map<string, Rational>();
  const window: ExecutionFact[] = [];
  let last: PositionChangeFact | undefined;
  for (const pc of [...record.positionChanges].sort(factOrder)) {
    if (last && pc.executions.some((e) => !opens(e)))
      return { resolution: { kind: 'Resolved', positionChangeId: last.factId }, window, cutBy: pc };
    last = pc;
    for (const e of pc.executions) {
      const leg = e.intent.plannedLegId;
      // Only an opening Execution enters; a closing one reduces exposure (P4).
      if (opens(e)) entered.set(leg, (entered.get(leg) ?? Rational.of(0n)).add(decimal(e.quantity)));
      window.push(e);
    }
    const filled = record.plan.legs.every((leg) => (entered.get(leg.factId)?.compare(plannedContracts(leg)) ?? -1) >= 0);
    if (filled) return { resolution: { kind: 'Resolved', positionChangeId: pc.factId }, window };
  }
  return { resolution: { kind: 'Unresolved' }, window };
}

// A Planned Leg's quantity as a magnitude: an option's is signed by its side (A100).
function plannedContracts(leg: { readonly quantity: string }): Rational {
  const planned = decimal(leg.quantity);
  return planned.numerator < 0n ? Rational.of(0n).sub(planned) : planned;
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
  const leg = plan.legs[0]!;
  // An option measures each condition by its value at expiration (A105); stock by its trigger price.
  const stop = baseline.stopBasis[0]!.valueAtExpiration ?? decimal(plan.stops[0]!.price);
  const target = baseline.targetBasis[0]!.valueAtExpiration ?? decimal(plan.targets[0]!.price);
  // Long exposure gains as the price rises; a short one reverses every price difference.
  const direction = Rational.of(leg.side === 'Long' ? 1n : -1n);
  const scale = Rational.of(BigInt(multiplierOf(leg.instrument)));
  const flags: EntryFlag[] = [];
  if (average.sub(stop).mul(direction).compare(zero) <= 0) flags.push('EntryAtOrBeyondStop');
  if (target.sub(average).mul(direction).compare(zero) <= 0) flags.push('EntryAtOrBeyondTarget');
  const nonnegative = (r: Rational) => (r.compare(zero) > 0 ? r : zero);
  const risk = nonnegative(quantity.mul(scale).mul(average.sub(stop)).mul(direction)).add(fees);
  const reward = nonnegative(quantity.mul(scale).mul(target.sub(average)).mul(direction)).sub(fees);
  return {
    kind: 'Value',
    value: {
      averageEntry: value(average),
      windowQuantity: value(quantity),
      windowFees: value(fees),
      actualInitialRisk: value(risk),
      actualInitialReward: value(reward),
      riskInPlanR: value(risk.div(baseline.oneR)),
      // Positive is worse: paying more than intended for a long leg, receiving less for a short one.
      slippage: value(average.sub(decimal(leg.intendedEntry)).mul(quantity).mul(scale).mul(direction)),
      sizeRatio: value(quantity.div(plannedContracts(leg))),
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
  opens: Opens,
): LegFulfillment[] {
  return plan.legs.map((leg) => {
    const entered = total(
      facts.filter((e) => opens(e) && e.intent.plannedLegId === leg.factId),
      (e) => decimal(e.quantity),
    );
    // Any active Entry Size occurrence on the leg is a Deviation (A25).
    const fulfillment: LegFulfillment['fulfillment'] = deviations.some((d) => d.fingerprint.plannedLegId === leg.factId)
      ? 'FilledWithDeviation'
      : entered.compare(Rational.of(0n)) === 0
        ? 'Unfilled'
        : entered.compare(plannedContracts(leg)) < 0
          ? 'PartiallyFilled'
          : 'FilledAsPlanned';
    return { plannedLegId: leg.factId, fulfillment };
  });
}

// Entry Size excess (P4): one occurrence per Position Change that raises a Planned Leg's open
// quantity above its planned quantity, carrying the quantity it added above plan.
function deviationsOf(record: TradeAnalysisRecord, opens: Opens): ExpectedDeviation[] {
  return record.plan.legs.flatMap((leg) => {
    const planned = plannedContracts(leg);
    let entered = Rational.of(0n);
    return [...record.positionChanges].sort(factOrder).flatMap((pc): ExpectedDeviation[] => {
      const before = entered;
      for (const e of pc.executions) if (opens(e) && e.intent.plannedLegId === leg.factId) entered = entered.add(decimal(e.quantity));
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
    const short = plannedContracts(leg).sub(entered);
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

// Whether a recorded version still holds what the facts imply. An Excess occurrence's cause is in
// its fingerprint, so only its quantity can move. A Shortfall's fingerprint has no cause, so its
// cause and Economic Time must match too (A83).
const holdsExpected = (v: RecordedDeviationVersion, d: ExpectedDeviation): boolean =>
  recordedQuantityOf(v).compare(quantityOf(d)) === 0 &&
  (d.form === 'Excess' || (v.causingPositionChangeId === d.causingPositionChangeId && v.economicTime === d.economicTime));

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
    if (!holdsExpected(match.version, occurrence))
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
      const unchanged = match.version.status === 'Active' && holdsExpected(match.version, occurrence);
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
      .map((pc) => ({
        ...pc,
        executions: pc.executions.filter((e) => upTo(e.economicTime)),
        ...(pc.settlements && { settlements: pc.settlements.filter((s) => upTo(s.economicTime)) }),
      }))
      .filter((pc) => pc.executions.length > 0 || (pc.settlements?.length ?? 0) > 0),
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
  const steps: Step[] = [
    ...facts.map((fact): Step => ({ kind: 'Execution', fact, positionChangeId: fact.positionChangeId })),
    ...record.positionChanges.flatMap((pc) =>
      (pc.settlements ?? []).map((fact): Step => ({ kind: 'Expiration', fact: { ...fact, instrument: { ...fact.instrument } }, positionChangeId: pc.factId })),
    ),
  ].sort((a, b) => factOrder(a.fact, b.fact));
  const opens = opensOf(record.plan.legs);
  const pathFindings = positionPathFindings(steps, opens);
  if (pathFindings.length > 0) return { kind: 'IncoherentFacts', findings: pathFindings };
  const { positions, lotMatches, lotMatchResults } = replayOf(steps, opens);
  const disposed = disposedOf(lotMatches, steps);
  const entry = entryWindowOf(record, opens);
  const baseline = frozenBaseline(record.plan);
  // Nonzero exposure makes the Trade Open; exposure that existed and is gone makes it Closed (the
  // path checks make that flat point the last fact); no effective fact leaves it Planned.
  const expectedLifecycle: LifecycleState = lifecycleOf(facts, positions);
  const closed = expectedLifecycle === 'Closed';
  const realizedToDate = lotMatchResults.reduce((sum, r) => (r.realized.kind === 'Value' ? sum.add(r.realized.value) : sum), Rational.of(0n));
  const deviations = [...deviationsOf(record, opens), ...shortfallsOf(record, entry)];
  const contractStatuses = input.valuationDate === undefined ? [] : contractStatusesOf(positions, input.valuationDate);
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
    terminalTime: closed ? terminalPositionChangeOf(record.positionChanges)!.economicTime : null,
    terminalDisposition: terminalDispositionOf(expectedLifecycle, disposed),
    optionDispositionTiming: optionDispositionTimingOf(expectedLifecycle, positions, disposed),
    // Every D6 Trade has a positive 1R, so the quotient is always a Value.
    realizedR: closed ? value(realizedToDate.div(baseline.oneR)) : { kind: 'NotApplicable', reason: 'NotClosed' },
    observationRequirements: input.valuationDate === undefined ? [] : observationRequirementsOf(positions, facts, input.valuationDate, contractStatuses),
    ...(input.valuationDate !== undefined && { valuationDate: input.valuationDate }),
    contractStatuses,
    fees: {
      incurredOpening: facts.filter(opens).reduce((sum, e) => sum.add(decimal(e.fee)), Rational.of(0n)),
      incurred: facts.reduce((sum, e) => sum.add(decimal(e.fee)), Rational.of(0n)),
    },
    netCost: netCostOf(positions),
    baseline,
    entryResolution: entry.resolution,
    entryQuality: entryQualityOf(entry.resolution, entry.window, record.plan, baseline),
    legFulfillment: legFulfillmentOf(record.plan, facts, deviations, opens),
    deviations,
    findings: [...(agreement.kind === 'Agrees' ? [] : [agreement]), ...deviationFindings(deviations, record.recordedDeviations ?? [])],
    ...(input.candidate &&
      before && {
        reconciliation: {
          candidateDigest: input.candidate.digest,
          ...(expectedLifecycle === 'Closed'
            ? { expectedLifecycle, terminalPositionChangeId: terminalPositionChangeOf(record.positionChanges)!.factId }
            : { expectedLifecycle, terminalPositionChangeId: null }),
          exposureStart: facts[0]?.economicTime ?? null,
          closeRequirement: closeRequirementOf(record, steps, closed),
          deviationActions: deviationActions(deviations, input.candidate.before.recordedDeviations ?? []),
          repairs: before.findings,
          effects: changeEffects(before, expectedLifecycle, deviations),
        },
      }),
  };
}
