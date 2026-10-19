import { describe, expect, it } from "vitest";
import { initialize } from "../../src/workspace";
import { closeWorkspace, rowsOf, workspaceFixture } from "./support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should carry Integrity Blocked and never fall through to fresh initialization when a known or possible existing root cannot be read", async () => {
    const { database, seam, ports } = await workspaceFixture({ root: async () => "unreadable" });

    const result = await initialize(ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });

    expect(result).toMatchObject({ outcome: "IntegrityBlocked" });
    if (result.outcome === "IntegrityBlocked") {
      expect(result.recoveryActions.map((action) => action.id)).toEqual([
        "recovery-guidance",
        "retry",
      ]);
    }
    expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);

    await closeWorkspace(database);
  });

  it("should return Integrity Blocked with recovery actions when readiness passed but stored contents fail integrity validation", async () => {
    const { database, seam, ports } = await workspaceFixture({
      validateStoredContents: async () => "stored contents do not agree with their facts",
    });

    const result = await initialize(ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });

    expect(result).toMatchObject({
      outcome: "IntegrityBlocked",
      detail: "stored contents do not agree with their facts",
    });
    expect(await rowsOf(seam, "workspaceMeta")).toEqual([]);

    await closeWorkspace(database);
  });
});
