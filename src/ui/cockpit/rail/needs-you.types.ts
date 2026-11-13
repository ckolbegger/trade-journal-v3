// W7, A217, A224. Finished display values only (A216).
export type NeedsYouItem =
  // An Outstanding Debt: its owed heading and due text, with "Reflect now" selecting the Journal drawer on its card. `onReflectNow` is absent
  // while the Runtime is read only, and until the shell passes a way to select the drawer.
  | { readonly kind: 'Debt'; readonly id: string; readonly heading: string; readonly dueText?: string; readonly onReflectNow?: () => void }
  // "Stop breached: the option's Mark is $3.70, at or above $3.60".
  | { readonly kind: 'Alert'; readonly id: string; readonly text: string }
  // "First Marks are due once the Mon Oct 12 session ends." (revision 91).
  | { readonly kind: 'Note'; readonly id: string; readonly text: string }
  // The existing "Mark missing" link to the Review: `reviewTo` is the Review's route.
  | { readonly kind: 'MarkMissing'; readonly id: string; readonly text: string; readonly reviewTo: string }
  // The Settlement Due panel with its existing words: the contract's rows, then each contract's explanation. `recordExpirationTo` is the route of
  // Record expiration, present only while Writable.
  | {
      readonly kind: 'SettlementDue';
      readonly id: string;
      readonly heading: string;
      readonly rows: readonly { readonly label: string; readonly value: string }[];
      readonly notes: readonly string[];
      readonly recordExpirationTo?: string;
    };

// An empty list reads "Nothing needs you now."
export interface NeedsYouProps {
  readonly items: readonly NeedsYouItem[];
}
