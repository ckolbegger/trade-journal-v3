import { describe, expect, it } from "vitest";
import { money } from "../../src/values";

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  it("should reject construction of an authoritative Money from a JS number literal with a typed NonExactInput naming the field, so a widening conversion cannot enter the value layer", () => {
    expect(money({ amount: 0.1 + 0.2, currency: "USD" })).toEqual({
      ok: false,
      error: { kind: "NonExactInput", field: "money.amount" },
    });
  });
});
