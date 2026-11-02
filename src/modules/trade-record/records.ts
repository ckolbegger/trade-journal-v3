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

// The Close Reason a terminal Position Change was recorded with (D6 A85): the Catalog identity and
// the terminal Position Change's fact identity.
export interface CloseReasonFactValue {
  readonly closeReasonId: string;
  readonly terminalPositionChangeId: string;
}

// A Trade fact identity with a single-version list (decision 11). It lives in the Trade's separate
// Close Reason list, but takes its Recorded Sequence from the Trade's single counter.
export interface CloseReasonFact {
  readonly factId: string;
  readonly kind: 'CloseReason';
  readonly recordedSequence: number;
  readonly versions: readonly { readonly versionNumber: number; readonly value: CloseReasonFactValue }[];
}

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
  // Close Reason facts, kept apart from `facts` (D6 A85, A87); absent means none, as in a Trade
  // confirmed at schema 5 and never closed.
  readonly closeReasonFacts?: readonly CloseReasonFact[];
  // Private index fields, present only on a stored Closed Trade (D6 A87): the terminal Position
  // Change's Economic Time and its descending sort key. A prepared candidate never carries them.
  readonly terminalTime?: Instant;
  readonly terminalDesc?: string;
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
  // The Catalog identity of the Close Reason, supplied by the workflow when the change is terminal
  // (D6 A85); Trade Record stores what it is given and does not require it.
  readonly closeReasonId?: string;
}
