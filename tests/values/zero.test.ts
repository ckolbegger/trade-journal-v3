import { describe, expect, it } from "vitest";
import { money, subtractMoney } from "../../src/values";
import { value } from "./support";

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  it("should classify a cancelling difference as exactly zero and never as negative zero, so equality against a constructed zero Money is stable", () => {
    const five = value(money({ amount: "5.00", currency: "USD" }));
    const zero = value(money({ amount: "0", currency: "USD" }));

    const difference = subtractMoney(five, five);

    expect(difference).toEqual({ ok: true, value: { amount: "0", currency: "USD" } });
    expect(difference).toEqual({ ok: true, value: zero });
  });
});
