import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture, removeBytes } from "./support";

describe("Offline Release Inventory validation reports completeness and per-entry digest truth without a network", () => {
  it("should fail naming the exact missing asset identities when one listed asset has no cached bytes", async () => {
    const fixture = await inventoryFixture({
      "/index.html": "<h1>Trade Journal</h1>",
      "/assets/app.js": "console.log('release');",
    });
    removeBytes(fixture, "/assets/app.js");

    const result = await validateReleaseInventory(fixture.host);

    expect(result.outcome).toBe("Incomplete");
    if (result.outcome === "Incomplete") {
      expect(result.failures).toEqual([{ kind: "Missing", assetUrl: "/assets/app.js" }]);
      expect(result.releaseId).toBe(fixture.releaseId);
    }
  });
});
