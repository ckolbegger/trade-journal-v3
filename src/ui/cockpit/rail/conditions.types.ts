// W5, W6, A206, A207. Finished display values only (A216).
export interface ConditionItem {
  readonly id: string;
  readonly role: 'Stop' | 'Target';
  readonly nearest: boolean;
  // Row 1: "−$360.00", "+$260.00", "Breached", "Reached", or an Unavailable reason at the `label` length. Absent with no Marks, and Closed.
  readonly figure?: string;
  readonly figureTone?: 'gain' | 'loss';
  // Row 2: the full condition on one line, "Option at or above $3.60".
  readonly text: string;
  // Row 3, muted: "Change in Trade P&L from the Tue Oct 13 Marks if the option's Mark is $3.60 (−0.75R)."; absent with no Marks, and Closed.
  readonly why?: string;
}

export interface ConditionsCardProps {
  // In Plan order.
  readonly conditions: readonly ConditionItem[];
  // Beneath: "Worst case" and "Max reward" with their values, or a single `text` note
  // ("Distances to each condition and the worst case arrive with the first Marks.").
  readonly summary: readonly { readonly label?: string; readonly text: string }[];
}
