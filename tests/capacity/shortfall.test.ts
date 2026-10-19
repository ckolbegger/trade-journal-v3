import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum, evaluateCapacity } from "../../src/capacity";

describe("capacity derivation derives a minimum from the mature workload and judges the host against it fairly", () => {
  it("should fail the check naming the derived minimum, the observed free capacity and the shortfall when the host reports less", () => {
    const derived = deriveMinimum(MATURE_WORKLOAD);
    const observed = derived.bytes - 1234;

    const result = evaluateCapacity(derived, { freeBytes: observed });

    expect(result.outcome).toBe("Insufficient");
    if (result.outcome === "Insufficient") {
      expect(result.evidence.derivedMinimumBytes).toBe(derived.bytes);
      expect(result.evidence.observedFreeBytes).toBe(observed);
      expect(result.evidence.shortfallBytes).toBe(1234);
    }
  });
});
