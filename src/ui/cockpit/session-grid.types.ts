// The session grid's props (P159, A216): finished display values only. Price History feeds it read-only.
// How the frame is named and classed. Price History passes "Price History" and "price-history".
export interface SessionGridFrame {
  // The scrolling region's accessible name.
  readonly label: string;
  // The table's class names; the stylesheet's selectors hang on them.
  readonly tableClass: string;
}

export interface GridValueCell {
  readonly text: string;
  readonly tone?: 'gain' | 'loss';
  // A Mark's `provenance` is its hover text (W33); `label` is the cell's accessible name, the price then the provenance.
  readonly provenance?: string;
  readonly label?: string;
  readonly corrected?: true;
}

export type GridCell = GridValueCell;

export interface SessionGridProps {
  // "<symbol> Mark", "Call Mark" or "Put Mark", then "Trade P&L".
  readonly rowLabels: readonly string[];
  // One column per session, newest first (left). `cells` follow `rowLabels`; a gap is null and reads "—" named "No Mark"; an acknowledged Mark reads "Acknowledged Unavailable".
  readonly columns: readonly {
    // The session's trading date, "2026-11-12": the key a link into this column finds it by (W46).
    readonly session: string;
    readonly weekday: string;
    readonly date: string;
    readonly cells: readonly (GridCell | null)[];
  }[];
}
