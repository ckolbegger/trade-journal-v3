import { instrumentKey, type Instrument } from '../../domain/instrument/index.ts';
import {
  derive,
  evaluate,
  type ExpirationPayoffs,
  type TradeEvaluationInput,
  type AtEntryFigures,
  type CalculationResult,
  type ConditionStatus,
  type DerivedTradeState,
  type EntryQuality,
  type EntryResolution,
  type IncoherentFact,
  type InstrumentPosition,
  type IntegrityFinding,
  type NotApplicableReason,
  type LegFulfillment,
  type LifecycleAgreement,
  type LotMatch,
  type LotMatchResult,
  type PositionChangeFact,
  type TradeEvaluation,
  type RecordedDeviation,
  type LifecycleState,
  type PlanBaseline,
  type TradeAnalysisRecord,
} from '../../domain/trade-analysis/index.ts';
import { classifyDue, type DueClassification, type SessionCloses } from '../../domain/journal-debt/index.ts';
import { closedLongStockSummary, openLongStockSummary, optionSummary, plannedTradeSummary, type TradeSummary } from '../../domain/trade-summary.ts';
import type { Clock } from '../../domain/time/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { Journal, NarrativeDebt, NarrativeEntry, NarrativeItem, TradeNarrativeItem } from '../../modules/journal/index.ts';
import type { MarkFrame, MarketData, MarkResolution } from '../../modules/market-data/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { BrowseRecord, TradeRecord, TradeSummary as RecordSummary } from '../../modules/trade-record/index.ts';
import type { Persistence, WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { payoffOf, settlementTimeOf, type SettlementItem } from '../settlement.ts';
import { datedCloseOf, datedLineOf, observationFrame, type DatedLine } from '../valuation.ts';

export interface TradeViewsDeps {
  readonly persistence: Persistence;
  readonly tradeRecord: TradeRecord;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly marketData: MarketData;
  readonly clock: Clock;
}

export interface TradeBrowseRequest<L extends 'Planned' | 'Open' | 'Closed' = 'Planned' | 'Open'> {
  readonly lifecycle: L;
  readonly cursor?: string;
}

export const BROWSE_PAGE_SIZE = 50;

// Moved to the domain beside plannedLongStockSummary; still reached through this module.
export type { TradeSummary };

// One Planned Trade as the list presents it.
export interface PlannedTradeItem {
  readonly tradeId: string;
  readonly underlying: string;
  readonly strategy: string;
  readonly account: string;
  readonly institution: string;
  readonly planTime: string;
  readonly oneR: Rational;
  readonly originalPlannedReward: Rational;
  readonly rewardRiskRatio: Rational;
  // The planned quantity at the intended entry.
  readonly summary: TradeSummary;
  // Recording an entry arrives in D2 (D1 A16).
  readonly entryReadiness: 'Awaiting entry';
  // Present only when stored and expected records disagree (AC-LIFE-003), so an agreeing item keeps
  // D1's shape exactly.
  readonly integrity?: 'Disagrees';
}

// The Open list item's figures at the Expected Mark Date, each with its own availability (A41).
export interface OpenCurrentFigures {
  // Absent outside session-policy coverage, where there is no Expected Mark Date (decision 54).
  readonly expectedMarkDate?: string;
  readonly markResolution?: MarkResolution;
  readonly remainingOpenPnl: CalculationResult<Rational>;
  readonly currentMarkedPnl: CalculationResult<Rational>;
  readonly currentMarkedPnlInPlanR: CalculationResult<Rational>;
  readonly ongoingRiskToStop: CalculationResult<Rational>;
  readonly ongoingRiskToStopInPlanR: CalculationResult<Rational>;
  readonly worstCaseOngoingRisk: CalculationResult<Rational>;
  readonly worstCaseOngoingRiskInPlanR: CalculationResult<Rational>;
  readonly incrementalRewardToTarget: CalculationResult<Rational>;
  readonly incrementalRewardToTargetInPlanR: CalculationResult<Rational>;
  readonly maximumIncrementalReward: CalculationResult<Rational>;
  // Stop and Target status, each condition its own result.
  readonly conditions: readonly ConditionStatus[];
  // Lots opened after the latest exact Mark's close, measured from their execution prices (P12, A54).
  readonly atEntry: AtEntryFigures | null;
  // The Position held at the last close with an exact Mark, valued with that Mark; absent when none applies.
  readonly datedLine?: DatedLine;
}

// One Open Trade as the list presents it (D2 A32): factual Position and entry figures, with the
// current evaluation at the Expected Mark Date (D4).
export interface OpenTradeItem {
  readonly tradeId: string;
  readonly underlying: string;
  readonly strategy: string;
  readonly account: string;
  readonly institution: string;
  // Shown as "60 of 100".
  readonly openQuantity: Rational;
  readonly plannedQuantity: Rational;
  // Quantity-weighted Open Lot price, fees excluded.
  readonly averageOpenCost: CalculationResult<Rational, never, Extract<NotApplicableReason, { reason: 'NoRemainingPosition' }>>;
  // The open quantity at the average open cost; absent with no open quantity.
  readonly summary?: TradeSummary;
  // Signed cost of the open exposure, opening fees included (Trade Analysis).
  readonly netCost: DerivedTradeState['netCost'];
  readonly incurredFees: Rational;
  readonly entryStatus: 'Entering' | 'Resolved';
  // Active recorded Deviation occurrences.
  readonly deviationCount: number;
  // Whether stored and expected records agree; a disagreement is surfaced, never repaired.
  readonly integrity: 'Agrees' | 'Disagrees';
  readonly lastActivity: string;
  readonly current: OpenCurrentFigures;
  // The option contracts due for settlement, as Detail has them (A111); empty for stock and before the settlement time.
  readonly settlement: readonly SettlementItem[];
}

// An Open Trade whose recorded facts cannot be replayed (AC-LIFE-003): its Position and entry figures
// are unavailable rather than shown as numbers, and its records disagree.
export interface IncoherentOpenTradeItem extends Omit<
  OpenTradeItem,
  'openQuantity' | 'averageOpenCost' | 'summary' | 'netCost' | 'incurredFees' | 'entryStatus' | 'integrity' | 'current' | 'settlement'
> {
  readonly integrity: 'Disagrees';
}

// A Planned Trade whose recorded facts cannot be replayed (AC-LIFE-003): only its stored values are
// listed; 1R, reward, Reward : risk, and entry readiness need a replay, so they are unavailable, and its
// records disagree.
export interface IncoherentPlannedTradeItem extends Omit<
  PlannedTradeItem,
  'oneR' | 'originalPlannedReward' | 'rewardRiskRatio' | 'summary' | 'entryReadiness' | 'integrity'
> {
  readonly integrity: 'Disagrees';
}

// A Close Reason as the Catalog labels it now; an identity the Catalog cannot resolve keeps a blank label.
export interface CloseReasonLabel {
  readonly id: string;
  readonly label: string;
}

// One Closed Trade as the list presents it (A95): its final figures from the facts alone, no Market Data.
export interface ClosedTradeItem {
  readonly tradeId: string;
  readonly underlying: string;
  readonly strategy: string;
  readonly account: string;
  readonly institution: string;
  // What was traded: the entered quantity at its average entry price (decision 48); absent without a replay.
  readonly summary?: TradeSummary;
  // Net of every fee (A80), a BigInt rational.
  readonly netRealizedPnl: Rational;
  readonly realizedR: DerivedTradeState['realizedR'];
  // How the exposure ended, never the Close Reason (A84).
  readonly terminalDisposition: DerivedTradeState['terminalDisposition'];
  // How a Closed option Trade's contracts were disposed (A108, A119); absent for stock.
  readonly optionDispositionTiming?: DerivedTradeState['optionDispositionTiming'];
  // Absent when the Trade carries none.
  readonly closeReason?: CloseReasonLabel;
  // The terminal Position Change's Economic Time.
  readonly terminalTime: string;
  // Active recorded Deviation occurrences.
  readonly deviationCount: number;
  // Whether any reflection (an exit's or the Close Review) is an Outstanding Debt.
  readonly reflectionOwed: boolean;
  // Whether stored and expected records agree; a disagreement is surfaced, never repaired.
  readonly integrity: 'Agrees' | 'Disagrees';
}

// A Closed Trade whose recorded facts cannot be replayed (AC-LIFE-003): its realized figures are unavailable
// rather than shown as numbers, and its records disagree.
export interface IncoherentClosedTradeItem extends Omit<ClosedTradeItem, 'summary' | 'netRealizedPnl' | 'realizedR' | 'terminalDisposition' | 'integrity'> {
  readonly integrity: 'Disagrees';
}

export type TradeBrowseItem<L extends 'Planned' | 'Open' | 'Closed'> = L extends 'Open'
  ? OpenTradeItem | IncoherentOpenTradeItem
  : L extends 'Closed'
    ? ClosedTradeItem | IncoherentClosedTradeItem
    : PlannedTradeItem | IncoherentPlannedTradeItem;

export interface TradeBrowseView<L extends 'Planned' | 'Open' | 'Closed'> {
  readonly items: readonly TradeBrowseItem<L>[];
  readonly nextCursor?: string;
}

// The revisions one coherent view represents.
export interface ViewBinding {
  readonly workspace: WorkspaceSnapshotBinding;
  readonly catalogRevision: number;
  readonly journalRevision: number;
  // The Mark evidence a current evaluation read, bound with the Workspace content revision it was read in.
  readonly marketDataSnapshotId?: string;
}

export type ReadViewResult<T> =
  | { readonly kind: 'Ready'; readonly view: T; readonly binding: ViewBinding }
  // A commit kept racing the assembly; nothing incoherent is returned.
  | { readonly kind: 'ChangedDuringAssembly' }
  | { readonly kind: 'NotFound' }
  | { readonly kind: 'Rejected'; readonly reason: 'CursorExpired' };

const ASSEMBLY_ATTEMPTS = 3;

export interface TradeDetailRequest {
  readonly tradeId: string;
}

export interface PlannedTradeDetail {
  readonly tradeId: string;
  readonly factRevision: number;
  readonly plan: {
    readonly underlying: string;
    readonly planTime: string;
    readonly thesis: string;
    readonly invalidation: string;
    // A long option Plan's Exercise Intent (A100); absent for stock and the Cash-Secured Put.
    readonly exerciseIntent?: 'Authorized' | 'NotAuthorized';
    readonly legs: TradeAnalysisRecord['plan']['legs'];
    readonly stops: TradeAnalysisRecord['plan']['stops'];
    readonly targets: TradeAnalysisRecord['plan']['targets'];
  };
  // Stored Lifecycle State and its independently derived agreement, shown as separate concepts.
  readonly lifecycle: { readonly stored: LifecycleState; readonly agreement: LifecycleAgreement };
  readonly baseline: PlanBaseline;
  // The Planned and Current Expiration Payoff views, apart from every Mark-dependent figure; NotApplicable for stock (AC-CALC-004).
  readonly payoff: ExpirationPayoffs;
  // The planned quantity at the intended entry (Planned form) or the open Position (Open form).
  readonly summary?: TradeSummary;
  readonly labels: { readonly strategy: string; readonly account: string; readonly institution: string };
  readonly journal: readonly NarrativeEntry[];
}

// The Mark that valued the figures and where it came from (Market Data, "Observation model").
export interface MarkProvenance {
  readonly source: 'Manual';
  readonly revisionId: string;
  readonly revisionNumber: number;
  readonly price: string;
  readonly savedAt: string;
  // The reason given when this revision corrected an earlier one.
  readonly correctionReason?: string;
}

// The Open Detail's valuation at the Expected Mark Date: the evaluation in full, with the Mark's
// provenance and the dated line when the current figures need one (P12, P13).
export interface OpenCurrentEvaluation {
  // Absent outside session-policy coverage, where there is no Expected Mark Date (decision 54).
  readonly expectedMarkDate?: string;
  readonly markResolution?: MarkResolution;
  // Present when an exact Mark valued the figures.
  readonly mark?: MarkProvenance;
  // An option Trade's Underlying Mark, when one is exact (row 23.18).
  readonly underlyingMark?: MarkProvenance;
  // Per Instrument; a Long Stock Trade has one.
  readonly coverage: readonly { readonly instrument: TradeEvaluation['observation']['instrument']; readonly coverage: TradeEvaluation['coverage'] }[];
  readonly evaluation: TradeEvaluation;
  readonly datedLine?: DatedLine;
}

// An Outstanding Debt in the narrative: "Reflection owed" beside its Position Change, with its snapshot
// revision (the NarrativeDebt revision and definition). Without a due status outside session-policy
// coverage, where there is no Expected Mark Date (decision 56).
export interface TradeDetailDebt extends NarrativeDebt {
  readonly dueStatus?: DueClassification;
}

export type TradeDetailNarrativeItem = NarrativeItem | TradeDetailDebt;

// A derived Lot Match with its Calculation Results (A78, A80): exact rationals, which the display rounds to cents.
export type LotMatchView = LotMatch & Pick<LotMatchResult, 'disposedAt' | 'allocatedOpeningFee' | 'allocatedDisposalFee' | 'realized'>;

// How the Trade's fees reconcile (A80). Incurred fees are the plain sum of the Execution fees; each opening fee is
// allocated to Lot Matches in proportion to matched quantity, and the unconsumed remainder stays on the Open Lots;
// each disposal fee is allocated across its Execution's Lot Matches. Nothing is subtracted twice:
// allocatedOpening + unconsumedOpening = incurredOpening, and allocatedDisposal = incurredDisposal.
export interface FeeReconciliation {
  readonly incurred: Rational;
  readonly incurredOpening: Rational;
  readonly incurredDisposal: Rational;
  readonly allocatedOpening: Rational;
  readonly allocatedDisposal: Rational;
  readonly unconsumedOpening: Rational;
}

// The Open form of Trade Detail (D2): the Planned form's Plan, lifecycle, Baseline, and labels, plus
// the derived Position and entry, the recorded Deviations, any integrity findings, and the whole
// narrative with declines. D6 adds the Lot Matches, realized-to-date, and the fee reconciliation; the
// valuation includes realized-to-date (D4, A92).
export interface OpenTradeDetail extends Omit<PlannedTradeDetail, 'journal'> {
  // Signed net quantity and Open Lots per Instrument; each Lot carries its unconsumed opening fee.
  readonly positions: readonly InstrumentPosition[];
  readonly lotMatches: readonly LotMatchView[];
  // The sum of the Lot Matches' realized amounts, independent of any Mark (A92).
  readonly realizedToDate: Rational;
  readonly feeReconciliation: FeeReconciliation;
  readonly fees: DerivedTradeState['fees'];
  readonly netCost: DerivedTradeState['netCost'];
  // The latest activity on the Trade, as its Open list item carries it (it orders that list).
  readonly lastActivity: string;
  // The option contracts still held at or past expiration, each with the settlement time (A111); empty for stock
  // and before the expiration date.
  readonly settlement: readonly SettlementItem[];
  // Position Changes, and the Executions within each, in Fact Order.
  readonly positionChanges: readonly PositionChangeFact[];
  readonly entryStatus: 'Entering' | 'Resolved';
  readonly entryResolution: EntryResolution;
  readonly entryQuality: EntryQuality;
  readonly legFulfillment: readonly LegFulfillment[];
  // The recorded occurrences, authoritative in Trade Record, with every version.
  readonly deviations: readonly RecordedDeviation[];
  // Where stored records disagree with what the facts imply: surfaced, never repaired (AC-LIFE-003).
  readonly findings: readonly IntegrityFinding[];
  readonly journal: readonly TradeDetailNarrativeItem[];
  readonly current: OpenCurrentEvaluation;
}

// The Closed form's valuation: the evaluation and its coverage only. A Closed Trade has no current figures
// (A92), so there is no Expected Mark Date, Mark resolution, Mark, or dated line, and every figure that
// depends on a Mark is NotApplicable(NoRemainingPosition). The evaluation is dated at the terminal time and
// its `coverage` is not meaningful.
export interface ClosedCurrentEvaluation extends Pick<OpenCurrentEvaluation, 'coverage' | 'evaluation'> {
  // Declared so a reader of either form of `current` can name them; a Closed Detail never has them.
  readonly expectedMarkDate?: never;
  readonly markResolution?: never;
  readonly mark?: never;
  readonly datedLine?: never;
}

// The Closed form of Trade Detail (D6): the Open form's Plan, lifecycle, Position Changes, Lot Matches, fee
// reconciliation, entry record, and narrative (the Close Review among it), plus how the exposure ended (Terminal
// Disposition) apart from why the trader closed (Close Reason), the terminal time, and Realized R. Its
// `realizedToDate` is the net realized P&L. It is built from the facts alone and reads no Mark (A92); its
// `positions` holds no Open Lot.
export interface ClosedTradeDetail extends OpenTradeDetail {
  readonly current: ClosedCurrentEvaluation;
  readonly terminalDisposition: DerivedTradeState['terminalDisposition'];
  // How a Closed option Trade's contracts were disposed, with both quantities (A108, A119); absent for stock.
  readonly optionDispositionTiming?: DerivedTradeState['optionDispositionTiming'];
  readonly closeReason?: CloseReasonLabel;
  // The terminal Position Change's Economic Time.
  readonly terminalTime: string;
  readonly realizedR: DerivedTradeState['realizedR'];
}

// The Detail of a Trade whose recorded facts cannot be replayed (AC-LIFE-003): its Plan, stored
// lifecycle, labels, recorded Position Changes, recorded Deviations, and narrative, with the findings.
// Nothing is derived, so it has no Baseline, lifecycle agreement, Position, entry, or fulfillment.
export interface IncoherentTradeDetail extends Omit<PlannedTradeDetail, 'journal' | 'lifecycle' | 'baseline' | 'payoff'> {
  readonly lifecycle: { readonly stored: LifecycleState };
  // As stored: without a replay there is no Fact Order.
  readonly recordedPositionChanges: readonly PositionChangeFact[];
  readonly deviations: readonly RecordedDeviation[];
  // Each finding describes itself (P69), as `derive` returns it (AC-LIFE-003).
  readonly findings: readonly IncoherentFact[];
  // Debt is listed without a due status: the facts cannot be replayed, so no Expected Mark Date is resolved.
  readonly journal: readonly TradeDetailNarrativeItem[];
}

export type TradeDetailView = PlannedTradeDetail | OpenTradeDetail | ClosedTradeDetail | IncoherentTradeDetail;

export interface TradeViews {
  // Generic in the lifecycle, so each caller receives its lifecycle's item form, and a caller
  // holding either lifecycle (a tab switch) receives the union.
  browseTrades<L extends 'Planned' | 'Open' | 'Closed'>(request: TradeBrowseRequest<L>): Promise<ReadViewResult<TradeBrowseView<L>>>;
  getTradeDetail(request: TradeDetailRequest): Promise<ReadViewResult<TradeDetailView>>;
}

// A narrative Entry in D1's Detail shape: the item kind is the narrative's discriminator only.
function withoutKind(item: Extract<NarrativeItem, { kind: 'Entry' }>): NarrativeEntry {
  const entry: Record<string, unknown> = { ...item };
  delete entry['kind'];
  return entry as unknown as NarrativeEntry;
}

type Labels = { readonly strategy: string; readonly account: string; readonly institution: string };

function plannedItem(summary: RecordSummary, analysis: TradeAnalysisRecord, derived: DerivedTradeState, labels: Labels): PlannedTradeItem {
  const { baseline } = derived;
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    planTime: summary.planTime,
    oneR: baseline.oneR,
    originalPlannedReward: baseline.originalPlannedReward,
    rewardRiskRatio: baseline.rewardRiskRatio,
    summary: plannedSummaryOf(analysis),
    entryReadiness: 'Awaiting entry',
    ...(derived.findings.length > 0 && { integrity: 'Disagrees' as const }),
  };
}

