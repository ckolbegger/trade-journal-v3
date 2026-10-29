import type { CalculationResult } from '../app/types.ts';
import { Rational } from '../domain/values/index.ts';
import { money, rMultiple, shortDate } from './format.ts';

const ZERO = Rational.of(0n);
// A gain carries a plus sign; a loss carries the minus the formats already give.
export const signed = (format: (value: Rational) => string) => (value: Rational): string => (value.compare(ZERO) > 0 ? `+${format(value)}` : format(value));

// Each reason in its own words: a missing Mark, the trader's acknowledgment that no price can be had, a date outside coverage, a close not yet come.
function unavailable(reason: string, detail: Extract<CalculationResult<Rational>, { kind: 'Unavailable' }>['detail']): string {
  if (!('date' in detail)) return 'Awaiting the next close';
  if (reason === 'SessionPolicyNotCovered') return 'Not available';
  const where = `${detail.instrument.symbol}, ${shortDate(detail.date)}`;
  return reason === 'AcknowledgedUnavailable' ? `Acknowledged unavailable: ${where}` : `Mark missing: ${where}`;
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
