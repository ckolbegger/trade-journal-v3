import type { PriceTrackProps } from '../track.types.ts';

// W8, A215. Finished display values only (A216).

export interface TodayDrawerProps {
  // W29's table, absent only while the replay is. Each cell is a price or "—" (A233).
  readonly marks?: {
    // The columns after the empty one: "Today, Thu Oct 15" (or "Next session, Mon Oct 19"), "Yesterday, Wed Oct 14", "Change".
    readonly columns: readonly [string, string, string];
    readonly rows: readonly {
      // "XYZ Mark", "Call Mark".
      readonly label: string;
      readonly today: string;
      readonly yesterday: string;
      readonly change: string;
      // The screen-reader name of an "Expired" cell, "Expired Fri Nov 20" (W25).
      readonly todayName?: string;
      readonly yesterdayName?: string;
    }[];
  };
  // Under the table: the Stale context and an acknowledgment, each only where it applies.
  // An acknowledgment note for each acknowledged Mark, in the table's order (the Underlying, then the contract).
  readonly notes?: { readonly stale?: string; readonly acknowledged?: readonly string[] };
  // "Closed" (W30): a Closed Trade's Today is greyed (A242) and carries this stamp as real text.
  readonly stamp?: string;
  // "No Marks yet. This Trade opened today at 10:20 am. ..."
  readonly noMarksText?: string;
  // "Where the price sits" or "Where the prices sit".
  readonly tracksHeading?: string;
  readonly tracks: readonly PriceTrackProps[];
}
