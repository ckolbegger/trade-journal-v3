import type { MutationGuard, StorageFailure } from '../mutation-guard.ts';
import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { Clock, Instant } from '../../domain/time/index.ts';
import {
  assessPlan,
  derive,
  type DerivedTradeState,
  type LifecycleState,
  type PlanInput,
  type TradeAnalysisRecord,
} from '../../domain/trade-analysis/index.ts';
import type { AnswerInput, EntryProjection, Journal } from '../../modules/journal/index.ts';
import type { ReferenceCatalog } from '../../modules/reference-catalog/index.ts';
import type { TradeRecord } from '../../modules/trade-record/index.ts';
import {
  beginSemanticTransaction,
  type BindingCheck,
  type Persistence,
  type WorkspaceSnapshotBinding,
} from '../../persistence/index.ts';

export interface TradeWorkflowsDeps {
  readonly persistence: Persistence;
  readonly catalog: ReferenceCatalog;
  readonly journal: Journal;
  readonly tradeRecord: TradeRecord;
  readonly clock: Clock;
  readonly guard: MutationGuard;
}

export interface ConfirmPlanCommand {
  readonly accountId: string;
  // Record revisions of the references shown in the form, rechecked inside the commit (D1 A6).
  readonly accountRevision: number;
  readonly strategyId: string;
  readonly strategyRevision: number;
  readonly economicTime: Instant;
  readonly plan: Omit<PlanInput, never>;
  // The completed Plan Reflection against the exact definition revision shown.
  readonly reflection: { readonly definitionId: string; readonly answers: Readonly<Record<string, AnswerInput>> };
}

// The common accepted result of every Trade mutation (Trade Workflows, "Common command rules"):
// enough to present the saved outcome without reading the changed Trade back.
export interface TradeMutationSuccess {
  readonly receipt: {
    readonly tradeId: string;
    readonly factRevision: number;
    readonly binding: WorkspaceSnapshotBinding;
    readonly createdFactIds: readonly string[];
    readonly lifecycleTransitions: readonly { readonly tradeId: string; readonly from: LifecycleState | null; readonly to: LifecycleState }[];
    readonly entryId: string;
  };
  readonly postCommit: {
    readonly trade: TradeAnalysisRecord;
    readonly derivation: DerivedTradeState;
    readonly entry: EntryProjection;
  };
  // Advisory: views that may now differ, for optional later reads only.
  readonly affected: readonly { readonly scope: 'TradeList'; readonly lifecycle: LifecycleState }[];
}

export interface WorkflowIssue {
  readonly source: 'ReferenceCatalog' | 'Journal' | 'TradeAnalysis' | 'TradeWorkflows';
  readonly field?: string;
  readonly code: string;
}

export type ConfirmPlanResult =
  | ({ readonly kind: 'Confirmed' } & TradeMutationSuccess)
  // Every issue from every participant together; nothing was written.
  | {
      readonly kind: 'Rejected';
      readonly issues: readonly WorkflowIssue[];
      // The Workspace snapshot the command was judged against; a rejection never changes it.
      readonly binding: WorkspaceSnapshotBinding;
    }
  // A referenced record changed after the form was loaded; nothing was written.
  | { readonly kind: 'Conflict'; readonly changed: readonly string[] }
  | RuntimeNotWritable
  | StorageFailure;

export interface TradeWorkflows {
  confirmPlan(command: ConfirmPlanCommand): Promise<ConfirmPlanResult>;
}

function unchangedReference(name: string, id: string, recordRevision: number): BindingCheck {
  return {
    name,
    store: 'catalog',
    key: id,
    verify: (current) => current?.['recordRevision'] === recordRevision && current['active'] === true,
  };
}

