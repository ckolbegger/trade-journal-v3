import type { Clock, Instant } from "../platform/clock";
import type { ReadinessDecision } from "../persistence/indexeddb/writeGate";
import { establishReadiness, type ReadinessPorts, type ReadinessResult } from "./index";
import { toReadinessDecision, type RootObservation } from "./decision";

export type ReadinessBoundary = "launch" | "update-activation" | "restore";

export interface ReadinessReceipt {
  readonly boundary: ReadinessBoundary;
  readonly evaluatedAt: Instant;
  readonly result: ReadinessResult;
}

export interface ReadinessLedger {
  /** Re-establish every check and record a fresh receipt for this boundary. */
  evaluate(boundary: ReadinessBoundary): Promise<ReadinessReceipt>;
  /** Re-run every check immediately; the new receipt replaces the current decision. */
  invalidate(): Promise<ReadinessReceipt>;
  current(): ReadinessReceipt | undefined;
  receipts(): readonly ReadinessReceipt[];
  /** A fresh decision for the persistence write gate; never a cached verdict. */
  decision(): Promise<ReadinessDecision>;
}

export function createReadinessLedger(
  ports: ReadinessPorts,
  clock: Clock,
  observeRoot: () => Promise<RootObservation>,
): ReadinessLedger {
  const history: ReadinessReceipt[] = [];

  async function evaluate(boundary: ReadinessBoundary): Promise<ReadinessReceipt> {
    const receipt: ReadinessReceipt = {
      boundary,
      evaluatedAt: clock.now(),
      result: await establishReadiness(ports),
    };
    history.push(receipt);
    return receipt;
  }

  async function invalidate(): Promise<ReadinessReceipt> {
    return evaluate("launch");
  }

  async function decision(): Promise<ReadinessDecision> {
    const fresh = await establishReadiness(ports);
    const receipt: ReadinessReceipt = {
      boundary: "launch",
      evaluatedAt: clock.now(),
      result: fresh,
    };
    return toReadinessDecision(receipt, await observeRoot());
  }

  return {
    evaluate,
    invalidate,
    current: () => history[history.length - 1],
    receipts: () => history,
    decision,
  };
}
