// W7, A217, A224. Finished display values only (A216).
export type NeedsYouItem =
  // An Outstanding Debt: its owed heading and due text, with "Reflect now" selecting the Journal drawer on its card.
  | { readonly kind: 'Debt'; readonly id: string; readonly heading: string; readonly dueText?: string; readonly onReflectNow: () => void }
  // "Stop breached: the option's Mark is $3.70, at or above $3.60".
  | { readonly kind: 'Alert'; readonly id: string; readonly text: string }
  // "First Marks are due once today's session ends."
  | { readonly kind: 'Note'; readonly id: string; readonly text: string }
  // The existing "Mark missing" link to the Review.
  | { readonly kind: 'MarkMissing'; readonly id: string; readonly text: string; readonly onOpenReview: () => void }
  // The Settlement Due panel with its existing words; `recordExpiration` only while Writable.
  | {
      readonly kind: 'SettlementDue';
      readonly id: string;
      readonly heading: string;
      readonly rows: readonly { readonly label: string; readonly value: string }[];
      readonly recordExpiration?: () => void;
    };

// An empty list reads "Nothing needs you now."
export interface NeedsYouProps {
  readonly items: readonly NeedsYouItem[];
}
