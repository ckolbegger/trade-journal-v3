// A215, A223. A price track's geometry is presentation: finished prices, which the component maps to CSS percentages.
export interface PriceTrackProps {
  // "Option price" or the symbol.
  readonly title: string;
  // Lists the Stop, Target and now prices.
  readonly accessibleName: string;
  readonly min: number;
  readonly max: number;
  readonly zones: readonly { readonly role: 'Stop' | 'Target'; readonly from: number; readonly to: number }[];
  // "entry", "now" and the earlier date.
  readonly markers: readonly { readonly kind: 'entry' | 'now' | 'earlier'; readonly label: string; readonly price: number }[];
  // An Underlying track's lines, one per Underlying condition: its value at expiration and distance (A223).
  readonly conditionLines: readonly string[];
}
