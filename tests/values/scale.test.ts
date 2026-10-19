import { describe, expect, it } from "vitest";
import { quantity } from "../../src/values";

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  it("should reject a Quantity carrying more scale than the instrument class allows with a typed ScaleExceeded naming the class and the offending string", () => {
    expect(quantity({ amount: "1.23456", instrumentClass: "stock" })).toEqual({
      ok: false,
      error: {
        kind: "ScaleExceeded",
        instrumentClass: "stock",
        offending: "1.23456",
        allowedScale: 4,
      },
    });

    expect(quantity({ amount: "1.5", instrumentClass: "option" })).toEqual({
      ok: false,
      error: {
        kind: "ScaleExceeded",
        instrumentClass: "option",
        offending: "1.5",
        allowedScale: 0,
      },
    });
  });
});
