import { describe, expect, it } from "vitest";
import { loadSubstitutions } from "./bootstrap";

describe("the disclosed-substitution registry carries a complete entry for every substitution", () => {
  it("should give every entry a substituted component, a fidelity gap and a real-engine counterpart", () => {
    const substitutions = loadSubstitutions();
    const problems = substitutions.flatMap((entry) => {
      const missing: string[] = [];
      if (entry.substitutedComponent === "") missing.push("substitutedComponent");
      if (entry.fidelityGap === "") missing.push("gap");
      if (entry.realEngineCounterpart === "") missing.push("realEngineCounterpart");
      return missing.length > 0 ? [`${entry.id}: ${missing.join(", ")}`] : [];
    });

    expect(substitutions.length).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
