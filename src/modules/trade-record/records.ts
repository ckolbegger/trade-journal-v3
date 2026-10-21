import type { ConditionInput, ExecutionFact, LifecycleState, PlannedLegInput, RecordedDeviation } from '../../domain/trade-analysis/index.ts';
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
  | { readonly kind: 'Target'; readonly value: ConditionInput }
  | { readonly kind: 'PositionChange'; readonly value: PositionChangeFactValue }
  | { readonly kind: 'Execution'; readonly value: ExecutionFactValue };

// One fill as submitted and stored: action, Instrument, quantity, price, fee, its own Economic
// Time, and its Planned-Leg intent (D2 A18).
export type ExecutionFactValue = Omit<ExecutionFact, 'factId' | 'recordedSequence'>;

// One decision grouping its members (D2 A21): its Economic Time is its earliest member's (A19).
export interface PositionChangeFactValue {
  readonly economicTime: Instant;
  readonly originTradeId: string;
  readonly participatingTradeIds: readonly string[];
  readonly memberIds: readonly string[];
}

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
  // The last Recorded Sequence assigned in this Trade (D2 A20); Trades confirmed before it existed
  // continue after their highest one.
  readonly recordedSequenceCounter?: number;
  // The latest Economic Time among the Plan and effective Position Changes (D2 A27).
  readonly lastActivity?: Instant;
  // Recorded Deviation occurrences, each a stable identity with its version list (D2 A26).
  readonly deviations?: readonly RecordedDeviation[];
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

// Records one decision's Executions on one Trade, against the FactRevision the caller read.
export interface PositionChangeChange {
  readonly kind: 'PositionChange';
  readonly tradeId: string;
  readonly expectedFactRevision: number;
  readonly executions: readonly ExecutionFactValue[];
}
