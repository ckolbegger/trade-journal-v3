import { describe, expect, it } from "vitest";
import { initialize } from "../../src/workspace";
import { closeWorkspace, rowsOf, workspaceFixture } from "./support";

describe("Workspace.initialize creates one initialized Workspace or refuses with a typed non-writable result", () => {
  it("should open the existing Workspace rather than reseeding or duplicating identities when called a second time against an initialized store", async () => {
    const { database, seam, ports } = await workspaceFixture();
    const first = await initialize(ports, {
      openingInstant: "2026-10-20T14:00:00.000Z",
      timeZone: "America/New_York",
    });
    expect(first.outcome).toBe("Opened");
    const journalBefore = JSON.stringify(await rowsOf(seam, "journal"));
    const catalogBefore = JSON.stringify(await rowsOf(seam, "referenceCatalog"));

    const second = await initialize(ports, {
      openingInstant: "2026-10-21T14:00:00.000Z",
      timeZone: "America/New_York",
    });

    expect(second.outcome).toBe("Opened");
    if (second.outcome === "Opened") {
      expect(second.receipt.fresh).toBe(false);
      expect(second.receipt.seedAdditions).toEqual([]);
      expect(second.receipt.timeZone).toBe("America/New_York");
      expect(second.onboarding).toBe("Needs Institution and Account");
    }
    expect(JSON.stringify(await rowsOf(seam, "journal"))).toBe(journalBefore);
    expect(JSON.stringify(await rowsOf(seam, "referenceCatalog"))).toBe(catalogBefore);

    await closeWorkspace(database);
  });
});
