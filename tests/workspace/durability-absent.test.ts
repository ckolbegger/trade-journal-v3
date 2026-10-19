import { describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { requestDurability } from "../../src/workspace/durability";
import { passingPorts } from "../readiness/support";

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  it("should return NotImproved with currentProtection Unavailable and a reason when the host does not expose the request at all", async () => {
    const readiness = await establishReadiness(passingPorts());
    const result = await requestDurability({
      protection: async () => ({ kind: "Unavailable", reason: "no protection API" }),
      requestDurability: async () => ({ kind: "NotExposed" }),
      readiness: async () => readiness,
    });

    expect(result).toMatchObject({
      outcome: "NotImproved",
      currentProtection: {
        kind: "Unavailable",
        reason: "The host does not expose the durability request.",
      },
    });
  });

  it("should return a typed NotImproved rather than throwing when the host API rejects with a security or permission error", async () => {
    const readiness = await establishReadiness(passingPorts());
    const result = await requestDurability({
      protection: async () => ({ kind: "BestEffort", reason: "not granted" }),
      requestDurability: async () => {
        throw new DOMException("permission denied", "SecurityError");
      },
      readiness: async () => readiness,
    });

    expect(result).toMatchObject({ outcome: "NotImproved" });
    expect(result.currentProtection.kind).not.toBe("Protected");
  });
});
