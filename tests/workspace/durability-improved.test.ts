import { describe, expect, it } from "vitest";
import type { StorageProtection } from "../../src/platform/host";
import { establishReadiness } from "../../src/readiness";
import { requestDurability } from "../../src/workspace/durability";
import { passingPorts } from "../readiness/support";

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  it("should return Improved with currentProtection Protected when the host grants the request", async () => {
    let protection: StorageProtection = { kind: "BestEffort", reason: "not yet granted" };
    const readiness = await establishReadiness(passingPorts());
    const result = await requestDurability({
      protection: async () => protection,
      requestDurability: async () => {
        protection = { kind: "Protected" };
        return { kind: "Granted" };
      },
      readiness: async () => readiness,
    });

    expect(result).toEqual({ outcome: "Improved", currentProtection: { kind: "Protected" } });
  });

  it("should return AlreadyProtected with currentProtection Protected when protection was already granted and no new grant is required", async () => {
    let requested = false;
    const readiness = await establishReadiness(passingPorts());
    const result = await requestDurability({
      protection: async () => ({ kind: "Protected" }),
      requestDurability: async () => {
        requested = true;
        return { kind: "Granted" };
      },
      readiness: async () => readiness,
    });

    expect(result).toEqual({ outcome: "AlreadyProtected", currentProtection: { kind: "Protected" } });
    expect(requested).toBe(false);
  });
});
