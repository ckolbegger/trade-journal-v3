// W3, W4, A221, A222. Finished display values only (A216).
export type Tone = 'gain' | 'loss';

export interface PnlCardProps {
  // The card's accessible name: "Trade P&L".
  readonly name: string;
  // "$188.05", "—", "Not available", an Unavailable reason at the `figure` length, or "Settlement Due: NVDA 18 Dec 2026 150 Call".
  readonly figure: string;
  readonly tone?: Tone;
  // "+$169.35 since Mon Oct 12", "Trade P&L once today's session ends", or "+1.10R realized, final"; absent with an
  // unavailable Trade P&L (no change line).
  readonly line?: string;
  readonly lineTone?: Tone;
  // "1 of 2 contracts open", "100 of 100 shares open"; absent on an incoherent Detail.
  readonly openLine?: string;
  // A Closed Trade's Result rows, in their existing labels.
  readonly result?: readonly { readonly label: string; readonly value: string }[];
}
