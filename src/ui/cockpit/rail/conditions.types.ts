import type { MeterProps } from '../meter/meter.types.ts';

// W5, W6, A206, A207. Finished display values only (A216).
export interface ConditionItem {
  readonly id: string;
  readonly role: 'Stop' | 'Target';
  // Row 1, after the role (W21): "$1.80 away", "3.00 away", "Breached · $0.10 past", the same "· Tue Nov 10 Marks" when dated, or an Unavailable
  // reason at the `label` length. Absent with no Marks, and Closed.
  readonly figure?: string;
  readonly figureTone?: 'gain' | 'loss';
  // Row 2: the full condition on one line, "Option at or above $3.60".
  readonly text: string;
}

export interface ConditionsCardProps {
  // P130: the meter at the top of the card, above the conditions; absent where the Detail shows none (Planned, Closed, no reading yet).
  readonly meter?: MeterProps;
  // In Plan order.
  readonly conditions: readonly ConditionItem[];
  // Beneath: a single `text` note ("Distances to each condition arrive with the first Marks."), or nothing.
  readonly summary: readonly { readonly text: string }[];
}
