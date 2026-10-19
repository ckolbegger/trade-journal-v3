import { describe, expect, it } from "vitest";
import { addMoney, money, positionValue, price, quantity } from "../../src/values";
import { value } from "./support";

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  it("should add two Money values of the same currency exactly, with the decimal string unchanged, when the sum exceeds the range a JS number represents without loss", () => {
    const left = value(money({ amount: "9007199254740993", currency: "USD" }));
    const right = value(money({ amount: "1", currency: "USD" }));

    expect(addMoney(left, right)).toEqual({
      ok: true,
      value: { amount: "9007199254740994", currency: "USD" },
    });
  });

  it("should compute a position value from Quantity and Price at the declared scale with no implicit rounding when the price carries more decimal places than the display scale", () => {
    const shares = value(quantity({ amount: "3", instrumentClass: "stock" }));
    const sharePrice = value(price({ amount: "10.125" }));

    expect(positionValue(shares, sharePrice, "USD")).toEqual({
      ok: true,
      value: { amount: "30.375", currency: "USD" },
    });
  });
});
