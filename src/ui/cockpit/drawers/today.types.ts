import type { PriceTrackProps } from '../track.types.ts';

// W8, W19, A215, A223. Finished display values only (A216).
type Row = { readonly label: string; readonly value: string };

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
  readonly notes?: { readonly stale?: string; readonly acknowledged?: string };
  // "Closed" (W30): a Closed Trade's Today is greyed (A242) and carries this stamp as real text.
  readonly stamp?: string;
  // "No Marks yet. This Trade opened today at 10:20 am. ..."
  readonly noMarksText?: string;
  // "Where the price sits" or "Where the prices sit".
  readonly tracksHeading?: string;
  readonly tracks: readonly PriceTrackProps[];
  // "At the Mon Oct 12 Marks" with its figures (W19).
  readonly valuedAt?: { readonly heading: string; readonly rows: readonly Row[] };
  readonly atEntry?: { readonly heading: string; readonly rows: readonly Row[] };
}
