import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture, replaceBytes } from "./support";

describe("Offline Release Inventory validation reports completeness and per-entry digest truth without a network", () => {
  it("should fail naming the corrupt entry when one cached asset's bytes hash differently from its recorded digest", async () => {
    const fixture = await inventoryFixture({
      "/index.html": "<h1>Trade Journal</h1>",
      "/assets/app.js": "console.log('release');",
    });
    replaceBytes(fixture, "/assets/app.js", "console.log('tampered');");

    const result = await validateReleaseInventory(fixture.host);

    expect(result.outcome).toBe("Incomplete");
    if (result.outcome === "Incomplete") {
      expect(result.failures).toHaveLength(1);
      const failure = result.failures[0];
      expect(failure).toMatchObject({ kind: "Corrupt", assetUrl: "/assets/app.js" });
      if (failure?.kind === "Corrupt") {
        expect(failure.recorded).toMatch(/^[0-9a-f]{64}$/);
        expect(failure.observed).toMatch(/^[0-9a-f]{64}$/);
        expect(failure.observed).not.toBe(failure.recorded);
      }
    }
  });
});
