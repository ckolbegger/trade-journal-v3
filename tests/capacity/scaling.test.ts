import { describe, expect, it } from "vitest";
import { MATURE_WORKLOAD, deriveMinimum } from "../../src/capacity";

describe("capacity derivation derives a minimum from the mature workload and judges the host against it fairly", () => {
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
});
