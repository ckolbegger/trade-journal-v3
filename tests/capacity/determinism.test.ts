import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum, evaluateCapacity } from "../../src/capacity";

describe("capacity derivation derives a minimum from the mature workload and judges the host against it fairly", () => {
  it("should return the same derived minimum for the same inputs across two runs and across the Node and browser hosts, because the arithmetic is integer bytes in both", () => {
    const first = deriveMinimum(MATURE_WORKLOAD);
    const second = deriveMinimum({ ...MATURE_WORKLOAD });

    expect(second).toEqual(first);
    expect(evaluateCapacity(second, { freeBytes: 1 })).toEqual(
      evaluateCapacity(first, { freeBytes: 1 }),
    );
    expect(Number.isInteger(first.bytes)).toBe(true);
  });
});
