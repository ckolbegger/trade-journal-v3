import type { Instant } from '../time/index.ts';
import { frozenBaseline, type ConditionInput, type PlanBaseline, type PlannedLegInput } from './plan.ts';

export type LifecycleState = 'Planned' | 'Open' | 'Closed' | 'Abandoned';

// Trade Record's AnalysisInput projection: the complete effective facts of one Trade at one
// FactRevision. D1 has Plan facts only; position-changing facts arrive in D2.
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
  readonly positionChanges: readonly never[];
}

export interface TradeDerivationInput {
  readonly record: TradeAnalysisRecord;
}

// Agreement between stored and expected Lifecycle State; a disagreement is reported, never repaired.
export type LifecycleAgreement =
  | { readonly kind: 'Agrees' }
  | { readonly kind: 'LifecycleDisagreement'; readonly stored: LifecycleState; readonly expected: LifecycleState };

export interface DerivedTradeState {
  readonly tradeId: string;
  readonly factRevision: number;
  readonly expectedLifecycle: LifecycleState;
  readonly agreement: LifecycleAgreement;
  readonly positions: readonly never[];
  readonly baseline: PlanBaseline;
}

export function derive(input: TradeDerivationInput): DerivedTradeState {
  const { record } = input;
  // With no position-changing facts, the confirmed Plan is expected to be Planned.
  const expectedLifecycle: LifecycleState = 'Planned';
  return {
    tradeId: record.tradeId,
    factRevision: record.factRevision,
    expectedLifecycle,
    agreement:
      record.storedLifecycle === expectedLifecycle
        ? { kind: 'Agrees' }
        : { kind: 'LifecycleDisagreement', stored: record.storedLifecycle, expected: expectedLifecycle },
    positions: [],
    baseline: frozenBaseline(record.plan),
  };
}
