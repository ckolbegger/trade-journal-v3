import { describe, expect, it } from "vitest";
import { isRuntimeNotWritable, runtimeNotWritable } from "../../src/results";

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should answer the isRuntimeNotWritable discriminator positively for the safety branch and negatively for a typed trader rejection, so no caller can classify an operational failure as trader behaviour", () => {
    const safety = runtimeNotWritable({
      runtimeReadiness: "Unsupported",
      failedChecks: [{ check: "diagnostic-transaction", detail: "the store did not open" }],
    });
    const traderRejection = { outcome: "Rejected", reason: "An Institution name is required." };

    expect(isRuntimeNotWritable(safety)).toBe(true);
    expect(isRuntimeNotWritable(traderRejection)).toBe(false);
    expect(isRuntimeNotWritable(null)).toBe(false);
    expect(isRuntimeNotWritable("RuntimeNotWritable")).toBe(false);
  });
});