export function createTradeWorkflows(deps: TradeWorkflowsDeps): TradeWorkflows {
  return {
    // Readiness is rerun immediately before the mutation (D1 A4).
    confirmPlan: (command) => deps.guard.run('TradeWorkflows.confirmPlan', () => confirmPlan(command)),
  };

  async function confirmPlan(command: ConfirmPlanCommand): Promise<ConfirmPlanResult> {
    {
      const issues: WorkflowIssue[] = [];
      // A Plan may be recorded after the fact but never dated in the future (decision 20).
      if (Date.parse(command.economicTime) > Date.parse(deps.clock.now())) {
        issues.push({ source: 'TradeWorkflows', field: 'economicTime', code: 'EconomicTimeInFuture' });
      }
      // Resolved separately so one unknown reference never hides another's issues or the shape;
      // each record's revision is rechecked inside the commit (D1 A6).
      const account = await deps.catalog.resolve([{ name: 'account', kind: 'Account', id: command.accountId, mode: 'NewSelection' }]);
      const strategy = await deps.catalog.resolve([{ name: 'strategy', kind: 'Strategy', id: command.strategyId, mode: 'NewSelection' }]);
      for (const resolution of [account, strategy]) {
        if (resolution.kind === 'Unresolved') {
          for (const issue of resolution.issues) issues.push({ source: 'ReferenceCatalog', field: issue.name, code: issue.code });
        }
      }
      const reflection = await deps.journal.prepareEffects({
        obligation: 'PlanReflection',
        disposition: { kind: 'Complete', form: command.reflection },
        anchor: { kind: 'Trade', ref: 'candidate:trade' },
        origin: { kind: 'Plan', ref: 'candidate:plan' },
        // The Plan Reflection's moment is the Plan's trader-entered Economic Time (decision 20).
        momentTime: command.economicTime,
      });
      if (reflection.kind === 'Rejected') {
        for (const issue of reflection.issues) issues.push({ source: 'Journal', field: issue.promptId, code: issue.code });
      }
      // The Plan is assessed against the Strategy's immutable shape whenever that resolved.
      const shape = strategy.kind === 'Resolved' ? strategy.resolved['strategy']?.shape : undefined;
      const assessment = shape ? assessPlan({ strategyShape: shape, plan: command.plan }) : undefined;
      if (assessment?.kind === 'Rejected') {
        for (const issue of assessment.issues) issues.push({ source: 'TradeAnalysis', code: issue.code });
      }
      if (issues.length > 0 || !assessment || assessment.kind !== 'Accepted' || reflection.kind !== 'Prepared') {
        const { binding } = await deps.persistence.readSnapshot(['meta'], () => Promise.resolve(null));
        return { kind: 'Rejected', issues, binding };
      }
      const prepared = await deps.tradeRecord.prepareChange({
        kind: 'ConfirmPlan',
        accountId: command.accountId,
        strategyId: command.strategyId,
        plan: {
          ...assessment.plan,
          economicTime: command.economicTime,
          // Thesis and Invalidation are entered once and supply both the Plan and the Entry.
          thesis: reflection.semantics.Thesis,
          invalidation: reflection.semantics.Invalidation,
        },
      });
      if (prepared.kind !== 'Prepared') throw new Error('incoherent');
      const derived = derive({ record: prepared.analysisInput });
      const tx = beginSemanticTransaction();
      const staged = deps.tradeRecord.applyPreparedChange(tx, prepared, {
        candidateDigest: prepared.digest,
        expectedLifecycle: derived.expectedLifecycle,
      });
      if (staged.kind !== 'Staged') throw new Error('mismatch');
      const journal = deps.journal.applyPreparedEffects(tx, reflection, staged.mapping);
      // Each chosen reference must still be the selectable record revision the form showed (D1 A6).
      tx.require(unchangedReference('account', command.accountId, command.accountRevision));
      tx.require(unchangedReference('strategy', command.strategyId, command.strategyRevision));
      const committed = await deps.persistence.commit(tx.close());
      if (committed.kind === 'Conflict') return { kind: 'Conflict', changed: [committed.binding] };
      if (committed.kind === 'RuntimeNotWritable') return committed;
      if (committed.kind !== 'Committed') throw new Error(committed.kind);
      const trade = staged.projection;
      const entry = journal.entries[0]!;
      return {
        kind: 'Confirmed',
        receipt: {
          tradeId: trade.tradeId,
          factRevision: trade.factRevision,
          binding: committed.binding,
          createdFactIds: Object.entries(staged.mapping)
            .filter(([candidate]) => candidate !== 'candidate:trade')
            .map(([, id]) => id),
          lifecycleTransitions: [{ tradeId: trade.tradeId, from: null, to: trade.storedLifecycle }],
          entryId: entry.id,
        },
        postCommit: { trade, derivation: derive({ record: trade }), entry },
        affected: [{ scope: 'TradeList', lifecycle: trade.storedLifecycle }],
      };
    }
  }
}
