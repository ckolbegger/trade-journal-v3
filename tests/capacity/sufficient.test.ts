import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum, evaluateCapacity } from "../../src/capacity";

describe("capacity derivation derives a minimum from the mature workload and judges the host against it fairly", () => {
  it("should pass the check when the host reports free capacity at or above the derived minimum, returning the observed value and the derived minimum as evidence", () => {
    const derived = deriveMinimum(MATURE_WORKLOAD);

    const result = evaluateCapacity(derived, { freeBytes: derived.bytes });

    expect(result.outcome).toBe("Sufficient");
    if (result.outcome === "Sufficient") {
      expect(result.evidence.derivedMinimumBytes).toBe(derived.bytes);
      expect(result.evidence.observedFreeBytes).toBe(derived.bytes);
      expect(result.evidence.shortfallBytes).toBeUndefined();
      expect(result.evidence.migrationHeadroomBytes).toBeGreaterThan(0);
      expect(result.evidence.backupHeadroomBytes).toBeGreaterThan(0);
      expect(result.evidence.terms).toHaveLength(7);
    }
  });
});
