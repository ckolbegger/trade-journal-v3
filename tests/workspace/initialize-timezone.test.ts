import { describe, expect, it } from "vitest";
import { initialize } from "../../src/workspace";
import { closeWorkspace, rowsOf, workspaceFixture } from "./support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should return Time Zone Selection Required when the optional first-run time zone is absent, and never write a guessed time zone", async () => {
    const { database, seam, ports } = await workspaceFixture();

    const result = await initialize(ports, { openingInstant: "2026-10-20T14:00:00.000Z" });

    expect(result).toEqual({ outcome: "TimeZoneSelectionRequired" });
    expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);
    expect(await rowsOf(seam, "journal")).toEqual([]);

    await closeWorkspace(database);
  });
});
