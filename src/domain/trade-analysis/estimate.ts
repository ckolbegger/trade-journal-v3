// D9 P121, A258, A259: an estimate is a plain floating-point number, never a Rational, so no exact figure can be
// built from one. Types only: the pricing is in src/domain/option-pricing/ (T9.21), read only by replay-estimates.ts (T9.22).

// Why a figure is Unavailable (A258, A259).
export type EstimateUnavailableReason =
  | 'MarkMissing'
  | 'ExpirationSession'
  | 'AtOrBelowExerciseValue'
  | 'NoVolatilityFits'
  | 'InsensitiveToVolatility'
  | 'NoEarlierFigure';

// One estimated figure: a number (`exact` marks a stock Position's share equivalent, which is its shares), or
// Unavailable with the reason, or Not Applicable for stock.
export type Estimate =
  | { readonly kind: 'Estimate'; readonly value: number; readonly exact?: true }
  | { readonly kind: 'Unavailable'; readonly reason: EstimateUnavailableReason }
  | { readonly kind: 'NotApplicable' };

// A259: the per-share change in an option's Mark, worked out in the order Underlying, time, volatility. The four parts add up
// to the real change. When the later session has no implied volatility, time and volatility come back as one part.
export type EstimateSplit =
  | { readonly kind: 'Split'; readonly underlying: number; readonly time: number; readonly volatility: number; readonly remainder: number }
  | { readonly kind: 'Split'; readonly underlying: number; readonly timeAndVolatility: number; readonly remainder: number }
  | { readonly kind: 'Unavailable'; readonly reason: EstimateUnavailableReason }
  | { readonly kind: 'NotApplicable' };

// A session's estimates, with the rate and the days to expiration used (null where none applies, as for stock).
export interface ReplayEstimates {
  readonly impliedVolatility: Estimate;
  readonly shareEquivalent: Estimate;
  readonly split: EstimateSplit;
  readonly rate: number | null;
  readonly days: number | null;
}
