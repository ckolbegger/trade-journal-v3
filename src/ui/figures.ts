import type { CalculationResult } from '../app/types.ts';
import { Rational } from '../domain/values/index.ts';
import { money, rMultiple, shortDate } from './format.ts';

const ZERO = Rational.of(0n);
// A gain carries a plus sign; a loss carries the minus the formats already give.
export const signed = (format: (value: Rational) => string) => (value: Rational): string => (value.compare(ZERO) > 0 ? `+${format(value)}` : format(value));

// Each reason in its own words: a missing Mark, the trader's acknowledgment that no price can be had, a close not yet come; a date outside coverage or any other code is just not available.
function unavailable(reason: string, detail: Extract<CalculationResult<Rational>, { kind: 'Unavailable' }>['detail']): string {
  if (reason === 'AwaitingClose') return 'Awaiting the next close';
  if (!('date' in detail)) return 'Not available';
  const where = `${detail.instrument.symbol}, ${shortDate(detail.date)}`;
  if (reason === 'MarkMissing') return `Mark missing: ${where}`;
  if (reason === 'AcknowledgedUnavailable') return `Acknowledged unavailable: ${where}`;
  return 'Not available';
}

// A figure that may lack its Mark says so in words, never as a number or a zero.
export function calculation(result: CalculationResult<Rational>, format: (value: Rational) => string): string {
  switch (result.kind) {
    case 'Value':
      return format(result.value);
    case 'Unbounded':
      return `Unbounded ${result.direction.toLowerCase()}`;
    case 'NotApplicable':
      return 'Not applicable';
    case 'Unavailable':
      return unavailable(result.reason, result.detail);
  }
}

// Current Marked Trade P&L in dollars and R ("+$582.00 · +2.33R"), or the words for what is missing.
export function pnlText(pnl: CalculationResult<Rational>, planR: CalculationResult<Rational>): string {
  return pnl.kind === 'Value' && planR.kind === 'Value' ? `${signed(money)(pnl.value)} · ${signed(rMultiple)(planR.value)}` : calculation(pnl, signed(money));
}
