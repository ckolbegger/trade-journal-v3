import {
  derive,
  evaluate,
  type AtEntryFigures,
  type CalculationResult,
  type ConditionStatus,
  type DerivedTradeState,
  type EntryQuality,
  type EntryResolution,
  type IncoherentFacts,
  type InstrumentPosition,
  type IntegrityFinding,
  type LegFulfillment,
  type LifecycleAgreement,
  type PositionChangeFact,
  type TradeEvaluation,
  type RecordedDeviation,
  type LifecycleState,
  type PlanBaseline,
  type TradeAnalysisRecord,
} from '../../domain/trade-analysis/index.ts';
import { openLongStockSummary, plannedLongStockSummary, type TradeSummary } from '../../domain/trade-summary.ts';
import type { Clock } from '../../domain/time/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { Journal, NarrativeEntry, NarrativeItem } from '../../modules/journal/index.ts';
import type { MarkFrame, MarketData, MarkResolution } from '../../modules/market-data/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { BrowseRecord, TradeRecord, TradeSummary as RecordSummary } from '../../modules/trade-record/index.ts';
import type { Persistence, WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import { datedLineOf, observationFrame, type DatedLine } from '../valuation.ts';

export interface TradeViewsDeps {
  readonly persistence: Persistence;
  readonly tradeRecord: TradeRecord;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly marketData: MarketData;
  readonly clock: Clock;
}

export interface TradeBrowseRequest<L extends 'Planned' | 'Open' = 'Planned' | 'Open'> {
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
  readonly averageOpenCost: CalculationResult<Rational, 'NoOpenQuantity'>;
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
}

// An Open Trade whose recorded facts cannot be replayed (AC-LIFE-003): its Position and entry figures
// are unavailable rather than shown as numbers, and its records disagree.
export interface IncoherentOpenTradeItem extends Omit<
  OpenTradeItem,
  'openQuantity' | 'averageOpenCost' | 'summary' | 'netCost' | 'incurredFees' | 'entryStatus' | 'integrity' | 'current'
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

export type TradeBrowseItem<L extends 'Planned' | 'Open'> = L extends 'Open'
  ? OpenTradeItem | IncoherentOpenTradeItem
  : PlannedTradeItem | IncoherentPlannedTradeItem;

export interface TradeBrowseView<L extends 'Planned' | 'Open'> {
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
    readonly legs: TradeAnalysisRecord['plan']['legs'];
    readonly stops: TradeAnalysisRecord['plan']['stops'];
    readonly targets: TradeAnalysisRecord['plan']['targets'];
  };
  // Stored Lifecycle State and its independently derived agreement, shown as separate concepts.
  readonly lifecycle: { readonly stored: LifecycleState; readonly agreement: LifecycleAgreement };
  readonly baseline: PlanBaseline;
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
  // Per Instrument; a Long Stock Trade has one.
  readonly coverage: readonly { readonly instrument: TradeEvaluation['observation']['instrument']; readonly coverage: TradeEvaluation['coverage'] }[];
  readonly evaluation: TradeEvaluation;
  readonly datedLine?: DatedLine;
}

// The Open form of Trade Detail (D2): the Planned form's Plan, lifecycle, Baseline, and labels, plus
// the derived Position and entry, the recorded Deviations, any integrity findings, and the whole
// narrative with declines. No valuation, Marks, or risk (D4).
export interface OpenTradeDetail extends Omit<PlannedTradeDetail, 'journal'> {
  // Signed net quantity and Open Lots per Instrument.
  readonly positions: readonly InstrumentPosition[];
  readonly fees: DerivedTradeState['fees'];
  readonly netCost: DerivedTradeState['netCost'];
  // The latest activity on the Trade, as its Open list item carries it (it orders that list).
  readonly lastActivity: string;
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
  readonly journal: readonly NarrativeItem[];
  readonly current: OpenCurrentEvaluation;
}

// A recorded fact that cannot be replayed, named with the reason (AC-LIFE-003).
export type IncoherentFactFinding = IncoherentFacts['findings'][number];

