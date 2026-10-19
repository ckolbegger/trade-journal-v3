import { describe, expect, it } from "vitest";
import { validateReleaseInventory } from "../../src/release/inventory";
import { inventoryFixture, replaceBytes, INVENTORY_URL, removeBytes } from "../support/release";

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
