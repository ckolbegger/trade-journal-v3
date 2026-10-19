import { describe, expect, it } from "vitest";
import { installedCapabilities, installedOperation } from "../../src/capability/manifest";

const LATER_CAPABILITIES = [
  "trade.confirmPlan",
  "trade.recordPositionChange",
  "journal.save",
  "marketData.saveMark",
  "dailyReview.open",
  "reports.run",
  "workspace.exportBackup",
  "workspace.prepareRestore",
];

describe("the Installed Capability Manifest declares only installed, dependency-closed, UI-reachable capability", () => {
  it("should declare exactly the D1-installed operations and variants with complete dependency closure, and omit every capability owned by a later deliverable", () => {
    const manifest = installedCapabilities("release-1");

    expect(manifest.operations.map((operation) => operation.id).sort()).toEqual([
      "journal.getDefinitions",
      "referenceCatalog.query",
      "referenceCatalog.save",
      "release.inventoryValidation",
      "runtime.readiness",
      "workspace.getStatus",
      "workspace.initialize",
      "workspace.requestDurability",
    ]);
    for (const later of LATER_CAPABILITIES) {
      expect(installedOperation(manifest, later)).toBeUndefined();
      expect(JSON.stringify(manifest)).not.toContain(later);
    }
    expect(JSON.stringify(manifest)).not.toContain("Unavailable");
  });

  it("should return absent rather than a domain-level Unavailable for an omitted operation, so a caller cannot mistake absence for a failed calculation", () => {
    const manifest = installedCapabilities("release-1");

    expect(installedOperation(manifest, "trade.confirmPlan")).toBeUndefined();
    expect(installedOperation(manifest, "reports.run")).toBeUndefined();
    expect(installedOperation(manifest, "workspace.getStatus")).toMatchObject({
      id: "workspace.getStatus",
    });
  });
});
