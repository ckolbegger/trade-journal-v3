import { describe, expect, it } from "vitest";
import { decodeValueRecord, encodeValueRecord } from "../../src/values/codec";
import { money, price, quantity, addMoney, subtractMoney, positionValue } from "../../src/values";
import { value } from "./support";

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  const exactMoney = {
    amount: "1234567890.123456789012345678",
    currency: "USD",
  };

  const exactPrice = { amount: "0.000000000000000001" };

  const exactQuantity = { amount: "0.0001", instrumentClass: "stock" as const };

  it("should round-trip a Money, Price and Quantity through the persistence codec with the exact decimal string preserved and no numeric coercion", () => {
      const record = encodeValueRecord({
        money: value(money(exactMoney)),
        price: value(price(exactPrice)),
        quantity: value(quantity(exactQuantity)),
      });

      const text = JSON.stringify(record);
      const decoded = decodeValueRecord(JSON.parse(text) as typeof record);

      expect(decoded).toEqual({
        ok: true,
        value: { money: exactMoney, price: exactPrice, quantity: exactQuantity },
      });
      expect(typeof record.money.amount).toBe("string");
      expect(typeof record.price.amount).toBe("string");
      expect(typeof record.quantity.amount).toBe("string");
    });
});

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

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  it("should reject construction of an authoritative Money from a JS number literal with a typed NonExactInput naming the field, so a widening conversion cannot enter the value layer", () => {
      expect(money({ amount: 0.1 + 0.2, currency: "USD" })).toEqual({
        ok: false,
        error: { kind: "NonExactInput", field: "money.amount" },
      });
    });
});

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

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
  it("should classify a cancelling difference as exactly zero and never as negative zero, so equality against a constructed zero Money is stable", () => {
      const five = value(money({ amount: "5.00", currency: "USD" }));
      const zero = value(money({ amount: "0", currency: "USD" }));

      const difference = subtractMoney(five, five);

      expect(difference).toEqual({ ok: true, value: { amount: "0", currency: "USD" } });
      expect(difference).toEqual({ ok: true, value: zero });
    });
});
