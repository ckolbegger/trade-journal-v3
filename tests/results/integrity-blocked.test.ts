import { describe, expect, it } from "vitest";
import { runtimeNotWritable } from "../../src/results";

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should carry workspaceStatus IntegrityBlocked and never None when the constructor is told that a known or possible existing root could not be read", () => {
    const payload = runtimeNotWritable({
      runtimeReadiness: "Unsupported",
      failedChecks: [{ check: "diagnostic-transaction", detail: "the existing root cannot be read" }],
      workspaceStatus: "None",
      existingRootUnreadable: true,
      safeActions: [
        { id: "recovery-guidance", explanation: "Do not initialize over this storage." },
      ],
    });

    expect(payload.workspaceStatus).toBe("IntegrityBlocked");
    expect(payload.runtimeReadiness).toBe("Unsupported");
  });
});
