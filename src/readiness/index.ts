import {
  MATURE_WORKLOAD,
  deriveMinimum,
  evaluateCapacity,
  type CapacityEvidence,
  type ObservedCapacity,
} from "../capacity";
import type { DiagnosticTransactionResult } from "../persistence/indexeddb/diagnostic";
import type { StorageProtection, WorkerControl } from "../platform/host";
import type { InventoryValidation } from "../release/inventory";
import type { ReadinessCheckId, RuntimeReadinessFailure, SafeAction } from "../results";

/** The four functional checks, plus the advisory protection report, supplied by the caller. */
export interface ReadinessPorts {
  diagnostic(): Promise<DiagnosticTransactionResult>;
  capacity(): Promise<ObservedCapacity>;
  workerControl(): Promise<WorkerControl>;
  inventory(expectedReleaseId: string | undefined): Promise<InventoryValidation>;
  protection(): Promise<StorageProtection>;
}

export interface ReadinessRequest {
  /** The release the application believes it is; otherwise the inventory's identity is used. */
  readonly intendedReleaseId?: string;
}

export interface ReadinessCheckEvidence {
  readonly check: ReadinessCheckId;
  readonly outcome: "Passed" | "Failed";
  readonly detail: string;
}

export interface ReadinessEvidence {
  readonly diagnostic: DiagnosticTransactionResult;
  readonly capacity: CapacityEvidence;
  readonly workerControl: WorkerControl;
  readonly inventory: InventoryValidation;
  readonly protection: StorageProtection;
}

export interface ReadinessResult {
  readonly outcome: "Writable" | "Unsupported";
  readonly checks: readonly ReadinessCheckEvidence[];
  readonly failedChecks: readonly RuntimeReadinessFailure[];
  readonly safeActions: readonly SafeAction[];
  readonly protection: StorageProtection;
  readonly notProtectedWarning: boolean;
  readonly intendedReleaseId?: string;
  readonly evidence: ReadinessEvidence;
}

export const NOT_PROTECTED_WARNING =
  "The browser may clear this data. Export a backup, and request stronger storage where the browser allows it.";

function diagnosticCheck(result: DiagnosticTransactionResult): ReadinessCheckEvidence {
  return result.outcome === "Passed"
    ? { check: "diagnostic-transaction", outcome: "Passed", detail: "the isolated diagnostic transaction committed" }
    : {
        check: "diagnostic-transaction",
        outcome: "Failed",
        detail: `the isolated diagnostic transaction failed: ${result.detail}`,
      };
}

function capacityCheck(capacity: ReturnType<typeof evaluateCapacity>): ReadinessCheckEvidence {
  if (capacity.outcome === "Sufficient") {
    return {
      check: "capacity",
      outcome: "Passed",
      detail: `free capacity ${capacity.evidence.observedFreeBytes ?? 0} meets the derived minimum ${capacity.evidence.derivedMinimumBytes}`,
    };
  }
  if (capacity.outcome === "Insufficient") {
    return {
      check: "capacity",
      outcome: "Failed",
      detail: `free capacity ${capacity.evidence.observedFreeBytes ?? 0} is below the derived minimum ${capacity.evidence.derivedMinimumBytes} by ${capacity.evidence.shortfallBytes ?? 0} bytes`,
    };
  }
  return {
    check: "capacity",
    outcome: "Failed",
    detail: `capacity could not be measured: ${capacity.reason}`,
  };
}

