import { describe, expect, it } from "vitest";
import * as capability from "../../src/capability/manifest";
import { closureProblems, installedCapabilities, type InstalledOperation, installedOperation, selfCheck, assertManifestRelease } from "../../src/capability/manifest";

const LATER_CAPABILITIES = [
  "trade.abandonPlan",
  "trade.recordPositionChange",
  "journal.save",
  "marketData.saveMark",
  "dailyReview.open",
  "reports.run",
  "workspace.exportBackup",
  "workspace.prepareRestore",
];

describe("the Installed Capability Manifest declares only installed, dependency-closed, UI-reachable capability", () => {
  it("should fail naming the capability when a declared operation depends on an undeclared one", () => {
      const manifest = installedCapabilities("release-1");
      expect(closureProblems(manifest)).toEqual([]);

      const brokenOperation: InstalledOperation = {
        id: "custom.operation",
        dependencies: ["undeclared.operation"],
        entryPoint: "app.custom",
      };
      const broken = { ...manifest, operations: [...manifest.operations, brokenOperation] };

      expect(closureProblems(broken)).toEqual([
        {
          capability: "custom.operation",
          detail: "depends on the undeclared capability undeclared.operation",
        },
      ]);
    });

  it("should be immutable and not trader data: no operation in the product can toggle it and it appears in no backup section", () => {
      const manifest = capability.installedCapabilities("release-1");

      expect(Object.isFrozen(manifest)).toBe(true);
      expect(Object.isFrozen(manifest.operations)).toBe(true);
      expect(() => {
        (manifest as { installSupport: string }).installSupport = "claimed";
      }).toThrow();
      expect(Object.keys(capability).some((name) => /toggle|enable|disable|set/i.test(name))).toBe(
        false,
      );
    });

  it("should declare exactly the D1-installed operations and variants with complete dependency closure, and omit every capability owned by a later deliverable", () => {
      const manifest = installedCapabilities("release-1");

      expect(manifest.operations.map((operation) => operation.id).sort()).toEqual([
        "journal.getDefinitions",
        "referenceCatalog.query",
        "referenceCatalog.save",
        "release.inventoryValidation",
        "runtime.readiness",
        "trade.confirmPlan",
        "trade.previewPlan",
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

      expect(installedOperation(manifest, "trade.abandonPlan")).toBeUndefined();
      expect(installedOperation(manifest, "reports.run")).toBeUndefined();
      expect(installedOperation(manifest, "workspace.getStatus")).toMatchObject({
        id: "workspace.getStatus",
      });
    });

  it("should declare that install support is not claimed, so no installation experience is advertised by this release", () => {
      const manifest = installedCapabilities("release-1");

      expect(manifest.installSupport).toBe("not-claimed");
    });

  it("should declare the installed backup/schema version ranges and the provider adapters actually installed, which is none for D1", () => {
      const manifest = installedCapabilities("release-1");

      expect(manifest.backup).toBe("not-installed");
      expect(manifest.schema).toEqual({ minSchemaVersion: 1, maxSchemaVersion: 2 });
      expect(manifest.providerAdapters).toEqual([]);
      expect(manifest.reportFamilies).toEqual([]);
      expect(manifest.feeApplication).toBe("not-installed");
    });

  it("should make the reachable production navigation equal to its declared set for the installed release", () => {
      const manifest = installedCapabilities("release-1");
      const entryPoints = manifest.operations.map((operation) => operation.entryPoint);

      expect(selfCheck(manifest, entryPoints, manifest.navigation)).toEqual([]);
      expect(
        selfCheck(manifest, entryPoints, ["startup", "onboarding", "plan", "trades", "reports"]),
      ).toEqual([
        {
          capability: "navigation.reports",
          detail: "the production navigation offers an undeclared destination",
        },
      ]);
    });

  it("should fail its runtime self-check, naming the capability, when it declares an operation whose production entry point is missing", () => {
      const manifest = installedCapabilities("release-1");
      const entryPoints = manifest.operations
        .map((operation) => operation.entryPoint)
        .filter((entryPoint) => entryPoint !== "app.startup.initialize");

      const problems = selfCheck(manifest, entryPoints, manifest.navigation);

      expect(problems).toEqual([
        {
          capability: "workspace.initialize",
          detail: "the production entry point app.startup.initialize is missing",
        },
      ]);
    });

  it("should be bound to the installed release identity so a stale manifest cannot be read after an update activates", () => {
      const first = installedCapabilities("release-a");
      const second = installedCapabilities("release-b");

      expect(first.releaseId).toBe("release-a");
      expect(second.releaseId).toBe("release-b");
      expect(() => assertManifestRelease(first, "release-a")).not.toThrow();
      expect(() => assertManifestRelease(first, "release-b")).toThrow(/release-a/);
    });
});
