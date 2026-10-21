import type { MutationGuard } from '../mutation-guard.ts';
import type { Clock } from '../../domain/time/index.ts';
import type { DerivedTradeState, LifecycleState, TradeAnalysisRecord } from '../../domain/trade-analysis/index.ts';
import type { EntryProjection, Journal } from '../../modules/journal/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { TradeRecord } from '../../modules/trade-record/index.ts';
import type { Persistence, WorkspaceSnapshotBinding } from '../../persistence/index.ts';

// Values shared by every Trade Workflows operation.

export interface TradeWorkflowsDeps {
  readonly persistence: Persistence;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly tradeRecord: TradeRecord;
  readonly clock: Clock;
  readonly guard: MutationGuard;
}

// The common accepted result of every Trade mutation (Trade Workflows, "Common command rules"):
// enough to present the saved outcome without reading the changed Trade back. Each operation adds
// its own receipt fields and post-commit outcomes; a Plan confirmation adds its Plan Reflection Entry.
export interface TradeMutationSuccess<Receipt = { readonly entryId: string }, PostCommit = { readonly entry: EntryProjection }> {
  readonly receipt: {
    readonly tradeId: string;
    readonly factRevision: number;
    readonly binding: WorkspaceSnapshotBinding;
    readonly createdFactIds: readonly string[];
    readonly lifecycleTransitions: readonly { readonly tradeId: string; readonly from: LifecycleState | null; readonly to: LifecycleState }[];
  } & Receipt;
  readonly postCommit: {
    readonly trade: TradeAnalysisRecord;
    readonly derivation: DerivedTradeState;
  } & PostCommit;
  // Advisory: views that may now differ, for optional later reads only.
  readonly affected: readonly { readonly scope: 'TradeList'; readonly lifecycle: LifecycleState }[];
}

export interface WorkflowIssue {
  readonly source: 'ReferenceCatalog' | 'Journal' | 'TradeAnalysis' | 'TradeWorkflows';
  // The index of the command member the issue belongs to, for issues about one member.
  readonly member?: number;
  readonly field?: string;
  readonly code: string;
}
