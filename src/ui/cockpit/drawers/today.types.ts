import type { PriceTrackProps } from '../track.types.ts';

// W8, W19, A215, A223. Finished display values only (A216).
type Row = { readonly label: string; readonly value: string };

// The Mark that valued the figures at the Expected Mark Date, in the words the Valuation section gave it (revision 96). The card has no heading.
export interface CurrentMarks {
  // "Mark missing for XYZ on Tue Oct 13", a link to the Review's Marks family for this Trade and Instrument.
  readonly missing?: { readonly text: string; readonly to: string };
  // "Mark acknowledged unavailable for XYZ on Tue Oct 13: your acknowledgment, not a price".
  readonly acknowledged?: string;
  // "Stale context: $51.20 from Mon Oct 12 close (stale, not used in any current figure)".
  readonly stale?: string;
  // "Mark", "Source", "Saved": the Mark with its provenance.
  // `plain` is a text value; the others are figures.
  readonly rows: readonly (Row & { readonly plain?: boolean })[];
  // The reason when the effective revision is a Correction; the card then shows "Corrected" beside it.
  readonly correction?: string;
}

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
    }[];
  };
  // Under the table: the Stale context and an acknowledgment, each only where it applies.
  readonly notes?: { readonly stale?: string; readonly acknowledged?: string };
  // "No Marks yet. This Trade opened today at 10:20 am. ..."
  readonly noMarksText?: string;
  // "Where the price sits" or "Where the prices sit".
  readonly tracksHeading?: string;
  readonly tracks: readonly PriceTrackProps[];
  // "At the Mon Oct 12 Marks" with its figures (W19).
  readonly valuedAt?: { readonly heading: string; readonly rows: readonly Row[] };
  readonly atEntry?: { readonly heading: string; readonly rows: readonly Row[] };
}
