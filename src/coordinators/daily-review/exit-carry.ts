import { Temporal } from 'temporal-polyfill';
import { instrumentKey } from '../../domain/instrument/index.ts';
import type { DerivedTradeState } from '../../domain/trade-analysis/index.ts';
import { parseDecimal, Rational } from '../../domain/values/index.ts';
import type { ExitCarry } from './types.ts';

const ZERO = Rational.of(0n);
const exchangeDateOf = (time: string): string => Temporal.Instant.from(time).toZonedDateTimeISO('America/New_York').toPlainDate().toString();

// A313: what an Exit chosen on `exitDate` still holds, and what was sold since, from the Trade's facts, so no screen adds anything up. The Position is the first one
// held; "since" is every Execution that closes it, dated (exchange-local) after the Exit's Review Date. None when nothing is held.
export function exitCarryOf(state: Pick<DerivedTradeState, 'positions' | 'facts'>, exitDate: string): ExitCarry | undefined {
  const position = state.positions.find((p) => p.quantity.compare(ZERO) !== 0);
  if (!position) return undefined;
  const long = position.quantity.compare(ZERO) > 0;
  const sold = state.facts
    .filter((fact) => instrumentKey(fact.instrument) === instrumentKey(position.instrument) && fact.action === (long ? 'Sell' : 'Buy') && exchangeDateOf(fact.economicTime) > exitDate)
    .reduce((sum, fact) => {
      const quantity = parseDecimal(fact.quantity);
      return quantity.ok ? sum.add(quantity.value) : sum;
    }, ZERO);
  return { direction: long ? 'Long' : 'Short', held: long ? position.quantity : ZERO.sub(position.quantity), ...(sold.compare(ZERO) > 0 && { sold }) };
}
