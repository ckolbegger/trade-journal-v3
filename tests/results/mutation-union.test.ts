import { describe, expect, it } from "vitest";
import {
  MUTATION_OUTCOMES,
  assertNever,
  isRuntimeNotWritable,
  runtimeNotWritable,
  type CalculationAvailability,
  type MutationResult,
} from "../../src/results";

function describeAvailability(availability: CalculationAvailability<number>): string {
  switch (availability.outcome) {
    case "Value":
      return `value ${availability.value}`;
    case "Unbounded":
      return `unbounded ${availability.direction}`;
    case "Unavailable":
      return `unavailable ${availability.reason}`;
    case "NotApplicable":
      return `not applicable ${availability.reason}`;
    default:
      return assertNever(availability);
  }
}

describe("the shared RuntimeNotWritable branch and result conventions behave identically at every construction site", () => {
  it("should place exactly one cross-cutting RuntimeNotWritable member alongside the command-specific members of a result union, so no operation-specific label replaces it", () => {
    const accepted: MutationResult<{ readonly id: string }> = {
      outcome: "Accepted",
      value: { id: "institution-1" },
    };
    const rejected: MutationResult<{ readonly id: string }> = {
      outcome: "Rejected",
      reason: "An Institution name is required.",
    };
    const conflict: MutationResult<{ readonly id: string }> = {
      outcome: "Conflict",
      current: { id: "institution-2" },
    };
    const safety = runtimeNotWritable({
      runtimeReadiness: "Unsupported",
      failedChecks: [{ check: "capacity", detail: "insufficient" }],
    });

    const results: MutationResult<{ readonly id: string }>[] = [
      accepted,
      rejected,
      conflict,
      safety,
    ];

    expect(results.filter(isRuntimeNotWritable)).toHaveLength(1);
    expect(MUTATION_OUTCOMES.filter((outcome) => outcome === "RuntimeNotWritable")).toHaveLength(1);
    expect(describeAvailability({ outcome: "Value", value: 42 })).toBe("value 42");
    expect(describeAvailability({ outcome: "Unbounded", direction: "above", explanation: "" })).toBe(
      "unbounded above",
    );
    expect(
      describeAvailability({ outcome: "Unavailable", reason: "no mark", details: {} }),
    ).toBe("unavailable no mark");
    expect(
      describeAvailability({ outcome: "NotApplicable", reason: "flat", details: {} }),
    ).toBe("not applicable flat");
  });
});
