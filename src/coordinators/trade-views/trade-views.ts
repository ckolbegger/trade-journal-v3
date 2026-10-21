import {
  derive,
  type CalculationResult,
  type DerivedTradeState,
  type EntryQuality,
  type EntryResolution,
  type InstrumentPosition,
  type IntegrityFinding,
  type LegFulfillment,
  type LifecycleAgreement,
  type PositionChangeFact,
  type RecordedDeviation,
  type LifecycleState,
  type PlanBaseline,
  type TradeAnalysisRecord,
} from '../../domain/trade-analysis/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { Journal, NarrativeEntry, NarrativeItem } from '../../modules/journal/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { BrowseRecord, TradeRecord, TradeSummary } from '../../modules/trade-record/index.ts';
import type { Persistence, WorkspaceSnapshotBinding } from '../../persistence/index.ts';

export interface TradeViewsDeps {
  readonly persistence: Persistence;
  readonly tradeRecord: TradeRecord;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
}

export interface TradeBrowseRequest<L extends 'Planned' | 'Open' = 'Planned' | 'Open'> {
  readonly lifecycle: L;
  readonly cursor?: string;
}

export const BROWSE_PAGE_SIZE = 50;

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
  // Recording an entry arrives in D2 (D1 A16).
  readonly entryReadiness: 'Awaiting entry';
}

// One Open Trade as the list presents it (D2 A32): factual Position and entry figures, no valuation
// or risk (D4).
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
  readonly incurredFees: Rational;
  readonly entryStatus: 'Entering' | 'Resolved';
  // Active recorded Deviation occurrences.
  readonly deviationCount: number;
  // Whether stored and expected records agree; a disagreement is surfaced, never repaired.
  readonly integrity: 'Agrees' | 'Disagrees';
  readonly lastActivity: string;
}

export type TradeBrowseItem<L extends 'Planned' | 'Open'> = L extends 'Open' ? OpenTradeItem : PlannedTradeItem;

export interface TradeBrowseView<L extends 'Planned' | 'Open'> {
  readonly items: readonly TradeBrowseItem<L>[];
  readonly nextCursor?: string;
}

// The revisions one coherent view represents.
export interface ViewBinding {
  readonly workspace: WorkspaceSnapshotBinding;
  readonly catalogRevision: number;
  readonly journalRevision: number;
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
  readonly labels: { readonly strategy: string; readonly account: string; readonly institution: string };
  readonly journal: readonly NarrativeEntry[];
}

// The Open form of Trade Detail (D2): the Planned form's Plan, lifecycle, Baseline, and labels, plus
// the derived Position and entry, the recorded Deviations, any integrity findings, and the whole
// narrative with declines. No valuation, Marks, or risk (D4).
export interface OpenTradeDetail extends Omit<PlannedTradeDetail, 'journal'> {
  // Signed net quantity and Open Lots per Instrument.
  readonly positions: readonly InstrumentPosition[];
  readonly fees: DerivedTradeState['fees'];
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
}

export type TradeDetailView = PlannedTradeDetail | OpenTradeDetail;

export interface TradeViews {
  // One overload per lifecycle, so each caller receives its lifecycle's item form.
  browseTrades(request: TradeBrowseRequest<'Open'>): Promise<ReadViewResult<TradeBrowseView<'Open'>>>;
  browseTrades(request: TradeBrowseRequest<'Planned'>): Promise<ReadViewResult<TradeBrowseView<'Planned'>>>;
  getTradeDetail(request: TradeDetailRequest): Promise<ReadViewResult<TradeDetailView>>;
}

// A narrative Entry in D1's Detail shape: the item kind is the narrative's discriminator only.
function withoutKind(item: Extract<NarrativeItem, { kind: 'Entry' }>): NarrativeEntry {
  const entry: Record<string, unknown> = { ...item };
  delete entry['kind'];
  return entry as unknown as NarrativeEntry;
}

type Labels = { readonly strategy: string; readonly account: string; readonly institution: string };

function plannedItem(summary: TradeSummary, derived: DerivedTradeState, labels: Labels): PlannedTradeItem {
  const { baseline } = derived;
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    planTime: summary.planTime,
    oneR: baseline.oneR,
    originalPlannedReward: baseline.originalPlannedReward,
    rewardRiskRatio: baseline.rewardRiskRatio,
    entryReadiness: 'Awaiting entry',
  };
}

function decimal(text: string): Rational {
  const parsed = parseDecimal(text);
  if (!parsed.ok) throw new Error(`not a decimal: ${text}`);
  return parsed.value;
}

const sum = (values: readonly Rational[]) => values.reduce((a, b) => a.add(b), Rational.of(0n));

