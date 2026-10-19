import { describe, expect, it } from "vitest";
import { addMoney, money, subtractMoney } from "../../src/values";
import { value } from "./support";

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  it("should reject an operation mixing two currencies with a typed CurrencyMismatch and produce no result value", () => {
    const usd = value(money({ amount: "1", currency: "USD" }));
    const eur = value(money({ amount: "2", currency: "EUR" }));

    expect(addMoney(usd, eur)).toEqual({
      ok: false,
      error: { kind: "CurrencyMismatch", left: "USD", right: "EUR" },
    });
    expect(subtractMoney(usd, eur)).toEqual({
      ok: false,
      error: { kind: "CurrencyMismatch", left: "USD", right: "EUR" },
    });
  });
});
