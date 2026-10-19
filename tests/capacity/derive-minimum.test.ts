import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum } from "../../src/capacity";

describe("capacity derivation derives a minimum from the mature workload and judges the host against it fairly", () => {
  it("should derive the minimum from the declared workload terms — Trade, position-changing fact, Mark, Journal and reference counts — and expose each term with its contribution when deriveMinimum is called", () => {
    const derived = deriveMinimum(MATURE_WORKLOAD);

    expect(derived.bytes).toBeGreaterThan(0);
    expect(derived.terms.map((term) => term.name)).toEqual([
      "trades",
      "positionChangingFacts",
      "marks",
      "journalEntries",
      "referenceRecords",
      "migrationHeadroom",
      "backupHeadroom",
    ]);
    expect(derived.terms.reduce((sum, term) => sum + term.bytes, 0)).toBe(derived.bytes);
    expect(derived.terms.find((term) => term.name === "trades")).toMatchObject({
      count: MATURE_WORKLOAD.trades,
      bytesPerRecord: derived.bytesPerRecord.trade,
    });
    expect(derived.terms.find((term) => term.name === "positionChangingFacts")).toMatchObject({
      count: MATURE_WORKLOAD.positionChangingFacts,
    });
  });

  it("should include backup headroom sized from the representative full-artifact size with a disclosed multiple, and migration headroom sized from the largest section rewrite, as separately named terms", () => {
    const derived = deriveMinimum(MATURE_WORKLOAD);
    const migration = derived.terms.find((term) => term.name === "migrationHeadroom");
    const backup = derived.terms.find((term) => term.name === "backupHeadroom");
    const base = derived.terms
      .filter((term) => term.name !== "migrationHeadroom" && term.name !== "backupHeadroom")
      .reduce((sum, term) => sum + term.bytes, 0);

    expect(derived.multiples).toEqual({ migration: 2, backup: 2 });
    expect(migration?.bytes).toBe(
      MATURE_WORKLOAD.positionChangingFacts * derived.bytesPerRecord.positionChangingFact * 2,
    );
    expect(backup?.bytes).toBe(base * 2);
  });

  it("should record the derived minimum, the observed capacity and the headroom terms in readiness evidence so the second check is auditable after the fact", () => {
    const derived = deriveMinimum(MATURE_WORKLOAD);
    expect(derived.workload).toEqual(MATURE_WORKLOAD);
    expect(derived.terms.every((term) => term.note.length > 0)).toBe(true);
    expect(derived.terms.every((term) => Number.isInteger(term.bytes))).toBe(true);
  });
});
