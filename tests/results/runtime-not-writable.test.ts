import { describe, expect, it } from "vitest";
import { runtimeNotWritable } from "../../src/results";

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should construct a RuntimeNotWritable carrying runtimeReadiness Unsupported, every supplied failed check, workspaceStatus None and the ordered safe actions when the caller supplies them", () => {
    const failedChecks = [
      { check: "capacity" as const, detail: "free capacity 1 byte, minimum 2" },
      { check: "service-worker-control" as const, detail: "no worker controls the page" },
      { check: "offline-release-inventory" as const, detail: "asset /app.js is missing" },
    ];
    const safeActions = [
      { id: "retry" as const, explanation: "Retry the readiness check." },
      { id: "try-another-browser" as const, explanation: "Try another browser." },
    ];

    const payload = runtimeNotWritable({
      runtimeReadiness: "Unsupported",
      failedChecks,
      safeActions,
    });

    expect(payload.runtimeReadiness).toBe("Unsupported");
    expect(payload.failedChecks).toEqual(failedChecks);
    expect(payload.workspaceStatus).toBe("None");
    expect(payload.safeActions).toEqual(safeActions);
  });

  it("should carry runtimeReadiness RecoveryOnly together with readable Workspace status and backup safe actions when an existing Workspace remains readable", () => {
    const payload = runtimeNotWritable({
      runtimeReadiness: "RecoveryOnly",
      failedChecks: [
        { check: "offline-release-inventory", detail: "asset /app.js is corrupt" },
      ],
      safeActions: [
        { id: "retry", explanation: "Retry the readiness check." },
        { id: "export-backup", explanation: "Export a backup of this Workspace." },
      ],
    });

    expect(payload.runtimeReadiness).toBe("RecoveryOnly");
    expect(payload.workspaceStatus).toBe("RecoveryOnly");
    expect(payload.safeActions).toEqual([
      { id: "retry", explanation: "Retry the readiness check." },
      { id: "export-backup", explanation: "Export a backup of this Workspace." },
    ]);
  });

  it("should return the safe actions in a stable documented order for identical inputs across two constructions, so the UI cannot render them differently between the two boundaries", () => {
    const safeActions = [
      { id: "try-another-browser" as const, explanation: "Try another browser." },
      { id: "retry" as const, explanation: "Retry the readiness check." },
      { id: "export-backup" as const, explanation: "Export a backup." },
      { id: "recovery-guidance" as const, explanation: "Follow recovery guidance." },
      { id: "request-durability" as const, explanation: "Request stronger storage." },
    ];
    const input = {
      runtimeReadiness: "Unsupported" as const,
      failedChecks: [{ check: "capacity" as const, detail: "insufficient" }],
    };

    const first = runtimeNotWritable({ ...input, safeActions });
    const second = runtimeNotWritable({ ...input, safeActions: [...safeActions].reverse() });

    expect(first.safeActions.map((action) => action.id)).toEqual([
      "retry",
      "request-durability",
      "export-backup",
      "try-another-browser",
      "recovery-guidance",
    ]);
    expect(second.safeActions).toEqual(first.safeActions);
  });
});
