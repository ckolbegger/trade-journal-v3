import { describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { getStatus } from "../../src/workspace/status";
import { passingPorts } from "../readiness/support";
import { statusPorts } from "./status-support";

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Recovery Only with readable status and safe backup actions when the Workspace is readable and readiness fails", async () => {
    const failing = await establishReadiness(
      passingPorts({ capacity: async () => ({ freeBytes: 1 }) }),
    );

    const status = await getStatus(
      await statusPorts({ readiness: async () => failing, root: async () => "readable" }),
    );

    expect(status).toMatchObject({
      outcome: "RecoveryOnly",
      readiness: { outcome: "Unsupported", failedChecks: [{ check: "capacity" }] },
      timeZone: "America/New_York",
      binding: { revision: 7 },
    });
    expect(status.safetyActions.map((action) => action.id)).toContain("export-backup");
  });

  it("should return Unsupported with the failed-check reasons when no existing root needs protection", async () => {
    const failing = await establishReadiness(
      passingPorts({ capacity: async () => ({ freeBytes: 1 }) }),
    );

    const status = await getStatus(
      await statusPorts({
        readiness: async () => failing,
        root: async () => "absent",
        readWorkspace: async () => ({ outcome: "NoWorkspace" }),
      }),
    );

    expect(status.outcome).toBe("Unsupported");
    expect(status.safetyActions.map((action) => action.id)).toEqual([
      "retry",
      "try-another-browser",
    ]);
  });
});
