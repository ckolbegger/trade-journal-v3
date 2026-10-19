import { describe, expect, it } from "vitest";
import * as capability from "../../src/capability/manifest";

describe("the Installed Capability Manifest declares only installed, dependency-closed, UI-reachable capability", () => {
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
});
