import { describe, expect, it } from "vitest";
import { decodeRuntimeNotWritable, encodeRuntimeNotWritable } from "../../src/results/codec";
import { runtimeNotWritable } from "../../src/results";

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should round-trip the payload through the persistence codec with workspaceStatus and safeActions preserved exactly", () => {
    const payload = runtimeNotWritable({
      runtimeReadiness: "RecoveryOnly",
      failedChecks: [
        { check: "offline-release-inventory", detail: "/app.js is missing" },
        { check: "capacity", detail: "shortfall 10" },
      ],
      safeActions: [
        { id: "export-backup", explanation: "Export a backup of this Workspace." },
        { id: "retry", explanation: "Retry the readiness check." },
      ],
    });

    const record = encodeRuntimeNotWritable(payload);
    const decoded = decodeRuntimeNotWritable(JSON.parse(JSON.stringify(record)) as typeof record);

    expect(record.workspaceStatus).toBe("RecoveryOnly");
    expect(decoded).toEqual(payload);
    expect(decoded.workspaceStatus).toBe("RecoveryOnly");
    expect(decoded.safeActions).toEqual([
      { id: "retry", explanation: "Retry the readiness check." },
      { id: "export-backup", explanation: "Export a backup of this Workspace." },
    ]);
  });
});