// Entering until the Entry Resolution Point, then Resolved (D2 A23).
const entryStatusOf = (derived: DerivedTradeState) => (derived.entryResolution.kind === 'Resolved' ? 'Resolved' : 'Entering');

function openItem(summary: TradeSummary, analysis: TradeAnalysisRecord, derived: DerivedTradeState, labels: Labels): OpenTradeItem {
  const lots = derived.positions.flatMap((p) => p.openLots);
  const openQuantity = sum(lots.map((l) => l.quantity));
  return {
    tradeId: summary.tradeId,
    underlying: summary.underlying,
    ...labels,
    openQuantity,
    plannedQuantity: sum(analysis.plan.legs.map((l) => decimal(l.quantity))),
    averageOpenCost:
      openQuantity.compare(Rational.of(0n)) === 0
        ? { kind: 'NotApplicable', reason: 'NoOpenQuantity' }
        : { kind: 'Value', value: sum(lots.map((l) => l.quantity.mul(l.price))).div(openQuantity) },
    incurredFees: derived.fees.incurredOpening,
    entryStatus: entryStatusOf(derived),
    deviationCount: (analysis.recordedDeviations ?? []).filter((d) => d.versions.at(-1)?.status === 'Active').length,
    integrity: derived.findings.length === 0 ? 'Agrees' : 'Disagrees',
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
): OpenTradeDetail {
  return {
    ...planned,
    positions: derived.positions,
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

  // Module reads are separate transactions, so a view is accepted only if the Workspace binding
  // is unchanged across its assembly; otherwise it is retried, a bounded number of times.
  async function coherent<T>(
    assemble: () => Promise<{ view: T; binding: WorkspaceSnapshotBinding } | { rejected: 'CursorExpired' } | { notFound: true }>,
  ): Promise<ReadViewResult<T>> {
    for (let attempt = 0; attempt < ASSEMBLY_ATTEMPTS; attempt++) {
      const assembled = await assemble();
      if ('rejected' in assembled) return { kind: 'Rejected', reason: assembled.rejected };
      if ('notFound' in assembled) return { kind: 'NotFound' };
      const { view, binding } = assembled;
      const after = await currentBinding();
      if (after.workspace.databaseName === binding.databaseName && after.workspace.contentRevision === binding.contentRevision) {
        return { kind: 'Ready', view, binding: after };
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
        const s = (summary as { projection: TradeSummary }).projection;
        const analysis = (record as { projection: TradeAnalysisRecord }).projection;
        const labels = await deps.catalog.resolve([
          { name: 'account', kind: 'Account', id: s.accountId, mode: 'DisplayOnly' },
          { name: 'strategy', kind: 'Strategy', id: s.strategyId, mode: 'DisplayOnly' },
        ]);
        const narrative = await deps.journal.query({ scope: 'TradeNarrative', tradeId: request.tradeId });
        // Derived once and reused for every figure in the view.
        const derived = derive({ record: analysis });
        if (derived.kind !== 'Derived') throw new Error('incoherent');
        const resolved = labels.kind === 'Resolved' ? labels.resolved : {};
        const { plan } = analysis;
        const planned: Omit<PlannedTradeDetail, 'journal'> = {
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
          lifecycle: { stored: analysis.storedLifecycle, agreement: derived.agreement },
          baseline: derived.baseline,
          labels: {
            strategy: resolved['strategy']?.label ?? '',
            account: resolved['account']?.label ?? '',
            institution: resolved['account']?.institution?.label ?? '',
          },
        };
        // A Trade that is Planned by both its stored lifecycle and its facts keeps D1's Detail, whose
        // narrative holds Entries only, without the item kind; any other Trade gets the Open form.
        const view: TradeDetailView =
          analysis.storedLifecycle === 'Planned' && derived.expectedLifecycle === 'Planned'
            ? { ...planned, journal: narrative.items.flatMap((item) => (item.kind === 'Entry' ? [withoutKind(item)] : [])) }
            : openDetail(planned, analysis, derived, narrative.items);
        return { binding, view };
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
        const labelsOf = (summary: TradeSummary) => ({
          strategy: label(summary.strategyId)?.label ?? '',
          account: label(summary.accountId)?.label ?? '',
          institution: label(summary.accountId)?.institution?.label ?? '',
        });
        const items = records.map(({ summary, analysis }) => {
          // Each Trade on the page is derived once.
          const derived = derive({ record: analysis });
          if (derived.kind !== 'Derived') throw new Error('incoherent');
          return request.lifecycle === 'Open' ? openItem(summary, analysis, derived, labelsOf(summary)) : plannedItem(summary, derived, labelsOf(summary));
        }) as TradeBrowseItem<L>[];
        return { view: { items, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) }, binding: page.binding };
      });
    },
  };
}
