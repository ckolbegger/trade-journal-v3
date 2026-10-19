import { describe, expect, it } from "vitest";
import { establishReadiness } from "../../src/readiness";
import { requestDurability } from "../../src/workspace/durability";
import { passingPorts } from "../readiness/support";

describe("Workspace.requestDurability reports the host's real answer and never fabricates protection", () => {
  it("should return NotImproved with currentProtection BestEffort and the host's reason when the host denies the request", async () => {
    const readiness = await establishReadiness(passingPorts());
    const result = await requestDurability({
      protection: async () => ({ kind: "BestEffort", reason: "browsers may clear this data" }),
      requestDurability: async () => ({ kind: "Denied", reason: "the host denied the request" }),
      readiness: async () => readiness,
    });

    expect(result).toMatchObject({
      outcome: "NotImproved",
      currentProtection: { kind: "BestEffort", reason: "browsers may clear this data" },
    });
  });
});
