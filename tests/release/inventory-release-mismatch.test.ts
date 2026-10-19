import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture } from "./support";

describe("Offline Release Inventory validation reports completeness and per-entry digest truth without a network", () => {
  it("should fail when the running release identity differs from the inventory's release identity, even if every listed asset is present", async () => {
    const fixture = await inventoryFixture({
      "/index.html": "<h1>Trade Journal</h1>",
      "/assets/app.js": "console.log('release');",
    });

    const result = await validateReleaseInventory(fixture.host, {
      expectedReleaseId: "1".repeat(64),
    });

    expect(result.outcome).toBe("Incomplete");
    if (result.outcome === "Incomplete") {
      expect(result.failures).toEqual([
        {
          kind: "ReleaseMismatch",
          detail: "the running release identity differs from the inventory's release identity",
          runningReleaseId: "1".repeat(64),
          inventoryReleaseId: fixture.releaseId,
        },
      ]);
    }
  });
});
