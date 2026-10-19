import { describe, expect, it } from "vitest";
import { initialize } from "../../src/workspace";
import { closeWorkspace, rowsOf, workspaceFixture } from "./support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should return Migration Blocked with unchanged-data evidence when a supported older version fails candidate validation, leaving the prior Workspace untouched", async () => {
    const { database, seam, ports } = await workspaceFixture({
      migrate: async () => ({
        outcome: "MigrationBlocked",
        reason: "ValidationFailed",
        detail: "the journal section is incoherent",
        activeDatabaseName: "trade-journal",
      }),
    });

    const result = await initialize(ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });

    expect(result).toMatchObject({
      outcome: "MigrationBlocked",
      evidence: { priorDataUnchanged: true, detail: "the journal section is incoherent" },
    });
    expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);

    await closeWorkspace(database);
  });
});
