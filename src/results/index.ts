/**
 * The shared result conventions. `RuntimeNotWritable` is the one cross-cutting branch every
 * authoritative mutation result carries (`specs/design/overview.md:177-186`), and it is an
 * operational safety result rather than trader validation.
 */
export type ReadinessCheckId =
  | "diagnostic-transaction"
  | "capacity"
  | "service-worker-control"
  | "offline-release-inventory";

export type ReadinessOutcome = "RecoveryOnly" | "Unsupported";

export type WorkspaceStatusBranch = "RecoveryOnly" | "IntegrityBlocked" | "None";

export type SafeActionId =
  | "retry"
  | "request-durability"
  | "export-backup"
  | "try-another-browser"
  | "recovery-guidance";

export interface TraderRejection {
  readonly outcome: "Rejected";
  readonly reason: string;
}

export interface TypedConflict<TCurrent> {
  readonly outcome: "Conflict";
  readonly current: TCurrent;
}

export interface Accepted<TSpecific> {
  readonly outcome: "Accepted";
  readonly value: TSpecific;
}

/** The four members every authoritative mutation result union carries, one of each. */
export const MUTATION_OUTCOMES = ["Accepted", "Rejected", "Conflict", "RuntimeNotWritable"] as const;

export type MutationOutcome = (typeof MUTATION_OUTCOMES)[number];

export type MutationResult<TSpecific, TCurrent = unknown> =
  | Accepted<TSpecific>
  | TraderRejection
  | TypedConflict<TCurrent>
  | RuntimeNotWritable;

export type CalculationAvailability<T> =
  | { readonly outcome: "Value"; readonly value: T }
  | {
      readonly outcome: "Unbounded";
      readonly direction: "above" | "below";
      readonly explanation: string;
    }
  | {
      readonly outcome: "Unavailable";
      readonly reason: string;
      readonly details: Readonly<Record<string, unknown>>;
    }
  | {
      readonly outcome: "NotApplicable";
      readonly reason: string;
      readonly details: Readonly<Record<string, unknown>>;
    };

export function assertNever(value: never): never {
  throw new Error(
    `Unhandled calculation availability: ${String((value as { outcome?: unknown }).outcome)}`,
  );
}

export interface RuntimeReadinessFailure {
  readonly check: ReadinessCheckId;
  readonly detail: string;
}

export interface SafeAction {
  readonly id: SafeActionId;
  readonly explanation: string;
}

/** The documented order in which safe actions are presented and compared. */
export const SAFE_ACTION_ORDER: readonly SafeActionId[] = [
  "retry",
  "request-durability",
  "export-backup",
  "try-another-browser",
  "recovery-guidance",
];

export interface RuntimeNotWritable {
  readonly outcome: "RuntimeNotWritable";
  readonly runtimeReadiness: ReadinessOutcome;
  readonly failedChecks: readonly RuntimeReadinessFailure[];
  readonly workspaceStatus: WorkspaceStatusBranch;
  readonly safeActions: readonly SafeAction[];
}

export interface RuntimeNotWritableInput {
  readonly runtimeReadiness: ReadinessOutcome;
  readonly failedChecks: readonly RuntimeReadinessFailure[];
  readonly workspaceStatus?: WorkspaceStatusBranch;
  /** Set when a known or possible existing root cannot be read or validated. */
  readonly existingRootUnreadable?: boolean;
  readonly safeActions?: readonly SafeAction[];
}

/** A programming error, not a trader result: the branch is not representable without a reason. */
export class ResultConventionError extends Error {
  readonly kind = "RuntimeNotWritableRequiresFailedCheck";

  constructor() {
    super("RuntimeNotWritable requires at least one failed check");
    this.name = "ResultConventionError";
  }
}

export function runtimeNotWritable(input: RuntimeNotWritableInput): RuntimeNotWritable {
  if (input.failedChecks.length === 0) throw new ResultConventionError();
  return {
    outcome: "RuntimeNotWritable",
    runtimeReadiness: input.runtimeReadiness,
    failedChecks: [...input.failedChecks],
    workspaceStatus:
      input.existingRootUnreadable === true
        ? "IntegrityBlocked"
        : (input.workspaceStatus ?? defaultWorkspaceStatus(input.runtimeReadiness)),
    safeActions: orderedSafeActions(input.safeActions ?? []),
  };
}

function orderedSafeActions(actions: readonly SafeAction[]): SafeAction[] {
  return [...actions].sort(
    (left, right) => SAFE_ACTION_ORDER.indexOf(left.id) - SAFE_ACTION_ORDER.indexOf(right.id),
  );
}

/** RecoveryOnly means an existing Workspace is readable; Unsupported without one protects nothing. */
function defaultWorkspaceStatus(readiness: ReadinessOutcome): WorkspaceStatusBranch {
  return readiness === "RecoveryOnly" ? "RecoveryOnly" : "None";
}

export function isRuntimeNotWritable(value: unknown): value is RuntimeNotWritable {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { outcome?: unknown }).outcome === "RuntimeNotWritable"
  );
}
