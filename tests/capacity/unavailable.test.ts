import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum, evaluateCapacity } from "../../src/capacity";

describe("capacity derivation derives a minimum from the mature workload and judges the host against it fairly", () => {
  it("should treat a host that cannot report a capacity estimate as a failed check with Unavailable evidence rather than assuming sufficient capacity", () => {
    const derived = deriveMinimum(MATURE_WORKLOAD);

    const result = evaluateCapacity(derived, {
      unavailableReason: "the host reported no quota",
    });

    expect(result).toMatchObject({
      outcome: "Unavailable",
      reason: "the host reported no quota",
      evidence: { derivedMinimumBytes: derived.bytes },
    });
    if (result.outcome === "Unavailable") {
      expect(result.evidence.observedFreeBytes).toBeUndefined();
    }
  });
});