function incoherentPlannedItem(summary: RecordSummary, labels: Labels): IncoherentPlannedTradeItem {
  return { tradeId: summary.tradeId, underlying: summary.underlying, ...labels, planTime: summary.planTime, integrity: 'Disagrees' };
}

function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`not a decimal: ${text}`);
  return parsed.value;
}

const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), Rational.of(0n));

// Active recorded Deviation occurrences.
const activeDeviations = (analysis: TradeAnalysisRecord) =>
  (analysis.recordedDeviations ?? []).filter((d) => d.versions.at(-1)?.status === 'Active').length;

// Entering until the Entry Resolution Point, then Resolved (D2 A23).
const entryStatusOf = (derived: DerivedTradeState) => (derived.entryResolution.kind === 'Resolved' ? 'Resolved' : 'Entering');

const optional = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : ({ [key]: value } as Record<K, V>));

// What the Trade holds, by the contract its Plan names: Long Stock, or an option's direction and contracts.
const optionContractOf = (analysis: TradeAnalysisRecord) => {
  const instrument = analysis.plan.legs[0]!.instrument;
  return instrument.kind === 'Option' ? instrument : undefined;
};
const magnitude = (value: Rational) => (value.compare(Rational.of(0n)) < 0 ? Rational.of(0n).sub(value) : value);

