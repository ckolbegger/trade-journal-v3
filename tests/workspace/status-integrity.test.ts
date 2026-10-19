import { describe, expect, it } from "vitest";
import { getStatus } from "../../src/workspace/status";
import { statusPorts } from "./status-support";

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Integrity Blocked with the underlying readiness evidence and safe actions when a known or possible existing root cannot be read or validated", async () => {
    const status = await getStatus(await statusPorts({ root: async () => "unreadable" }));

    expect(status).toMatchObject({ outcome: "IntegrityBlocked", readiness: { outcome: "Writable" } });
    expect(status.safetyActions.map((action) => action.id)).toEqual(["recovery-guidance", "retry"]);
  });

  it("should never treat a failed or ambiguous store read as an empty store, returning Integrity Blocked rather than Initialization Required", async () => {
    const status = await getStatus(
      await statusPorts({
        readWorkspace: async () => ({ outcome: "Unreadable", detail: "the store read threw" }),
      }),
    );

    expect(status.outcome).toBe("IntegrityBlocked");
    expect(status.outcome).not.toBe("InitializationRequired");
  });
});