// The Detail of a Trade whose recorded facts cannot be replayed (AC-LIFE-003): its Plan, stored
// lifecycle, labels, recorded Position Changes, recorded Deviations, and narrative, with the findings.
// Nothing is derived, so it has no Baseline, lifecycle agreement, Position, entry, or fulfillment.
export interface IncoherentTradeDetail extends Omit<PlannedTradeDetail, 'journal' | 'lifecycle' | 'baseline'> {
  readonly lifecycle: { readonly stored: LifecycleState };
  // As stored: without a replay there is no Fact Order.
  readonly recordedPositionChanges: readonly PositionChangeFact[];
  readonly deviations: readonly RecordedDeviation[];
  readonly findings: readonly IncoherentFactFinding[];
  readonly journal: readonly NarrativeItem[];
}

export type TradeDetailView = PlannedTradeDetail | OpenTradeDetail | IncoherentTradeDetail;

export interface TradeViews {
  // Generic in the lifecycle, so each caller receives its lifecycle's item form, and a caller
  // holding either lifecycle (a tab switch) receives the union.
  browseTrades<L extends 'Planned' | 'Open'>(request: TradeBrowseRequest<L>): Promise<ReadViewResult<TradeBrowseView<L>>>;
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
    summary: plannedLongStockSummary(analysis.plan.legs),
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

// The current frame of an Instrument, or the as-of date when it lies outside session-policy coverage.
type CurrentFrame = MarkFrame | { readonly date: string };

const evaluateCurrent = (derived: DerivedTradeState, analysis: TradeAnalysisRecord, frame: CurrentFrame): TradeEvaluation =>
  evaluate({ state: derived, frame: 'resolution' in frame ? observationFrame(frame) : { instrument: { kind: 'Stock', symbol: analysis.plan.underlying }, date: frame.date } });

function openItem(summary: RecordSummary, analysis: TradeAnalysisRecord, derived: DerivedTradeState, labels: Labels, frame: CurrentFrame): OpenTradeItem {
  const evaluation = evaluateCurrent(derived, analysis, frame);
  const datedLine = 'resolution' in frame ? datedLineOf(analysis, frame, evaluation) : undefined;
  const open = openLongStockSummary(derived);
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    openQuantity: open?.quantity ?? Rational.of(0n),
    plannedQuantity: sum(analysis.plan.legs.map((l) => decimal(l.quantity))),
    averageOpenCost: open ? { kind: 'Value', value: open.price } : { kind: 'NotApplicable', reason: 'NoOpenQuantity' },
    ...optional('summary', open),
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

// Position Changes and their Executions in the Fact Order Trade Analysis replayed them in.
function inFactOrder(analysis: TradeAnalysisRecord, derived: DerivedTradeState): PositionChangeFact[] {
  const rank = new Map(derived.facts.map((fact, i) => [fact.factId, i]));
  const byRank = (a: { factId: string }, b: { factId: string }) => (rank.get(a.factId) ?? 0) - (rank.get(b.factId) ?? 0);
  const first = (pc: PositionChangeFact) => Math.min(...pc.executions.map((e) => rank.get(e.factId) ?? 0));
  return [...analysis.positionChanges]
    .sort((a, b) => first(a) - first(b))
    .map((pc) => ({ ...pc, executions: [...pc.executions].sort(byRank) }));
}

function openDetail(
  planned: Omit<PlannedTradeDetail, 'journal'>,
  analysis: TradeAnalysisRecord,
  derived: DerivedTradeState,
  narrative: readonly NarrativeItem[],
  lastActivity: string,
  current: OpenCurrentEvaluation,
): OpenTradeDetail {
  return {
    ...planned,
    positions: derived.positions,
    ...optional('summary', openLongStockSummary(derived)),
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
    current,
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
  async function currentFrames(symbols: readonly string[]): Promise<{ readonly frames: readonly CurrentFrame[]; readonly snapshotId?: string }> {
    if (symbols.length === 0) return { frames: [] };
    const instruments = [...new Set(symbols)].sort();
    const asOf = deps.clock.now();
    const result = await deps.marketData.query({ kind: 'ResolveFrames', context: { kind: 'Current', asOf }, instruments });
    const uncovered = result.kind === 'Rejected' ? result.issues.find((issue) => issue.code === 'SessionPolicyCoverage') : undefined;
    const date = uncovered?.date;
    if (date !== undefined) return { frames: instruments.map(() => ({ date })) };
    if (result.kind !== 'Frames') throw new Error(`Market Data returned ${result.kind} for the current frames`);
    return { frames: result.frames, snapshotId: result.snapshotId };
  }

  // The effective Mark revision's provenance, as Market Data describes it on the frame.
  function markProvenance(frame: CurrentFrame): MarkProvenance | undefined {
    if (!('resolution' in frame) || frame.resolution.kind !== 'Available') return undefined;
    const { source, revisionId, revisionNumber, price, savedAt, correctionReason } = frame.resolution.mark;
    return { source, revisionId, revisionNumber, price, savedAt, ...(correctionReason !== undefined && { correctionReason }) };
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
        const narrative = await deps.journal.query({ scope: 'TradeNarrative', tradeId: request.tradeId });
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
            journal: narrative.items,
          };
          return { binding, view };
        }
        const planned: Omit<PlannedTradeDetail, 'journal'> = {
          ...stored,
          lifecycle: { stored: analysis.storedLifecycle, agreement: derived.agreement },
          baseline: derived.baseline,
        };
        // A Trade that is Planned by both its stored lifecycle and its facts keeps D1's Detail, whose
        // narrative holds Entries only, without the item kind; any other Trade gets the Open form.
        if (analysis.storedLifecycle === 'Planned' && derived.expectedLifecycle === 'Planned') {
          const view: TradeDetailView = { ...planned, summary: plannedLongStockSummary(analysis.plan.legs), journal: narrative.items.flatMap((item) => (item.kind === 'Entry' ? [withoutKind(item)] : [])) };
          return { binding, view };
        }
        const { frames, snapshotId } = await currentFrames([analysis.plan.underlying]);
        const frame = frames[0]!;
        const evaluation = evaluateCurrent(derived, analysis, frame);
        const mark = markProvenance(frame);
        const datedLine = 'resolution' in frame ? datedLineOf(analysis, frame, evaluation) : undefined;
        const current: OpenCurrentEvaluation = {
          ...('resolution' in frame && { expectedMarkDate: frame.tradingDate, markResolution: frame.resolution }),
          ...optional('mark', mark),
          coverage: [{ instrument: evaluation.observation.instrument, coverage: evaluation.coverage }],
          evaluation,
          ...optional('datedLine', datedLine),
        };
        const view: TradeDetailView = openDetail(planned, analysis, derived, narrative.items, s.lastActivity ?? s.planTime, current);
        return { binding, view, ...optional('marketDataSnapshotId', snapshotId) };
      });
    },

    browseTrades<L extends 'Planned' | 'Open'>(request: TradeBrowseRequest<L>) {
      return coherent<TradeBrowseView<L>>(async () => {
        const page = await deps.tradeRecord.queryRecords({
          lifecycle: request.lifecycle,
          projection: 'Browse',
          // Planned keeps pages of 50; Trade Record pages the Open book by its maximum of 200 (D2 A32).
          ...(request.lifecycle === 'Planned' && { pageSize: BROWSE_PAGE_SIZE }),
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
            ? await currentFrames(derivations.flatMap(({ analysis, derived }) => (derived.kind === 'Derived' ? [analysis.plan.underlying] : [])))
            : { frames: [] };
        const items = derivations.map(({ summary, analysis, derived }) => {
          if (request.lifecycle === 'Open') {
            if (derived.kind !== 'Derived') return incoherentItem(summary, analysis, labelsOf(summary));
            const frame = frames.find((f) => !('instrumentKey' in f) || f.instrumentKey === analysis.plan.underlying);
            if (!frame) throw new Error(`Market Data returned no frame for ${analysis.plan.underlying}`);
            return openItem(summary, analysis, derived, labelsOf(summary), frame);
          }
          // A Planned item's Baseline needs a replay; facts that cannot be replayed are surfaced, never repaired.
          return derived.kind === 'Derived' ? plannedItem(summary, analysis, derived, labelsOf(summary)) : incoherentPlannedItem(summary, labelsOf(summary));
        }) as TradeBrowseItem<L>[];
        return { view: { items, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) }, binding: page.binding, ...optional('marketDataSnapshotId', snapshotId) };
      });
    },
  };
}
