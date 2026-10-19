import { describe, expect, it } from "vitest";
import { installedCapabilities, selfCheck } from "../../src/capability/manifest";

describe("the Installed Capability Manifest declares only installed, dependency-closed, UI-reachable capability", () => {
  it("should make the reachable production navigation equal to its declared set for the installed release", () => {
    const manifest = installedCapabilities("release-1");
    const entryPoints = manifest.operations.map((operation) => operation.entryPoint);

    expect(selfCheck(manifest, entryPoints, manifest.navigation)).toEqual([]);
    expect(
      selfCheck(manifest, entryPoints, ["startup", "onboarding", "reports"]),
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
});
