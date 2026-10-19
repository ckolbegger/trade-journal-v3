import { describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { initialize } from "../../src/workspace";
import { passingPorts } from "../readiness/support";
import { closeWorkspace, rowsOf, workspaceFixture } from "./support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should create no Workspace, no defaults and no imported facts when the readiness gate fails, returning the cross-cutting RuntimeNotWritable branch", async () => {
    const failing = await establishReadiness(passingPorts({ capacity: async () => ({ freeBytes: 1 }) }));
    const { database, seam, ports } = await workspaceFixture({ readiness: async () => failing });

    const result = await initialize(ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });

    expect(result).toMatchObject({
      outcome: "RuntimeNotWritable",
      payload: { outcome: "RuntimeNotWritable", runtimeReadiness: "Unsupported" },
    });
    expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);
    expect(await rowsOf(seam, "journal")).toEqual([]);
    expect(await rowsOf(seam, "referenceCatalog")).toEqual([]);
    expect(seam.counters.readwriteTransactions).toBe(0);

    await closeWorkspace(database);
  });
});
