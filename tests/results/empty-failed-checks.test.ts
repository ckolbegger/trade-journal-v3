import { describe, expect, it } from "vitest";
import { ResultConventionError, runtimeNotWritable } from "../../src/results";

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should reject construction with an empty failed-check list with a typed programming error, so a non-writable result without a reason is not representable", () => {
    expect(() =>
      runtimeNotWritable({ runtimeReadiness: "Unsupported", failedChecks: [] }),
    ).toThrow(ResultConventionError);

    let caught: unknown;
    try {
      runtimeNotWritable({ runtimeReadiness: "Unsupported", failedChecks: [] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ResultConventionError);
    expect((caught as ResultConventionError).kind).toBe(
      "RuntimeNotWritableRequiresFailedCheck",
    );
  });
});
