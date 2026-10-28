import type { StorageFailure } from '../mutation-guard.ts';
import type { RuntimeNotWritable } from '../../delivery/runtime-not-writable.ts';
import type { Instant } from '../../domain/time/index.ts';
import { assessPlan, derive, type PlanInput } from '../../domain/trade-analysis/index.ts';
import type { AnswerInput } from '../../modules/journal/index.ts';
import { recordPositionChange, type PositionChangeCommand, type PositionChangeResult } from './record-position-change.ts';
import { beginSemanticTransaction, type BindingCheck, type WorkspaceSnapshotBinding } from '../../persistence/index.ts';
import type { TradeMutationSuccess, TradeWorkflowsDeps, WorkflowIssue } from './types.ts';

export type { TradeMutationSuccess, TradeWorkflowsDeps, WorkflowIssue } from './types.ts';

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
  recordPositionChange(command: PositionChangeCommand): Promise<PositionChangeResult>;
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
    recordPositionChange: (command) => deps.guard.run('TradeWorkflows.recordPositionChange', () => recordPositionChange(deps, command)),
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
      if (derived.kind !== 'Derived') throw new Error('incoherent');
      const tx = beginSemanticTransaction();
      const staged = deps.tradeRecord.applyPreparedChange(tx, prepared, {
        candidateDigest: prepared.digest,
        expectedLifecycle: derived.expectedLifecycle,
        exposureStart: null,
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
      const derivation = derive({ record: trade });
      if (derivation.kind !== 'Derived') throw new Error('incoherent');
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
        postCommit: { trade, derivation, entry },
        affected: [{ scope: 'TradeList', lifecycle: trade.storedLifecycle }],
      };
    }
  }
}
