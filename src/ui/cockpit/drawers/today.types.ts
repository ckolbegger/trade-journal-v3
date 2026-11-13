import type { PriceTrackProps } from '../track.types.ts';

// W8, W19, A215, A223. Finished display values only (A216).
type Row = { readonly label: string; readonly value: string };

export interface TodayDrawerProps {
  // The comparison, absent before any Marks.
  readonly marks?: {
    // "Marks: Thu Oct 15 against Wed Oct 14".
    readonly heading: string;
    // The columns after the empty one: the earlier date, the date, "Change".
    readonly columns: readonly [string, string, string];
    readonly rows: readonly {
      // "MNO Mark", "Put Mark".
      readonly label: string;
      readonly earlier: string;
      readonly current: string;
      readonly change: string;
      readonly changeTone?: 'gain' | 'loss';
      // The Mark's provenance, with a Correction's reason.
      readonly provenance?: string;
    }[];
    // "Wed Oct 14 has no Marks, so Thu Oct 15 is compared with Tue Oct 13."
    readonly note?: string;
  };
  // "No Marks yet. This Trade opened today at 10:20 am. ..."
  readonly noMarksText?: string;
  // "Where the price sits" or "Where the prices sit".
  readonly tracksHeading?: string;
  readonly tracks: readonly PriceTrackProps[];
  // "At the Mon Oct 12 Marks" with its figures.
  readonly valuedAt?: { readonly heading: string; readonly rows: readonly Row[] };
  readonly atEntry?: { readonly heading: string; readonly rows: readonly Row[] };
}
