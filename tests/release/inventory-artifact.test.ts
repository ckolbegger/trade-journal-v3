import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture, replaceBytes, INVENTORY_URL } from "./support";

describe("Offline Release Inventory validation reports completeness and per-entry digest truth without a network", () => {
  it("should fail when the inventory artifact itself is unreadable", async () => {
    const fixture = await inventoryFixture({ "/index.html": "<h1>Trade Journal</h1>" });
    fixture.bytes.delete(INVENTORY_URL);

    const result = await validateReleaseInventory(fixture.host);

    expect(result).toMatchObject({ outcome: "Incomplete" });
    if (result.outcome === "Incomplete") {
      expect(result.failures[0]?.kind).toBe("Unreadable");
    }
  });

  it("should fail when the inventory artifact's own digest does not match the release identity", async () => {
    const fixture = await inventoryFixture({ "/index.html": "<h1>Trade Journal</h1>" });
    const tampered = {
      releaseId: fixture.releaseId,
      listDigest: "0".repeat(64),
      exclusions: ["sw.js"],
      entries: fixture.entries,
    };
    replaceBytes(fixture, INVENTORY_URL, JSON.stringify(tampered));

    const result = await validateReleaseInventory(fixture.host);

    expect(result.outcome).toBe("Incomplete");
    if (result.outcome === "Incomplete") {
      expect(result.failures.map((failure) => failure.kind)).toContain("Unreadable");
    }
  });
});
