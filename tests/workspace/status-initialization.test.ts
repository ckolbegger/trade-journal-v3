import { describe, expect, it } from "vitest";
import { getStatus } from "../../src/workspace/status";
import { statusPorts } from "./status-support";

describe("Workspace.getStatus reports one honest lifecycle status from readiness, root state and installed capability", () => {
  it("should return Initialization Required only when a writable store was opened successfully and proved that no Workspace exists", async () => {
    const status = await getStatus(
      await statusPorts({ readWorkspace: async () => ({ outcome: "NoWorkspace" }) }),
    );

    expect(status.outcome).toBe("InitializationRequired");
    expect(status.binding).toBeUndefined();
    expect(status.timeZone).toBeUndefined();
  });
});
