import type { ConditionInput, LifecycleState, PlannedLegInput } from '../../domain/trade-analysis/index.ts';
import type { Instant } from '../../domain/time/index.ts';

export interface PlanFactValue {
  readonly economicTime: Instant;
  readonly underlying: string;
  readonly thesis: string;
  readonly invalidation: string;
}

export type FactValue =
  | { readonly kind: 'Plan'; readonly value: PlanFactValue }
  | { readonly kind: 'PlannedLeg'; readonly value: PlannedLegInput }
  | { readonly kind: 'Stop'; readonly value: ConditionInput }
  | { readonly kind: 'Target'; readonly value: ConditionInput };

// One stable fact identity with its immutable version list (decision 11: exactly one version
// until corrections arrive in D15).
export type TradeFact = FactValue extends infer V
  ? V extends FactValue
    ? {
        readonly factId: string;
        readonly kind: V['kind'];
        readonly recordedSequence: number;
        readonly versions: readonly { readonly versionNumber: number; readonly value: V['value'] }[];
      }
    : never
  : never;

// One Trade's stored document: its facts plus the stored, indexed Lifecycle State.
export interface TradeDocument {
  readonly tradeId: string;
  readonly accountId: string;
  readonly strategyId: string;
  readonly lifecycle: LifecycleState;
  readonly planTime: Instant;
  readonly underlying: string;
  readonly factRevision: number;
  readonly facts: readonly TradeFact[];
}

export interface ConfirmPlanChange {
  readonly kind: 'ConfirmPlan';
  readonly accountId: string;
  readonly strategyId: string;
  readonly plan: PlanFactValue & {
    readonly legs: readonly PlannedLegInput[];
    readonly stops: readonly ConditionInput[];
    readonly targets: readonly ConditionInput[];
  };
}