function workerCheck(control: WorkerControl, intendedReleaseId: string | undefined): ReadinessCheckEvidence {
  if (control.kind === "NotExposed") {
    return {
      check: "service-worker-control",
      outcome: "Failed",
      detail: "the host does not expose service-worker control",
    };
  }
  if (control.kind === "NotControlled") {
    return {
      check: "service-worker-control",
      outcome: "Failed",
      detail:
        intendedReleaseId === undefined
          ? control.reason
          : `the intended release ${intendedReleaseId} does not control this page`,
    };
  }
  if (intendedReleaseId !== undefined && control.releaseId !== intendedReleaseId) {
    return {
      check: "service-worker-control",
      outcome: "Failed",
      detail:
        control.releaseId === undefined
          ? `the controlling worker did not confirm the intended release ${intendedReleaseId}`
          : `the controlling release ${control.releaseId} is not the intended release ${intendedReleaseId}`,
    };
  }
  return {
    check: "service-worker-control",
    outcome: "Passed",
    detail: `the intended release ${intendedReleaseId ?? "controls"} controls this page`,
  };
}

function inventoryDetail(inventory: InventoryValidation): string {
  if (inventory.outcome === "Complete") return `all ${inventory.verifiedEntries} inventory entries verified`;
  return inventory.failures
    .map((failure) => {
      if (failure.kind === "Missing") return `missing ${failure.assetUrl}`;
      if (failure.kind === "Corrupt") return `corrupt ${failure.assetUrl}`;
      if (failure.kind === "ReleaseMismatch") {
        return `release mismatch: running ${failure.runningReleaseId}, inventory ${failure.inventoryReleaseId}`;
      }
      return failure.detail;
    })
    .join("; ");
}

function inventoryCheck(inventory: InventoryValidation): ReadinessCheckEvidence {
  return {
    check: "offline-release-inventory",
    outcome: inventory.outcome === "Complete" ? "Passed" : "Failed",
    detail: inventoryDetail(inventory),
  };
}

function safeActionsFor(failed: readonly RuntimeReadinessFailure[]): SafeAction[] {
  if (failed.length === 0) return [];
  const actions: SafeAction[] = [];
  const checks = new Set(failed.map((failure) => failure.check));
  if (checks.has("diagnostic-transaction") || checks.has("capacity") || checks.has("offline-release-inventory")) {
    actions.push({ id: "retry", explanation: "Retry the readiness checks." });
  }
  actions.push({
    id: "try-another-browser",
    explanation: "Try another browser; another browser has separate storage.",
  });
  return actions;
}

function protectionOf(protection: StorageProtection): StorageProtection {
  return protection.kind === "NotExposed"
    ? { kind: "Unavailable", reason: "The host does not expose storage protection." }
    : protection;
}

/**
 * Decide Runtime Readiness from the four functional checks only. Every check always runs, so a
 * simultaneous failure reports every failed check. Protection is reported alongside and never
 * changes the outcome.
 */
export async function establishReadiness(
  ports: ReadinessPorts,
  request: ReadinessRequest = {},
): Promise<ReadinessResult> {
  const protection = protectionOf(await ports.protection());
  const diagnostic = await ports.diagnostic();
  const capacity = evaluateCapacity(deriveMinimum(MATURE_WORKLOAD), await ports.capacity());
  const inventory = await ports.inventory(request.intendedReleaseId);
  const workerControl = await ports.workerControl();
  const intendedReleaseId = request.intendedReleaseId ?? inventory.releaseId;

  const checks: ReadinessCheckEvidence[] = [
    diagnosticCheck(diagnostic),
    capacityCheck(capacity),
    workerCheck(workerControl, intendedReleaseId),
    inventoryCheck(inventory),
  ];
  const failedChecks: RuntimeReadinessFailure[] = checks
    .filter((check) => check.outcome === "Failed")
    .map((check) => ({ check: check.check, detail: check.detail }));

  const notProtectedWarning = protection.kind !== "Protected";
  return {
    outcome: failedChecks.length === 0 ? "Writable" : "Unsupported",
    checks,
    failedChecks,
    safeActions: safeActionsFor(failedChecks),
    protection,
    notProtectedWarning,
    ...(intendedReleaseId === undefined ? {} : { intendedReleaseId }),
    evidence: { diagnostic, capacity: capacity.evidence, workerControl, inventory, protection },
  };
}