const plannedSummaryOf = (analysis: TradeAnalysisRecord): TradeSummary => plannedTradeSummary(analysis.plan.legs);

// The contracts still open, long or short by their sign; none when flat.
function openSummaryOf(analysis: TradeAnalysisRecord, derived: DerivedTradeState): TradeSummary | undefined {
  const contract = optionContractOf(analysis);
  if (!contract) return openLongStockSummary(derived);
  const held = sum(derived.positions.flatMap((p) => p.openLots.map((lot) => lot.quantity)));
  return held.compare(Rational.of(0n)) === 0 ? undefined : optionSummary(contract, held.compare(Rational.of(0n)) < 0 ? 'Short' : 'Long', magnitude(held));
}

// The contracts entered by opening Executions, once none is open (decision 48); none without an opening Execution.
function closedSummaryOf(analysis: TradeAnalysisRecord, derived: DerivedTradeState): TradeSummary | undefined {
  const contract = optionContractOf(analysis);
  if (!contract) return closedLongStockSummary(derived);
  const side = analysis.plan.legs[0]!.side;
  const entered = sum(derived.facts.filter((fact) => fact.action === (side === 'Long' ? 'Buy' : 'Sell')).map((fact) => decimal(fact.quantity)));
  return entered.compare(Rational.of(0n)) === 0 ? undefined : optionSummary(contract, side, entered);
}

