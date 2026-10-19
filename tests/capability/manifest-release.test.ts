import { describe, expect, it } from "vitest";
import { assertManifestRelease, installedCapabilities } from "../../src/capability/manifest";

describe("the Installed Capability Manifest declares only installed, dependency-closed, UI-reachable capability", () => {
  it("should be bound to the installed release identity so a stale manifest cannot be read after an update activates", () => {
    const first = installedCapabilities("release-a");
    const second = installedCapabilities("release-b");

    expect(first.releaseId).toBe("release-a");
    expect(second.releaseId).toBe("release-b");
    expect(() => assertManifestRelease(first, "release-a")).not.toThrow();
    expect(() => assertManifestRelease(first, "release-b")).toThrow(/release-a/);
  });
});
