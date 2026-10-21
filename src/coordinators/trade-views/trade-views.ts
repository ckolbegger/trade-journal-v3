import { derive, type LifecycleAgreement, type LifecycleState, type PlanBaseline, type TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import type { Rational } from '../../domain/values/index.ts';
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

export interface TradeBrowseRequest {
  readonly lifecycle: 'Planned';
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

export interface TradeViews {
  browseTrades(
    request: TradeBrowseRequest,
  ): Promise<ReadViewResult<{ readonly items: readonly PlannedTradeItem[]; readonly nextCursor?: string }>>;
  getTradeDetail(request: TradeDetailRequest): Promise<ReadViewResult<PlannedTradeDetail>>;
}

// A narrative Entry in D1's Detail shape: the item kind is the narrative's discriminator only.
function withoutKind(item: Extract<NarrativeItem, { kind: 'Entry' }>): NarrativeEntry {
  const entry: Record<string, unknown> = { ...item };
  delete entry['kind'];
  return entry as unknown as NarrativeEntry;
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
      return coherent<PlannedTradeDetail>(async () => {
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
        return {
          binding,
          view: {
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
            // A Planned Trade has no Position Change, so its narrative holds Entries only; T2.7's
            // Open Detail carries declines too. Entries keep D1's Detail shape, without the item kind.
            journal: narrative.items.flatMap((item) => (item.kind === 'Entry' ? [withoutKind(item)] : [])),
          },
        };
      });
    },

    browseTrades(request) {
      return coherent<{ readonly items: readonly PlannedTradeItem[]; readonly nextCursor?: string }>(async () => {
        const page = await deps.tradeRecord.queryRecords({
          lifecycle: request.lifecycle,
          projection: 'Browse',
          pageSize: BROWSE_PAGE_SIZE,
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
        const items = records.map(({ summary, analysis }): PlannedTradeItem => {
          const derived = derive({ record: analysis });
          if (derived.kind !== 'Derived') throw new Error('incoherent');
          const { baseline } = derived;
          return {
            tradeId: summary.tradeId,
            underlying: summary.underlying,
            strategy: label(summary.strategyId)?.label ?? '',
            account: label(summary.accountId)?.label ?? '',
            institution: label(summary.accountId)?.institution?.label ?? '',
            planTime: summary.planTime,
            oneR: baseline.oneR,
            originalPlannedReward: baseline.originalPlannedReward,
            rewardRiskRatio: baseline.rewardRiskRatio,
            entryReadiness: 'Awaiting entry',
          };
        });
        return { view: { items, ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}) }, binding: page.binding };
      });
    },
  };
}
