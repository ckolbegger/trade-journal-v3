// W15, W17, P96, A224. Finished display values only (A216).
type Row = { readonly label: string; readonly value: string };
type Table = { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] };
type Line = { readonly when: string; readonly text: string };

export interface PositionDrawerProps {
  readonly openLots?: Table;
  // "Open P&L" (or "Settlement Due" at the `label` length), "Realized to date" and "Incurred fees".
  readonly figures: readonly (Row & { readonly tone?: 'gain' | 'loss' })[];
  // The Trade Summary and Last activity.
  readonly summary?: readonly Row[];
  readonly lotMatches?: { readonly table: Table; readonly roundingNote: string };
  // Folded under a disclosure.
  readonly feeReconciliation?: readonly Row[];
  readonly executions: readonly Line[];
  readonly settlement: readonly Line[];
  // The facts as recorded, on an incoherent Detail.
  readonly recorded?: readonly Line[];
}