// The current frame of an Instrument, or the as-of date when it lies outside session-policy coverage.
type CurrentFrame = MarkFrame | { readonly date: string; readonly instrumentKey: string };

// The Instruments a Trade's current figures need: an option's own contract and its Underlying (A110), otherwise the Underlying.
const instrumentsOf = (analysis: TradeAnalysisRecord): string[] => {
  const contract = analysis.plan.legs[0]!.instrument;
  return contract.kind === 'Option' ? [instrumentKey(contract), analysis.plan.underlying] : [analysis.plan.underlying];
};

// The frame of the Instrument whose Mark values the Trade: the contract for an option, the Underlying for stock.
const primaryFrameOf = (frames: readonly CurrentFrame[], analysis: TradeAnalysisRecord): CurrentFrame => {
  const key = instrumentsOf(analysis)[0]!;
  const found = frames.find((f) => f.instrumentKey === key);
  if (!found) throw new Error(`Market Data returned no frame for ${key}`);
  return found;
};

// The Trade evaluated at the frames of its Instruments; an option's contract is the frame and its Underlying the underlyingFrame.
function evaluateCurrent(derived: DerivedTradeState, analysis: TradeAnalysisRecord, frames: readonly CurrentFrame[]): TradeEvaluation {
  const contract = analysis.plan.legs[0]!.instrument;
  const observation = (instrument: Instrument): TradeEvaluationInput['frame'] => {
    const found = frames.find((f) => f.instrumentKey === instrumentKey(instrument));
    if (!found) throw new Error(`Market Data returned no frame for ${instrumentKey(instrument)}`);
    return 'resolution' in found ? observationFrame(found) : { instrument, date: found.date };
  };
  return evaluate({
    state: derived,
    frame: observation(contract),
    ...(contract.kind === 'Option' && { underlyingFrame: observation({ kind: 'Stock', symbol: analysis.plan.underlying }) }),
  });
}

function openItem(summary: RecordSummary, analysis: TradeAnalysisRecord, derived: DerivedTradeState, labels: Labels, frames: readonly CurrentFrame[], evaluation: TradeEvaluation, settlement: readonly SettlementItem[], datedLine: DatedLine | undefined): OpenTradeItem {
  const frame = primaryFrameOf(frames, analysis);
  // The signed open quantity at the quantity-weighted Open Lot price.
  const lots = derived.positions.flatMap((p) => p.openLots);
  const openQuantity = sum(lots.map((lot) => lot.quantity));
  const held = openQuantity.compare(Rational.of(0n)) !== 0;
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    openQuantity,
    plannedQuantity: sum(analysis.plan.legs.map((l) => decimal(l.quantity))),
    averageOpenCost: held ? { kind: 'Value', value: sum(lots.map((lot) => lot.quantity.mul(lot.price))).div(openQuantity) } : { kind: 'NotApplicable', reason: 'NoRemainingPosition' },
    ...optional('summary', openSummaryOf(analysis, derived)),
    netCost: derived.netCost,
    incurredFees: derived.fees.incurredOpening,
    entryStatus: entryStatusOf(derived),
    deviationCount: activeDeviations(analysis),
    integrity: derived.findings.length === 0 ? 'Agrees' : 'Disagrees',
    lastActivity: summary.lastActivity ?? summary.planTime,
    current: {
      ...('resolution' in frame && { expectedMarkDate: frame.tradingDate, markResolution: frame.resolution }),
      remainingOpenPnl: evaluation.remainingOpenPnl,
      currentMarkedPnl: evaluation.currentMarkedPnl,
      currentMarkedPnlInPlanR: evaluation.currentMarkedPnlInPlanR,
      ongoingRiskToStop: evaluation.ongoingRiskToStop,
      ongoingRiskToStopInPlanR: evaluation.ongoingRiskToStopInPlanR,
      worstCaseOngoingRisk: evaluation.worstCaseOngoingRisk,
      worstCaseOngoingRiskInPlanR: evaluation.worstCaseOngoingRiskInPlanR,
      incrementalRewardToTarget: evaluation.incrementalRewardToTarget,
      incrementalRewardToTargetInPlanR: evaluation.incrementalRewardToTargetInPlanR,
      maximumIncrementalReward: evaluation.maximumIncrementalReward,
      conditions: evaluation.conditions,
      atEntry: evaluation.atEntry,
      ...optional('datedLine', datedLine),
    },
    settlement,
  };
}

