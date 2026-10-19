import { describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { initialize } from "../../src/workspace";
import { passingPorts } from "../readiness/support";
import { closeWorkspace, workspaceFixture } from "./support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should carry Recovery Only with readable status and backup safe actions when a readable root exists but a check failed, and Unsupported with every failed check and safe retry actions when no readable root exists", async () => {
    const failing = await establishReadiness(passingPorts({ capacity: async () => ({ freeBytes: 1 }) }));

    const readable = await workspaceFixture({ readiness: async () => failing, root: async () => "readable" });
    const recovery = await initialize(readable.ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });
    expect(recovery).toMatchObject({
      outcome: "RuntimeNotWritable",
      payload: {
        runtimeReadiness: "RecoveryOnly",
        workspaceStatus: "RecoveryOnly",
        failedChecks: [{ check: "capacity" }],
      },
    });
    if (recovery.outcome === "RuntimeNotWritable") {
      expect(recovery.payload.safeActions.map((action) => action.id)).toContain("export-backup");
    }
    await closeWorkspace(readable.database);

    const absent = await workspaceFixture({ readiness: async () => failing, root: async () => "absent" });
    const unsupported = await initialize(absent.ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });
    expect(unsupported).toMatchObject({
      outcome: "RuntimeNotWritable",
      payload: { runtimeReadiness: "Unsupported", workspaceStatus: "None" },
    });
    if (unsupported.outcome === "RuntimeNotWritable") {
      expect(unsupported.payload.safeActions.map((action) => action.id)).toEqual([
        "retry",
        "try-another-browser",
      ]);
    }
    await closeWorkspace(absent.database);
  });
});
