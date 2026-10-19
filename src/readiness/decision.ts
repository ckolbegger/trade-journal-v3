import type { ReadinessDecision } from "../persistence/indexeddb/writeGate";
import type { ReadinessReceipt } from "./lifecycle";

/** What the caller knows about the existing storage root, independent of the four checks. */
export type RootObservation = "absent" | "readable" | "unreadable";

export function toReadinessDecision(
  receipt: ReadinessReceipt,
  root: RootObservation,
): ReadinessDecision {
  const result = receipt.result;
  if (result.outcome === "Writable") {
    return { outcome: "Writable", failedChecks: [] };
  }
  if (root === "unreadable") {
    return {
      outcome: "Unsupported",
      failedChecks: result.failedChecks,
      existingRootUnreadable: true,
      safeActions: result.safeActions,
    };
  }
  return {
    outcome: root === "readable" ? "RecoveryOnly" : "Unsupported",
    failedChecks: result.failedChecks,
    safeActions: result.safeActions,
  };
}
