// W9, P99. Finished display values only (A216).
export interface PriceHistoryProps {
  // "<symbol> Mark", "Call Mark" or "Put Mark", then "Trade P&L".
  readonly rowLabels: readonly string[];
  // One column per session, newest first (left). `cells` follow `rowLabels`; a gap is null and reads "—" named "No Mark"; an acknowledged Mark reads "Acknowledged Unavailable".
  readonly columns: readonly {
    // The session's trading date, "2026-11-12": the key a link into this column finds it by (W46).
    readonly session: string;
    readonly weekday: string;
    readonly date: string;
    // A Mark's `provenance` is its hover text (W33); `label` is the cell's accessible name, the price then the provenance.
    readonly cells: readonly ({ readonly text: string; readonly tone?: 'gain' | 'loss'; readonly provenance?: string; readonly label?: string; readonly corrected?: true } | null)[];
  }[];
  // Sessions without Marks (Missing only), for "2 sessions without Marks." and the tab's count.
  readonly missingCount: number;
  // Sessions acknowledged unavailable with no Missing Mark, for "1 session acknowledged unavailable." (W81).
  readonly acknowledgedCount: number;
  readonly onOpenReview: () => void;
}
