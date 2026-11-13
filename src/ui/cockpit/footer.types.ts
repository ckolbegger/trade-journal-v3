// W16. Finished display values only (A216): Planned-Leg Fulfillment and Deviations in their existing words. Reshaped from T8P.3's
// `{ heading, lines }` so each section keeps its markup: Fulfillment is label and value rows, Deviations a list or a note.
export interface DetailFooterSection {
  // The heading's id stem ("fulfillment" gives `fulfillment-heading`).
  readonly id: string;
  readonly heading: string;
  // Label and value rows ("Long 100 shares of XYZ", "Filled with Deviation"), one column.
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  // A sentence standing where the list would be ("No Deviations recorded.").
  readonly note?: string;
  // One list item each; a Superseded one is struck through and named for assistive technology.
  readonly items: readonly { readonly text: string; readonly superseded: boolean }[];
}

export interface DetailFooterProps {
  // Empty when the Detail has no Position (Planned, or incoherent): the footer then renders nothing.
  readonly sections: readonly DetailFooterSection[];
}
