// W14, W18. Finished display values only (A216). One chart, two lines.
export interface PayoffLineProps {
  // Chart points as finished numbers: Underlying price and value at expiration.
  readonly points: readonly { readonly price: number; readonly value: number }[];
  // Its text-equivalent table, under "Planned Expiration Payoff" or "Current Expiration Payoff" (W14).
  readonly tableName: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
}

// A line, or why there is none: "Now: Not applicable: no open position".
export type PayoffSeries = { readonly kind: 'Line'; readonly line: PayoffLineProps } | { readonly kind: 'NotApplicable'; readonly text: string };

export interface PayoffDrawerProps {
  // "Expiration Payoff".
  readonly title: string;
  // A stock Trade: one line, "Expiration Payoff: Not applicable: no option expiration." Both series are then absent.
  readonly stockNote?: string;
  readonly planned?: PayoffSeries;
  readonly current?: PayoffSeries;
  // The sentence from `valueAtCloseText`: "Value at expiration at MNO's latest Mark ...".
  readonly valueAtExpiration?: string;
}
