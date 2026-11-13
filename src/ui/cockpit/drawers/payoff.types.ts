// W14, W18. Finished display values only (A216). One chart, two lines.
// D4 reshaped T8P.3's draft: a line carries its table as finished strings, since the tables have three columns and a note per
// breakeven and extreme, and the drawer carries the symbol, the marker and the sentence.
export interface PayoffLineProps {
  // Chart points as finished numbers: Underlying price and value at expiration. The first is at price 0, the last at the chart's right
  // edge, where the line ends in an arrow; every point before the last is a tick on the price axis.
  readonly points: readonly { readonly price: number; readonly value: number }[];
  // Its text-equivalent table, under "Planned Expiration Payoff" or "Current Expiration Payoff" (W14).
  readonly tableName: string;
  // The table's caption: "Planned payoff at expiration by XYZ price", and for Now ", including +$88.70 realized to date".
  readonly caption: string;
  // The three column headers: "XYZ at expiration", "Payoff at start", "Change per $1 rise in XYZ".
  readonly columns: readonly [string, string, string];
  // One row per segment: "0.00 to 55.00", "−$400.00", "$0.00".
  readonly segments: readonly (readonly [string, string, string])[];
  // The rows under the segments, one text each: "Breakeven 57.00", "Max loss $400.00 for XYZ from 0.00 to 55.00".
  readonly notes: readonly string[];
}

// The Now line, or why there is none: "Not applicable: no open position".
export type PayoffSeries = { readonly kind: 'Line'; readonly line: PayoffLineProps } | { readonly kind: 'NotApplicable'; readonly text: string };

// The value at expiration at the Underlying's latest Mark: a sentence from `valueAtCloseText`, or the term and the module's words for why
// there is none (W18).
export type PayoffValueAtExpiration =
  | { readonly kind: 'Sentence'; readonly text: string }
  | { readonly kind: 'Unavailable'; readonly term: string; readonly value: string };

export interface PayoffDrawerProps {
  // "Expiration Payoff".
  readonly title: string;
  // "XYZ": the price axis reads "XYZ at expiration".
  readonly symbol: string;
  // A stock Trade: one line, "Expiration Payoff: Not applicable: no option expiration." Both series are then absent.
  readonly stockNote?: string;
  readonly planned?: PayoffLineProps;
  readonly current?: PayoffSeries;
  // The Now line's value at the latest Mark, marked on the chart as a point.
  readonly marker?: { readonly price: number; readonly value: number };
  readonly valueAtExpiration?: PayoffValueAtExpiration;
}
