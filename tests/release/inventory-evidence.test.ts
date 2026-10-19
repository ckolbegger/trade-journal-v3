import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture } from "./support";

describe("Offline Release Inventory validation reports completeness and per-entry digest truth without a network", () => {
  it("should expose the validated inventory identity and list digest as readiness evidence so the fourth readiness check records what it verified", async () => {
    const fixture = await inventoryFixture({
      "/index.html": "<h1>Trade Journal</h1>",
      "/assets/app.js": "console.log('release');",
      "/assets/style.css": "body { margin: 0; }",
    });

    const result = await validateReleaseInventory(fixture.host, {
      expectedReleaseId: fixture.releaseId,
    });

    expect(result.outcome).toBe("Complete");
    if (result.outcome === "Complete") {
      expect(result.evidence).toEqual({
        inventoryUrl: "/release-inventory.json",
        releaseId: fixture.releaseId,
        listDigest: fixture.listDigest,
        entries: 3,
      });
      expect(result.verifiedEntries).toBe(3);
      expect(result.releaseId).toBe(fixture.releaseId);
      expect(result.listDigest).toBe(fixture.listDigest);
    }
  });
});
