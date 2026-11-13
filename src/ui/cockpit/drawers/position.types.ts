import type { ReactNode } from 'react';

// W15, W17, P96, A224. Finished display values only (A216). The Executions, the Settlement, the Result and the Lot Matches table keep their
// existing interactive parts and their words, so the adapter hands them over as built elements (P96: moved content keeps its words).
// `plain` is a text value; the others are figures.
type Row = { readonly label: string; readonly value: string; readonly plain?: boolean };
type Table = { readonly columns: readonly string[]; readonly rows: readonly (readonly string[])[] };

export interface PositionDrawerProps {
  // The Trade Summary text ("Long 100 shares @ $50.18"), unlabeled as the Summary card showed it.
  readonly tradeSummary?: string;
  // The Position, the opening fees and Last activity. Absent on a Closed and an incoherent Detail.
  readonly summary?: readonly Row[];
  readonly openLots?: Table;
  // "Open P&L" (its value reads "Settlement Due" on a Settlement Due Detail), "Realized to date" and "Incurred fees". Absent on a Closed and an incoherent Detail.
  readonly figures?: readonly Row[];
  // A Closed Detail's Result.
  readonly result?: ReactNode;
  readonly lotMatches?: { readonly roundingNote: string; readonly table: ReactNode };
  readonly feeReconciliation?: readonly Row[];
  // On an incoherent Detail these are the facts as recorded.
  readonly executions: ReactNode;
  readonly settlement?: ReactNode;
}
