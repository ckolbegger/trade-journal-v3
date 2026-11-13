// A215, A223. A price track's geometry is presentation: finished prices, which the component maps to CSS percentages.
export interface PriceTrackProps {
  // "Option price" or the symbol.
  readonly title: string;
  // Lists the Stop, Target and now prices.
  readonly accessibleName: string;
  readonly min: number;
  readonly max: number;
  // A Stop or Target zone, from one price to another within [min, max].
  readonly zones: readonly { readonly role: 'Stop' | 'Target'; readonly from: number; readonly to: number }[];
  // "entry", "now" and the earlier date.
  readonly markers: readonly { readonly kind: 'entry' | 'now' | 'earlier'; readonly label: string; readonly price: number }[];
  // An Underlying track's lines, one per Underlying condition: its heading, then its value at expiration and distance under their existing terms (A223).
  readonly conditionLines: readonly { readonly label: string; readonly figures: readonly { readonly term: string; readonly value: string }[] }[];
}
