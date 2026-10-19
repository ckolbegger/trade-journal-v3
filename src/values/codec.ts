import {
  fail,
  money,
  ok,
  price,
  quantity,
  type InstrumentClass,
  type Money,
  type Price,
  type Quantity,
  type ValueResult,
} from "./index";

export interface MoneyRecord {
  readonly amount: string;
  readonly currency: string;
}

export interface PriceRecord {
  readonly amount: string;
}

export interface QuantityRecord {
  readonly amount: string;
  readonly instrumentClass: InstrumentClass;
}

export interface ValueRecord {
  readonly money: MoneyRecord;
  readonly price: PriceRecord;
  readonly quantity: QuantityRecord;
}

export interface ValueRecordValues {
  readonly money: Money;
  readonly price: Price;
  readonly quantity: Quantity;
}

export function encodeValueRecord(values: ValueRecordValues): ValueRecord {
  return {
    money: { amount: values.money.amount, currency: values.money.currency },
    price: { amount: values.price.amount },
    quantity: {
      amount: values.quantity.amount,
      instrumentClass: values.quantity.instrumentClass,
    },
  };
}

export function decodeValueRecord(record: ValueRecord): ValueResult<ValueRecordValues> {
  const decodedMoney = money({
    amount: record.money.amount,
    currency: record.money.currency,
  });
  if (!decodedMoney.ok) return fail(decodedMoney.error);

  const decodedPrice = price({ amount: record.price.amount });
  if (!decodedPrice.ok) return fail(decodedPrice.error);

  const decodedQuantity = quantity({
    amount: record.quantity.amount,
    instrumentClass: record.quantity.instrumentClass,
  });
  if (!decodedQuantity.ok) return fail(decodedQuantity.error);

  return ok({
    money: decodedMoney.value,
    price: decodedPrice.value,
    quantity: decodedQuantity.value,
  });
}
