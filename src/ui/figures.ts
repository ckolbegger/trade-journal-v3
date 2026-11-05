import type { CalculationResult } from '../app/types.ts';
import { Rational } from '../domain/values/index.ts';
import type { UnavailableReason } from '../domain/calculation-result/index.ts';
import { notApplicableWords, text, unavailableWords, unboundedWords } from './calculation-words.ts';
import { money, quantity, rMultiple } from './format.ts';

const ZERO = Rational.of(0n);

// How a Closed Trade's exposure ended: the quantity its mechanisms disposed ("Closed via sale of 100 shares").
export const closedViaSale = (mechanisms: readonly { readonly quantity: Rational }[]): string =>
  `Closed via sale of ${quantity(mechanisms.reduce((total, m) => total.add(m.quantity), ZERO))} shares`;
// A gain carries a plus sign; a loss carries the minus the formats already give.
export const signed = (format: (value: Rational) => string) => (value: Rational): string => (value.compare(ZERO) > 0 ? `+${format(value)}` : format(value));

// Only a finding's sentence prints a time; the label and figure lengths used here print none.
const NO_ZONE = 'UTC';

// The badge words for a reason without a number: the calculation-words module owns every text (P71).
export const unavailableLabel = (reason: UnavailableReason): string => text(unavailableWords(reason, 'label', NO_ZONE));

// A list has no result for a Trade whose facts cannot be replayed; it words FactsIncoherent, whose badge and figure these are.
const FACTS_INCOHERENT = { reason: 'FactsIncoherent', findings: [] } as const satisfies UnavailableReason;
export const FACTS_INCOHERENT_LABEL = unavailableLabel(FACTS_INCOHERENT);
export const FACTS_INCOHERENT_FIGURE = text(unavailableWords(FACTS_INCOHERENT, 'figure', NO_ZONE));

// A figure that may lack its Mark says so in words, never as a number or a zero.
export function calculation<T>(result: CalculationResult<T>, format: (value: T) => string): string {
  switch (result.kind) {
    case 'Value':
      return format(result.value);
    case 'Unbounded':
      return text(unboundedWords(result.direction));
    case 'NotApplicable':
      return text(notApplicableWords(result, 'figure'));
    case 'Unavailable':
      return text(unavailableWords(result, 'figure', NO_ZONE));
  }
}

// A figure in dollars and in R ("$450.00 · 1.80R"), or the words for what is missing.
export function dollarsAndR(dollars: CalculationResult<Rational>, planR: CalculationResult<Rational>, sign: (format: (value: Rational) => string) => (value: Rational) => string = (format) => format): string {
  return dollars.kind === 'Value' && planR.kind === 'Value' ? `${sign(money)(dollars.value)} · ${sign(rMultiple)(planR.value)}` : calculation(dollars, sign(money));
}

// Current Marked Trade P&L in dollars and R ("+$582.00 · +2.33R"), or the words for what is missing.
export const pnlText = (pnl: CalculationResult<Rational>, planR: CalculationResult<Rational>): string => dollarsAndR(pnl, planR, signed);
