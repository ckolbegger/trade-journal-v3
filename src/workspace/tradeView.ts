import type { LifecycleStateName, PlanBaseline, PlannedLeg, PlanCondition } from "../plan";
import type { Money } from "../values";

/**
 * The read model the Trade view renders. Every value is a stored fact or an explicitly derived state;
 * the view never recomputes analysis and never presents a stored/derived disagreement as agreement.
 */
export interface TradeReadModel {
  readonly tradeId: string;
  readonly factRevision: number;
  readonly accountId: string;
  readonly accountLabel: string;
  readonly strategyLabel: string;
  readonly economicTime: string;
  readonly intendedEntry: { readonly amount: string };
  readonly plannedLegs: readonly PlannedLeg[];
  readonly originalManagement: readonly PlanCondition[];
  readonly baseline: PlanBaseline;
  readonly oneR: Money;
  /** Stored, authoritative. */
  readonly storedLifecycle: LifecycleStateName;
  /** Derived expectation, reported separately from the stored value. */
  readonly expectedLifecycle: LifecycleStateName | undefined;
  readonly agreement: "agreed" | "disagreement" | "unavailable";
  readonly disagreement:
    | {
        readonly stored: LifecycleStateName;
        readonly expected: LifecycleStateName;
      }
    | undefined;
  /** The Plan Reflection Entry whose answers supply the Plan semantics. */
  readonly reflection:
    | {
        readonly entryId: string;
        readonly sourceLabel: string;
        readonly definitionRevision: number;
        readonly thesis: string;
        readonly invalidation: string;
      }
    | undefined;
}
