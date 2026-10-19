import Decimal from "decimal.js";

/**
 * The exact value layer. Every authoritative amount, price and quantity passes through here as a
 * decimal string, never a JS `number` (`planning-decisions-2026-10-10.md:180`). The layer is pure:
 * no storage, no clock, no module calls.
 */
export type Currency = string;

export type InstrumentClass = "stock" | "option";

export type DecimalInput = string | number;

export interface Money {
  readonly amount: string;
  readonly currency: Currency;
}

export interface Price {
  readonly amount: string;
}

export interface Quantity {
  readonly amount: string;
  readonly instrumentClass: InstrumentClass;
}

export type ValueError =
  | { readonly kind: "CurrencyMismatch"; readonly left: Currency; readonly right: Currency }
  | {
      readonly kind: "ScaleExceeded";
      readonly instrumentClass: InstrumentClass;
      readonly offending: string;
      readonly allowedScale: number;
    }
  | { readonly kind: "NonExactInput"; readonly field: string }
  | { readonly kind: "InvalidDecimal"; readonly field: string; readonly offending: string };

export type ValueResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ValueError };

export function ok<T>(value: T): ValueResult<T> {
  return { ok: true, value };
}

export function fail<T>(error: ValueError): ValueResult<T> {
  return { ok: false, error };
}

function exact(input: DecimalInput, field: string): ValueResult<string> {
  if (typeof input === "number") {
    return fail({ kind: "NonExactInput", field });
  }
  try {
    const decimal = new Decimal(input);
    if (!decimal.isFinite()) {
      return fail({ kind: "InvalidDecimal", field, offending: String(input) });
    }
    return ok(decimal.toFixed());
  } catch {
    return fail({ kind: "InvalidDecimal", field, offending: String(input) });
  }
}

export function money(input: { amount: DecimalInput; currency: Currency }): ValueResult<Money> {
  const amount = exact(input.amount, "money.amount");
  return amount.ok ? ok({ amount: amount.value, currency: input.currency }) : fail(amount.error);
}

function sameCurrency(left: Money, right: Money): ValueResult<true> {
  return left.currency === right.currency
    ? ok(true)
    : fail({ kind: "CurrencyMismatch", left: left.currency, right: right.currency });
}

export function addMoney(left: Money, right: Money): ValueResult<Money> {
  const currency = sameCurrency(left, right);
  if (!currency.ok) return fail(currency.error);
  return ok({
    amount: new Decimal(left.amount).plus(right.amount).toFixed(),
    currency: left.currency,
  });
}

export function subtractMoney(left: Money, right: Money): ValueResult<Money> {
  const currency = sameCurrency(left, right);
  if (!currency.ok) return fail(currency.error);
  return ok({
    amount: new Decimal(left.amount).minus(right.amount).toFixed(),
    currency: left.currency,
  });
}

export function price(input: { amount: DecimalInput }): ValueResult<Price> {
  const amount = exact(input.amount, "price.amount");
  return amount.ok ? ok({ amount: amount.value }) : fail(amount.error);
}

const ALLOWED_SCALE: Record<InstrumentClass, number> = { stock: 4, option: 0 };

export function quantity(input: {
  amount: DecimalInput;
  instrumentClass: InstrumentClass;
}): ValueResult<Quantity> {
  const amount = exact(input.amount, "quantity.amount");
  if (!amount.ok) return fail(amount.error);
  const allowedScale = ALLOWED_SCALE[input.instrumentClass];
  if (new Decimal(amount.value).decimalPlaces() > allowedScale) {
    return fail({
      kind: "ScaleExceeded",
      instrumentClass: input.instrumentClass,
      offending: String(input.amount),
      allowedScale,
    });
  }
  return ok({ amount: amount.value, instrumentClass: input.instrumentClass });
}

export function positionValue(
  units: Quantity,
  unitPrice: Price,
  currency: Currency,
): ValueResult<Money> {
  return ok({
    amount: new Decimal(units.amount).times(unitPrice.amount).toFixed(),
    currency,
  });
}

/** The exact signed distance between two prices. */
export function subtractPrice(left: Price, right: Price): ValueResult<Price> {
  const leftAmount = exact(left.amount, "price.amount");
  if (!leftAmount.ok) return fail(leftAmount.error);
  const rightAmount = exact(right.amount, "price.amount");
  if (!rightAmount.ok) return fail(rightAmount.error);
  return ok({ amount: new Decimal(leftAmount.value).minus(rightAmount.value).toFixed() });
}

/** Ordering over two same-currency amounts: -1, 0 or 1. */
export function compareMoney(left: Money, right: Money): ValueResult<number> {
  const currency = sameCurrency(left, right);
  if (!currency.ok) return fail(currency.error);
  return ok(new Decimal(left.amount).comparedTo(right.amount));
}

/** The exact ratio of two same-currency amounts, as a decimal string. */
export function moneyRatio(numerator: Money, denominator: Money): ValueResult<string> {
  const currency = sameCurrency(numerator, denominator);
  if (!currency.ok) return fail(currency.error);
  const divisor = new Decimal(denominator.amount);
  if (divisor.isZero()) {
    return fail({ kind: "InvalidDecimal", field: "money.ratio", offending: denominator.amount });
  }
  return ok(new Decimal(numerator.amount).dividedBy(divisor).toFixed());
}

/** The absolute value of an amount. */
export function absMoney(value: Money): Money {
  return { amount: new Decimal(value.amount).abs().toFixed(), currency: value.currency };
}
