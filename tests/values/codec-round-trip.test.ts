import { describe, expect, it } from "vitest";
import { decodeValueRecord, encodeValueRecord } from "../../src/values/codec";
import { money, price, quantity } from "../../src/values";
import { value } from "./support";

const exactMoney = {
  amount: "1234567890.123456789012345678",
  currency: "USD",
};
const exactPrice = { amount: "0.000000000000000001" };
const exactQuantity = { amount: "0.0001", instrumentClass: "stock" as const };

describe("Money, Price and Quantity arithmetic is exact and typed at the value-layer seam", () => {
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
