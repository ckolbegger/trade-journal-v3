import type { CalculationResult } from '../calculation-result/index.ts';
import type { OptionInstrument } from '../instrument/index.ts';
import { parseDecimal, Rational } from '../values/index.ts';
import { currentExpirationView, expirationValueAt, intrinsic, positionOf, type CurrentExposure } from './payoff.ts';

const ZERO = Rational.of(0n);

// A314: where an expiring contract finished, from the expiration session's Underlying Mark.
export interface ExpirationStandingInput {
  readonly contract: OptionInstrument;
  readonly exposure: CurrentExposure;
  // One R of the Trade, in dollars.
  readonly oneR: Rational;
  // The Underlying's Mark for the expiration session, as recorded decimal text; absent when it has none.
  readonly underlyingMark?: string;
  // Whether part of the position was sold or bought back before the expiration (a closing change of part of it).
  readonly partClosedBefore: boolean;
}

export interface TradeResultAt {
  readonly dollars: Rational;
  readonly r: Rational;
}

export interface ExpirationStandingFigures {
  readonly underlyingPrice: Rational;
  readonly strike: Rational;
  readonly inTheMoney: boolean;
  // How far in the money (or out of it) a share finished: never negative.
  readonly amount: Rational;
  // What the held contracts are worth at expiration, signed (a short contract is owed).
  readonly worth: Rational;
  readonly ifSettled: TradeResultAt;
  readonly ifExpiredWorthless: TradeResultAt;
  // Whether the Trade closed part of the position before the expiration, so its result is a net one (W141).
  readonly partClosedBefore: boolean;
}

export function expirationStanding(input: ExpirationStandingInput): CalculationResult<ExpirationStandingFigures> {
  const strike = parseDecimal(input.contract.strike);
  if (input.underlyingMark === undefined) {
    return { kind: 'Unavailable', reason: 'MarkMissing', instrument: { kind: 'Stock', symbol: input.contract.symbol }, date: input.contract.expiration };
  }
  const mark = parseDecimal(input.underlyingMark);
  if (!strike.ok || !mark.ok) throw new Error('A frozen strike and a recorded Mark are valid decimals');
  const margin = input.contract.right === 'Call' ? mark.value.sub(strike.value) : strike.value.sub(mark.value);
  const inTheMoney = margin.compare(ZERO) > 0;
  const worth = input.exposure.lots.reduce((sum, lot) => {
    const position = positionOf(lot.instrument, lot.quantity, lot.basis);
    return sum.add(position.contracts.mul(position.multiplier).mul(intrinsic(position, mark.value)));
  }, ZERO);
  const view = currentExpirationView(input.exposure);
  const resultAt = (dollars: Rational): TradeResultAt => ({ dollars, r: dollars.div(input.oneR) });
  const ifSettled = resultAt(expirationValueAt(view, mark.value));
  return {
    kind: 'Value',
    value: { underlyingPrice: mark.value, strike: strike.value, inTheMoney, amount: inTheMoney ? margin : ZERO.sub(margin), worth, ifSettled, ifExpiredWorthless: resultAt(ifSettled.dollars.sub(worth)), partClosedBefore: input.partClosedBefore },
  };
}
