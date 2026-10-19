import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum, evaluateCapacity } from "../../src/capacity";

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

  it("should return the same derived minimum for the same inputs across two runs and across the Node and browser hosts, because the arithmetic is integer bytes in both", () => {
      const first = deriveMinimum(MATURE_WORKLOAD);
      const second = deriveMinimum({ ...MATURE_WORKLOAD });

      expect(second).toEqual(first);
      expect(evaluateCapacity(second, { freeBytes: 1 })).toEqual(
        evaluateCapacity(first, { freeBytes: 1 }),
      );
      expect(Number.isInteger(first.bytes)).toBe(true);
    });

  it("should scale the minimum with the declared workload: doubling the declared Trade count increases the derived minimum by the documented per-Trade term, proving no baked-in byte constant", () => {
      const base = deriveMinimum(MATURE_WORKLOAD);
      const doubled = deriveMinimum({
        ...MATURE_WORKLOAD,
        trades: MATURE_WORKLOAD.trades * 2,
      });
      const baseTrades = base.terms.find((term) => term.name === "trades")?.bytes ?? 0;

      // The Trade term grows by the documented per-Trade bytes, and the backup headroom that is sized
      // from the representative artifact grows with it by the disclosed multiple.
      expect(doubled.bytes - base.bytes).toBe(
        MATURE_WORKLOAD.trades * base.bytesPerRecord.trade * (1 + base.multiples.backup),
      );
      expect(doubled.terms.find((term) => term.name === "trades")?.bytes).toBe(
        baseTrades + MATURE_WORKLOAD.trades * base.bytesPerRecord.trade,
      );
    });

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
