import {
  runtimeNotWritable,
  type ReadinessCheckId,
  type ReadinessOutcome,
  type RuntimeNotWritable,
  type SafeActionId,
  type WorkspaceStatusBranch,
} from "./index";

export interface RuntimeNotWritableRecord {
  readonly outcome: "RuntimeNotWritable";
  readonly runtimeReadiness: ReadinessOutcome;
  readonly failedChecks: readonly {
    readonly check: ReadinessCheckId;
    readonly detail: string;
  }[];
  readonly workspaceStatus: WorkspaceStatusBranch;
  readonly safeActions: readonly { readonly id: SafeActionId; readonly explanation: string }[];
}

export function encodeRuntimeNotWritable(
  payload: RuntimeNotWritable,
): RuntimeNotWritableRecord {
  return {
    outcome: payload.outcome,
    runtimeReadiness: payload.runtimeReadiness,
    failedChecks: payload.failedChecks.map((failure) => ({
      check: failure.check,
      detail: failure.detail,
    })),
    workspaceStatus: payload.workspaceStatus,
    safeActions: payload.safeActions.map((action) => ({
      id: action.id,
      explanation: action.explanation,
    })),
  };
}

export function decodeRuntimeNotWritable(record: RuntimeNotWritableRecord): RuntimeNotWritable {
  return runtimeNotWritable({
    runtimeReadiness: record.runtimeReadiness,
    failedChecks: record.failedChecks,
    workspaceStatus: record.workspaceStatus,
    safeActions: record.safeActions,
  });
}