function incoherentItem(summary: RecordSummary, analysis: TradeAnalysisRecord, labels: Labels): IncoherentOpenTradeItem {
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    plannedQuantity: sum(analysis.plan.legs.map((l) => decimal(l.quantity))),
    deviationCount: activeDeviations(analysis),
    integrity: 'Disagrees',
    lastActivity: summary.lastActivity ?? summary.planTime,
  };
}

// The terminal time of a Closed Trade: derived from its facts, else the stored key the Closed index holds it by.
function terminalTimeOf(analysis: TradeAnalysisRecord, derived: DerivedTradeState | undefined): string {
  const terminalTime = derived?.terminalTime ?? analysis.terminalTime;
  if (terminalTime === undefined || terminalTime === null) throw new Error(`Closed Trade ${analysis.tradeId} has no terminal time`);
  return terminalTime;
}

function closedItem(summary: RecordSummary, analysis: TradeAnalysisRecord, derived: DerivedTradeState, labels: Labels, closeReason: CloseReasonLabel | undefined, reflectionOwed: boolean): ClosedTradeItem {
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    ...optional('summary', closedSummaryOf(analysis, derived)),
    netRealizedPnl: derived.realizedToDate,
    realizedR: derived.realizedR,
    terminalDisposition: derived.terminalDisposition,
    ...optionTimingOf(analysis, derived),
    ...optional('closeReason', closeReason),
    terminalTime: terminalTimeOf(analysis, derived),
    deviationCount: activeDeviations(analysis),
    reflectionOwed,
    integrity: derived.findings.length === 0 ? 'Agrees' : 'Disagrees',
  };
}

function incoherentClosedItem(summary: RecordSummary, analysis: TradeAnalysisRecord, labels: Labels, closeReason: CloseReasonLabel | undefined, reflectionOwed: boolean): IncoherentClosedTradeItem {
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    ...optional('closeReason', closeReason),
    terminalTime: terminalTimeOf(analysis, undefined),
    deviationCount: activeDeviations(analysis),
    reflectionOwed,
    integrity: 'Disagrees',
  };
}

// Position Changes and their Executions in the Fact Order Trade Analysis replayed them in.
function inFactOrder(analysis: TradeAnalysisRecord, derived: DerivedTradeState): PositionChangeFact[] {
  const rank = new Map(derived.facts.map((fact, i) => [fact.factId, i]));
  const byRank = (a: { factId: string }, b: { factId: string }) => (rank.get(a.factId) ?? 0) - (rank.get(b.factId) ?? 0);
  const first = (pc: PositionChangeFact) => Math.min(...pc.executions.map((e) => rank.get(e.factId) ?? 0));
  return [...analysis.positionChanges]
    .sort((a, b) => first(a) - first(b))
    .map((pc) => ({ ...pc, executions: [...pc.executions].sort(byRank) }));
}

// The closes around the Expected Mark Date, as its frame carries them (A75); none outside session-policy coverage.
const closesOf = (frame: CurrentFrame): SessionCloses | undefined =>
  'resolution' in frame ? { previousClose: frame.previousCloseInstant, close: frame.closeInstant } : undefined;

// Each Outstanding Debt's due status against the Expected Mark Date E (A69): Due when its anchor is at
// or before the close of the session before E, in the next Review when it is at or before E's close,
// otherwise in the Review after next. Both closes come from the frame (A75). Without closes (outside
// session-policy coverage, or when Market Data has none to give) a Debt carries no status (decision 56).
function withDueStatus(narrative: readonly TradeNarrativeItem[], closes: SessionCloses | undefined): TradeDetailNarrativeItem[] {
  return narrative.map((item): TradeDetailNarrativeItem => {
    if (item.kind !== 'Debt') return item;
    const dueStatus = classifyDue(item.dueAnchor, closes);
    return dueStatus === undefined ? item : { ...item, dueStatus };
  });
}

// Each Lot Match joined to its results, which Trade Analysis returns in the same order (A81).
export const lotMatchViews = (derived: DerivedTradeState): LotMatchView[] =>
  derived.lotMatches.map((match, i) => {
    const { disposedAt, allocatedOpeningFee, allocatedDisposalFee, realized } = derived.lotMatchResults[i]!;
    return { ...match, disposedAt, allocatedOpeningFee, allocatedDisposalFee, realized };
  });

// The allocated fees are Values for every Long Stock Lot Match (A80).
const allocated = (results: readonly CalculationResult<Rational>[]) => sum(results.flatMap((r) => (r.kind === 'Value' ? [r.value] : [])));

export function feeReconciliationOf(derived: DerivedTradeState): FeeReconciliation {
  return {
    incurred: derived.fees.incurred,
    incurredOpening: derived.fees.incurredOpening,
    incurredDisposal: derived.fees.incurred.sub(derived.fees.incurredOpening),
    allocatedOpening: allocated(derived.lotMatchResults.map((r) => r.allocatedOpeningFee)),
    allocatedDisposal: allocated(derived.lotMatchResults.map((r) => r.allocatedDisposalFee)),
    unconsumedOpening: sum(derived.positions.flatMap((p) => p.openLots.map((lot) => lot.unconsumedOpeningFee))),
  };
}

// Option Disposition Timing belongs to option Trades; a stock Trade carries none.
const optionTimingOf = (analysis: TradeAnalysisRecord, derived: DerivedTradeState) =>
  analysis.plan.legs[0]!.instrument.kind === 'Option' ? { optionDispositionTiming: derived.optionDispositionTiming } : {};

