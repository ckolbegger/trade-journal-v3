import { describe, expect, it } from "vitest";
import {
  closureProblems,
  installedCapabilities,
  type InstalledOperation,
} from "../../src/capability/manifest";

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
});
