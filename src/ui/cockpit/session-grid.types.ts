// The session grid's props (P159, A216): finished display values only. Price History feeds it read-only; the Review feeds it editable cells (P158 to P161).
// How the frame is named and classed. Price History passes "Price History" and "price-history"; the Review passes its own.
export interface SessionGridFrame {
  // The scrolling region's accessible name.
  readonly label: string;
  // The table's class names; the stylesheet's selectors hang on them.
  readonly tableClass: string;
}

// A cell the reader types a price into (A291). Its accessible name is the cell's `label`.
export interface GridInputCell {
  readonly label: string;
  readonly input: { readonly value: string; readonly onChange: (value: string) => void };
}

// A session before the Trade held the Instrument (A291, W77): nothing to enter and nothing missing.
export interface GridNotHeldCell {
  readonly notHeld: true;
}

export interface GridValueCell {
  readonly text: string;
  readonly tone?: 'gain' | 'loss';
  // A Mark's `provenance` is its hover text (W33); `label` is the cell's accessible name, the price then the provenance.
  readonly provenance?: string;
  readonly label?: string;
  readonly corrected?: true;
  // A draft typed in another Trade (A293): the price shows with the tag "Unsaved", described by that Trade ("XYZ (Long 100 shares @ $50.10)").
  // Present on a cell that can be chosen (not an input); pressing it reports this id (A293).
  readonly id?: string;
  readonly unsaved?: { readonly typedIn: string };
}

export type GridCell = GridValueCell | GridInputCell | GridNotHeldCell;

export interface SessionGridProps {
  // The id of the chosen cell (P160): it shows as pressed. `onPressCell` hears each press.
  readonly chosen?: string;
  // 'turned' puts sessions down the side and Instruments across (P161); the default keeps sessions across. 'auto' turns while the grid's own width is under 40rem.
  readonly layout?: 'wide' | 'turned' | 'auto';
  readonly onPressCell?: (id: string) => void;
  // "<symbol> Mark", "Call Mark" or "Put Mark", then "Trade P&L".
  readonly rowLabels: readonly string[];
  // One column per session, newest first (left). `cells` follow `rowLabels`; a gap is null and reads "—" named "No Mark"; an acknowledged Mark reads "Acknowledged Unavailable".
  readonly columns: readonly {
    // The session's trading date, "2026-11-12": the key a link into this column finds it by (W46).
    readonly session: string;
    readonly weekday: string;
    readonly date: string;
    // The Review's two fixed columns carry a small tag under the date (W71).
    readonly role?: 'review-date' | 'previous';
    readonly cells: readonly (GridCell | null)[];
  }[];
}