// A Closed Trade holds no Lot, so every Mark-dependent figure is NotApplicable(NoRemainingPosition) whatever the date:
// it is evaluated at its terminal date, with no frame and no Mark (A92).
function closedCurrent(analysis: TradeAnalysisRecord, derived: DerivedTradeState): ClosedCurrentEvaluation {
  const date = terminalTimeOf(analysis, derived).slice(0, 10);
  const evaluation = evaluateCurrent(derived, analysis, instrumentsOf(analysis).map((instrumentKey) => ({ date, instrumentKey })));
  return { coverage: [{ instrument: evaluation.observation.instrument, coverage: evaluation.coverage }], evaluation };
}

function closedDetail(open: Omit<OpenTradeDetail, 'current'>, current: ClosedCurrentEvaluation, analysis: TradeAnalysisRecord, derived: DerivedTradeState, closeReason: CloseReasonLabel | undefined): ClosedTradeDetail {
  return {
    ...open,
    // The entered quantity, since no Lot is open (decision 48).
    ...optional('summary', closedSummaryOf(analysis, derived)),
    current,
    terminalDisposition: derived.terminalDisposition,
    ...optionTimingOf(analysis, derived),
    ...optional('closeReason', closeReason),
    terminalTime: terminalTimeOf(analysis, derived),
    realizedR: derived.realizedR,
  };
}

// The Open form without its valuation, which the Open and Closed forms each supply.
function detailWithoutValuation(
  planned: Omit<PlannedTradeDetail, 'journal'>,
  analysis: TradeAnalysisRecord,
  derived: DerivedTradeState,
  narrative: readonly TradeDetailNarrativeItem[],
  lastActivity: string,
  settlement: readonly SettlementItem[],
): Omit<OpenTradeDetail, 'current'> {
  return {
    ...planned,
    settlement,
    positions: derived.positions,
    lotMatches: lotMatchViews(derived),
    realizedToDate: derived.realizedToDate,
    feeReconciliation: feeReconciliationOf(derived),
    ...optional('summary', openSummaryOf(analysis, derived)),
    netCost: derived.netCost,
    lastActivity,
    fees: derived.fees,
    positionChanges: inFactOrder(analysis, derived),
    entryStatus: entryStatusOf(derived),
    entryResolution: derived.entryResolution,
    entryQuality: derived.entryQuality,
    legFulfillment: derived.legFulfillment,
    deviations: analysis.recordedDeviations ?? [],
    findings: derived.findings,
    journal: narrative,
  };
}

