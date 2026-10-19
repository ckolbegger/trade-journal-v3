import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture } from "./support";

describe("Offline Release Inventory validation reports completeness and per-entry digest truth without a network", () => {
  it("should report complete and digest-valid with the inventory identity and list digest when every listed asset is cached and every digest matches", async () => {
    const fixture = await inventoryFixture({
      "/index.html": "<!doctype html><h1>Trade Journal</h1>",
      "/assets/app.js": "console.log('release');",
    });

    const result = await validateReleaseInventory(fixture.host);

    expect(result).toEqual({
      outcome: "Complete",
      releaseId: fixture.releaseId,
      listDigest: fixture.listDigest,
      verifiedEntries: 2,
      evidence: {
        inventoryUrl: "/release-inventory.json",
        releaseId: fixture.releaseId,
        listDigest: fixture.listDigest,
        entries: 2,
      },
    });
  });
});
