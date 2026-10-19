import { describe, expect, it } from "vitest";
import { installedCapabilities } from "../../src/capability/manifest";

describe("the Installed Capability Manifest declares only installed, dependency-closed, UI-reachable capability", () => {
  it("should declare that install support is not claimed, so no installation experience is advertised by this release", () => {
    const manifest = installedCapabilities("release-1");

    expect(manifest.installSupport).toBe("not-claimed");
  });

  it("should declare the installed backup/schema version ranges and the provider adapters actually installed, which is none for D1", () => {
    const manifest = installedCapabilities("release-1");

    expect(manifest.backup).toBe("not-installed");
    expect(manifest.schema).toEqual({ minSchemaVersion: 1, maxSchemaVersion: 1 });
    expect(manifest.providerAdapters).toEqual([]);
    expect(manifest.reportFamilies).toEqual([]);
    expect(manifest.feeApplication).toBe("not-installed");
  });
});