export function createTradeViews(deps: TradeViewsDeps): TradeViews {
  // The current Workspace binding with the Catalog and Journal revisions, from one snapshot.
  async function currentBinding(): Promise<ViewBinding> {
    const { value, binding } = await deps.persistence.readSnapshot(['meta'], async (tx) => ({
      catalog: (await tx.get('meta', 'catalog')) as { catalogRevision: number } | undefined,
      journal: (await tx.get('meta', 'journal')) as { journalRevision: number } | undefined,
    }));
    return {
      workspace: binding,
      catalogRevision: value.catalog?.catalogRevision ?? 0,
      journalRevision: value.journal?.journalRevision ?? 0,
    };
  }

  // The frames at the Expected Mark Date for the current instant, one per Instrument.
  // Outside session-policy coverage there are no frames, only the as-of exchange date.
  async function currentFrames(keys: readonly string[]): Promise<{ readonly frames: readonly CurrentFrame[]; readonly snapshotId?: string }> {
    if (keys.length === 0) return { frames: [] };
    const instruments = [...new Set(keys)].sort();
    const asOf = deps.clock.now();
    const result = await deps.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Current', asOf }, instruments });
    const uncovered = result.kind === 'Rejected' ? result.issues.find((issue) => issue.code === 'SessionPolicyCoverage') : undefined;
    const date = uncovered?.date;
    if (date !== undefined) return { frames: instruments.map((instrumentKey) => ({ date, instrumentKey })) };
    if (result.kind !== 'Frames') throw new Error(`Market Data returned ${result.kind} for the current frames`);
    return { frames: result.frames, snapshotId: result.snapshotId };
  }

  // The dated close line (D4's mechanism): a stock's from its own frame, an option's from the contract's frame and the
  // Underlying's frame at that same dated close, whatever the Underlying's state on the frame date (A110).
  async function datedLineOfTrade(analysis: TradeAnalysisRecord, frames: readonly CurrentFrame[], frame: CurrentFrame, evaluation: TradeEvaluation): Promise<DatedLine | undefined> {
    if (!('resolution' in frame)) return undefined;
    if (analysis.plan.legs[0]!.instrument.kind === 'Stock') return datedLineOf(analysis, frame, evaluation);
    const tradingDate = datedCloseOf(frame, evaluation);
    if (tradingDate === undefined) return undefined;
    const current = frames.find((f): f is MarkFrame => f.instrumentKey === analysis.plan.underlying && 'resolution' in f && f.tradingDate === tradingDate);
    if (current) return datedLineOf(analysis, frame, evaluation, current);
    const result = await deps.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Historical', tradingDate }, instruments: [analysis.plan.underlying] });
    if (result.kind !== 'Frames') throw new Error(`Market Data returned ${result.kind} for the Underlying's frame at the dated close`);
    return datedLineOf(analysis, frame, evaluation, result.frames[0]);
  }

  // The closes around the Expected Mark Date, for the due status of a Closed Trade's Debt. Market Data gives them
  // on the Instrument's frame; the frame's Mark is not read. Anything but frames, coverage rejections included,
  // leaves no closes, and the Debt carries no status (decision 56): a Closed Detail does not depend on Market Data.
  async function sessionCloses(symbol: string): Promise<SessionCloses | undefined> {
    const result = await deps.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Current', asOf: deps.clock.now() }, instruments: [symbol] });
    const frame = result.kind === 'Frames' ? result.frames[0] : undefined;
    return frame && closesOf(frame);
  }

  // The contracts the evaluation finds Due, each with its settlement time from Market Data (A111).
  async function settlementItemsOf(tradeId: string, evaluation: TradeEvaluation): Promise<SettlementItem[]> {
    const due = evaluation.settlement.filter((item) => item.status === 'Due');
    return Promise.all(due.map(async ({ instrument, quantity, expiration }) => ({ tradeId, instrument, quantity, expiration, settlementTime: await settlementTimeOf(deps.marketData, instrument, expiration) })));
  }

  // The effective Mark revision's provenance, as Market Data describes it on the frame.
  function markProvenance(frame: CurrentFrame): MarkProvenance | undefined {
    if (!('resolution' in frame) || frame.resolution.kind !== 'Available') return undefined;
    const { source, revisionId, revisionNumber, price, savedAt, correctionReason } = frame.resolution.mark;
    return { source, revisionId, revisionNumber, price, savedAt, ...(correctionReason !== undefined && { correctionReason }) };
  }

  // The Close Reason labels of the given Trades, each resolved in its own call so that an identity the Catalog
  // cannot resolve blanks no other label (T6.12-B1).
  async function closeReasonOf(id: string): Promise<CloseReasonLabel> {
    const found = await deps.catalog.resolve([{ name: 'closeReason', kind: 'CloseReason', id, mode: 'DisplayOnly' }]);
    return { id, label: found.kind === 'Resolved' ? (found.resolved['closeReason']?.label ?? '') : '' };
  }

  async function closeReasonsOf(analyses: readonly TradeAnalysisRecord[]): Promise<Map<string, CloseReasonLabel>> {
    const ids = [...new Set(analyses.flatMap((a) => (a.closeReason ? [a.closeReason.closeReasonId] : [])))];
    return new Map(await Promise.all(ids.map(async (id): Promise<[string, CloseReasonLabel]> => [id, await closeReasonOf(id)])));
  }

  // The Trades with any Outstanding Debt, from one read of the Debt index.
  async function tradesWithOutstandingDebt(): Promise<Set<string>> {
    const { debts } = await deps.journal.query({ scope: 'OutstandingDebt' });
    return new Set(debts.map((debt) => debt.anchor.tradeId));
  }

  // Module reads are separate transactions, so a view is accepted only if the Workspace binding
  // is unchanged across its assembly; otherwise it is retried, a bounded number of times.
  async function coherent<T>(
    assemble: () => Promise<{ view: T; binding: WorkspaceSnapshotBinding; marketDataSnapshotId?: string } | { rejected: 'CursorExpired' } | { notFound: true }>,
  ): Promise<ReadViewResult<T>> {
    for (let attempt = 0; attempt < ASSEMBLY_ATTEMPTS; attempt++) {
      const assembled = await assemble();
      if ('rejected' in assembled) return { kind: 'Rejected', reason: assembled.rejected };
      if ('notFound' in assembled) return { kind: 'NotFound' };
      const { view, binding, marketDataSnapshotId } = assembled;
      const after = await currentBinding();
      if (after.workspace.databaseName === binding.databaseName && after.workspace.contentRevision === binding.contentRevision) {
        return { kind: 'Ready', view, binding: { ...after, ...optional('marketDataSnapshotId', marketDataSnapshotId) } };
      }
    }
    return { kind: 'ChangedDuringAssembly' };
  }

  return {
    getTradeDetail(request) {
      return coherent<TradeDetailView>(async () => {
        // The binding is taken before any part is read, so a racing commit is always noticed.
        const { binding } = await deps.persistence.readSnapshot(['meta'], () => Promise.resolve(null));
        const summary = await deps.tradeRecord.getRecord({ tradeId: request.tradeId, projection: 'Summary' });
        const record = await deps.tradeRecord.getRecord({ tradeId: request.tradeId, projection: 'AnalysisInput' });
        if (summary.kind === 'NotFound' || record.kind === 'NotFound') return { notFound: true as const };
        const s = (summary as { projection: RecordSummary }).projection;
        const analysis = (record as { projection: TradeAnalysisRecord }).projection;
        const labels = await deps.catalog.resolve([
          { name: 'account', kind: 'Account', id: s.accountId, mode: 'DisplayOnly' },
          { name: 'strategy', kind: 'Strategy', id: s.strategyId, mode: 'DisplayOnly' },
        ]);
        const page = await deps.journal.query({ scope: 'TradeNarrative', tradeId: request.tradeId });
        const narrative = page.items;
        // Derived once and reused for every figure in the view.
        const derived = derive({ record: analysis });
        const resolved = labels.kind === 'Resolved' ? labels.resolved : {};
        const { plan } = analysis;
        const stored: Omit<IncoherentTradeDetail, 'lifecycle' | 'recordedPositionChanges' | 'deviations' | 'findings' | 'journal'> = {
          tradeId: analysis.tradeId,
          factRevision: analysis.factRevision,
          plan: {
            underlying: plan.underlying,
            planTime: plan.economicTime,
            thesis: plan.thesis,
            invalidation: plan.invalidation,
            ...optional('exerciseIntent', plan.exerciseIntent),
            legs: plan.legs,
            stops: plan.stops,
            targets: plan.targets,
          },
          labels: {
            strategy: resolved['strategy']?.label ?? '',
            account: resolved['account']?.label ?? '',
            institution: resolved['account']?.institution?.label ?? '',
          },
        };
        // Facts that cannot be replayed are surfaced with their findings, never repaired or computed.
        if (derived.kind === 'IncoherentFacts') {
          const view: IncoherentTradeDetail = {
            ...stored,
            lifecycle: { stored: analysis.storedLifecycle },
            recordedPositionChanges: analysis.positionChanges,
            deviations: analysis.recordedDeviations ?? [],
            findings: derived.findings,
            journal: narrative,
          };
          return { binding, view };
        }
        const planned: Omit<PlannedTradeDetail, 'journal'> = {
          ...stored,
          lifecycle: { stored: analysis.storedLifecycle, agreement: derived.agreement },
          baseline: derived.baseline,
          payoff: payoffOf(analysis, derived),
        };
        // A Trade that is Planned by both its stored lifecycle and its facts keeps D1's Detail, whose
        // narrative holds Entries only, without the item kind; any other Trade gets the Open form.
        if (analysis.storedLifecycle === 'Planned' && derived.expectedLifecycle === 'Planned') {
          const view: TradeDetailView = { ...planned, summary: plannedSummaryOf(analysis), journal: narrative.flatMap((item) => (item.kind === 'Entry' ? [withoutKind(item)] : [])) };
          return { binding, view };
        }
        const lastActivity = s.lastActivity ?? s.planTime;
        // A Trade that is Closed by both its stored lifecycle and its facts takes the Closed form before any frame
        // is read: its figures come from the facts alone and no Mark is required (A92). As with Planned, a
        // disagreement gets the Open form, which carries the LifecycleDisagreement (A96).
        if (analysis.storedLifecycle === 'Closed' && derived.expectedLifecycle === 'Closed') {
          const closeReason = analysis.closeReason && (await closeReasonOf(analysis.closeReason.closeReasonId));
          const closes = narrative.some((item) => item.kind === 'Debt') ? await sessionCloses(analysis.plan.underlying) : undefined;
          // A Closed Trade holds nothing, so no contract is awaiting settlement.
          const view = closedDetail(detailWithoutValuation(planned, analysis, derived, withDueStatus(narrative, closes), lastActivity, []), closedCurrent(analysis, derived), analysis, derived, closeReason);
          return { binding, view };
        }
        const { frames, snapshotId } = await currentFrames(instrumentsOf(analysis));
        const frame = primaryFrameOf(frames, analysis);
        const evaluation = evaluateCurrent(derived, analysis, frames);
        const mark = markProvenance(frame);
        const underlyingFrame = analysis.plan.legs[0]!.instrument.kind === 'Option' ? frames.find((f) => f.instrumentKey === analysis.plan.underlying) : undefined;
        const underlyingMark = underlyingFrame && markProvenance(underlyingFrame);
        const datedLine = await datedLineOfTrade(analysis, frames, frame, evaluation);
        const current: OpenCurrentEvaluation = {
          ...('resolution' in frame && { expectedMarkDate: frame.tradingDate, markResolution: frame.resolution }),
          ...optional('mark', mark),
          ...optional('underlyingMark', underlyingMark),
          coverage: [{ instrument: evaluation.observation.instrument, coverage: evaluation.coverage }],
          evaluation,
          ...optional('datedLine', datedLine),
        };
        const settlement = await settlementItemsOf(analysis.tradeId, evaluation);
        const view: OpenTradeDetail = { ...detailWithoutValuation(planned, analysis, derived, withDueStatus(narrative, closesOf(frame)), lastActivity, settlement), current };
        return { binding, view, ...optional('marketDataSnapshotId', snapshotId) };
      });
    },

    browseTrades<L extends 'Planned' | 'Open' | 'Closed'>(request: TradeBrowseRequest<L>) {
      return coherent<TradeBrowseView<L>>(async () => {
        const page = await deps.tradeRecord.queryRecords({
          lifecycle: request.lifecycle,
          projection: 'Browse',
          // Planned and Closed keep pages of 50; Trade Record pages the Open book by its maximum of 200 (D2 A32).
          ...(request.lifecycle !== 'Open' && { pageSize: BROWSE_PAGE_SIZE }),
          cursor: request.cursor,
        });
        // A cursor is valid only until the next commit.
        if (page.kind === 'CursorExpired') return { rejected: 'CursorExpired' as const };
        const records = page.items as BrowseRecord[];
        const labels = await deps.catalog.resolve(
          [...new Set(records.flatMap((r) => [r.summary.accountId, r.summary.strategyId]))].map((id) => ({
            name: id,
            kind: records.some((r) => r.summary.accountId === id) ? 'Account' : 'Strategy',
            id,
            mode: 'DisplayOnly',
          })),
        );
        const label = (id: string) => (labels.kind === 'Resolved' ? labels.resolved[id] : undefined);
        const labelsOf = (summary: RecordSummary) => ({
          strategy: label(summary.strategyId)?.label ?? '',
          account: label(summary.accountId)?.label ?? '',
          institution: label(summary.accountId)?.institution?.label ?? '',
        });
        // Each Trade on the page is derived once.
        const derivations = records.map(({ summary, analysis }) => ({ summary, analysis, derived: derive({ record: analysis }) }));
        const { frames, snapshotId } =
          request.lifecycle === 'Open'
            ? await currentFrames(derivations.flatMap(({ analysis, derived }) => (derived.kind === 'Derived' ? instrumentsOf(analysis) : [])))
            : { frames: [] };
        // A Closed page reads no Market Data: Close Reason labels, and the Trades with an Outstanding reflection.
        const closeReasons = request.lifecycle === 'Closed' ? await closeReasonsOf(records.map((r) => r.analysis)) : new Map<string, CloseReasonLabel>();
        const owed = request.lifecycle === 'Closed' ? await tradesWithOutstandingDebt() : new Set<string>();
        // On the Open page, each Trade is evaluated once; the contracts it finds due for settlement are the ones Detail shows.
        const evaluations = new Map<string, { readonly evaluation: TradeEvaluation; readonly settlement: readonly SettlementItem[]; readonly datedLine: DatedLine | undefined }>();
        if (request.lifecycle === 'Open') {
          // The lookups run together; the entries keep the page's order.
          const found = await Promise.all(
            derivations.flatMap(({ summary, analysis, derived }) => {
              if (derived.kind !== 'Derived') return [];
              const evaluation = evaluateCurrent(derived, analysis, frames);
              const datedLine = datedLineOfTrade(analysis, frames, primaryFrameOf(frames, analysis), evaluation);
              return [Promise.all([settlementItemsOf(summary.tradeId, evaluation), datedLine]).then(([settlement, dated]) => ({ tradeId: summary.tradeId, evaluation, settlement, datedLine: dated }))];
            }),
          );
          for (const { tradeId, evaluation, settlement, datedLine } of found) evaluations.set(tradeId, { evaluation, settlement, datedLine });
        }
        const items = derivations.map(({ summary, analysis, derived }) => {
          if (request.lifecycle === 'Closed') {
            const closeReason = analysis.closeReason && closeReasons.get(analysis.closeReason.closeReasonId);
            return derived.kind === 'Derived'
              ? closedItem(summary, analysis, derived, labelsOf(summary), closeReason, owed.has(summary.tradeId))
              : incoherentClosedItem(summary, analysis, labelsOf(summary), closeReason, owed.has(summary.tradeId));
          }
          if (request.lifecycle === 'Open') {
            if (derived.kind !== 'Derived') return incoherentItem(summary, analysis, labelsOf(summary));
            const { evaluation, settlement, datedLine } = evaluations.get(summary.tradeId)!;
            return openItem(summary, analysis, derived, labelsOf(summary), frames, evaluation, settlement, datedLine);
          }
          // A Planned item's Baseline needs a replay; facts that cannot be replayed are surfaced, never repaired.
          return derived.kind === 'Derived' ? plannedItem(summary, analysis, derived, labelsOf(summary)) : incoherentPlannedItem(summary, labelsOf(summary));
        }) as TradeBrowseItem<L>[];
        return { view: { items, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) }, binding: page.binding, ...optional('marketDataSnapshotId', snapshotId) };
      });
    },
  };
}
