import type { PerConditionBasis, PlanBaseline } from "../plan";
import type { TransactionSeam } from "../persistence/indexeddb/transaction";
import type { RuntimeNotWritable } from "../results";
import type { Money } from "../values";
import { assessDraft, type ConfirmPlanConflict, type ConfirmPlanRejection } from "./assessDraft";
import type { ConfirmPlanCommand } from "./confirmPlan";

/**
 * The Plan figures the form may show before the Plan is frozen (deviation D-001). They are the
 * values confirmation will store, produced from the same assess-and-derive step, so a provisional
 * figure can never differ from the frozen one. Nothing here is durable.
 */
export interface PlanPreview {
  readonly planBaseline: PlanBaseline;
  readonly oneR: Money;
  readonly perConditionBasis: readonly PerConditionBasis[];
}

/** Everything `previewPlan` needs. Save-time audit fields are not part of a preview. */
export type PreviewPlanCommand = Omit<
  ConfirmPlanCommand,
  "saveTime" | "firstAuthoredTime" | "cutoffTradingDate"
>;

export type PlanPreviewResult =
  | { readonly outcome: "Previewed"; readonly value: PlanPreview }
  | ConfirmPlanRejection
  | ConfirmPlanConflict
  | RuntimeNotWritable;

/**
 * `previewPlan` runs the same resolve -> complete -> assess -> derive step `confirmPlan` runs at
 * commit time and returns its figures. It writes nothing: no transaction, no participant effects.
 * The prepared Journal effect is discarded.
 */
export async function previewPlan(
  seam: TransactionSeam,
  command: PreviewPlanCommand,
): Promise<PlanPreviewResult> {
  const assessed = await assessDraft(seam, command);
  if (assessed.outcome !== "Assessed") return assessed;
  const { planBaseline } = assessed.value;
  return {
    outcome: "Previewed",
    value: {
      planBaseline,
      oneR: planBaseline.oneR,
      perConditionBasis: planBaseline.perConditionBasis,
    },
  };
}
