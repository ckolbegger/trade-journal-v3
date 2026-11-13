// W9, P99. Finished display values only (A216).
export interface PriceHistoryProps {
  // "<symbol> Mark", "Call Mark" or "Put Mark", then "Trade P&L".
  readonly rowLabels: readonly string[];
  // One column per session, newest first (left). `cells` follow `rowLabels`; a gap is null and reads "—" named "No Mark".
  readonly columns: readonly {
    readonly weekday: string;
    readonly date: string;
    readonly cells: readonly ({ readonly text: string; readonly tone?: 'gain' | 'loss' } | null)[];
  }[];
  // Sessions without Marks, for "2 sessions without Marks." and the tab's count.
  readonly missingCount: number;
  readonly onOpenReview: () => void;
}
