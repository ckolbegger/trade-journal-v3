import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture, removeBytes, replaceBytes } from "./support";

describe("Offline Release Inventory validation reports completeness and per-entry digest truth without a network", () => {
  it("should report every failed entry rather than the first one when several assets are missing or corrupt", async () => {
    const fixture = await inventoryFixture({
      "/index.html": "<h1>Trade Journal</h1>",
      "/assets/app.js": "console.log('release');",
      "/assets/style.css": "body { margin: 0; }",
      "/icons/icon.svg": "<svg></svg>",
    });
    removeBytes(fixture, "/index.html");
    removeBytes(fixture, "/icons/icon.svg");
    replaceBytes(fixture, "/assets/app.js", "tampered");

    const result = await validateReleaseInventory(fixture.host);

    expect(result.outcome).toBe("Incomplete");
    if (result.outcome === "Incomplete") {
      expect(result.failures.map((failure) => failure.kind).sort()).toEqual([
        "Corrupt",
        "Missing",
        "Missing",
      ]);
      expect(result.failures.map((failure) => (failure as { assetUrl?: string }).assetUrl).sort()).toEqual([
        "/assets/app.js",
        "/icons/icon.svg",
        "/index.html",
      ]);
    }
  });
});
