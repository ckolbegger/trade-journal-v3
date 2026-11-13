import type { ReactNode } from 'react';

// W10 to W13, A214. Finished display values only (A216).

// What the card list tells an owed reflection: one form is open at a time, so the others are blocked until it is closed or resolved.
export interface OwedControl {
  readonly blocked: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onResolved: () => void;
}

export interface JournalCardItem {
  readonly id: string;
  // The item's existing label: "Plan Reflection", "Position Change Reflection".
  readonly type: string;
  // Further badges beside the type: "Edited", "Deferred, answered".
  readonly badges: readonly string[];
  // The existing term and value rows: "Anchor", "Source", "Moment".
  readonly details: readonly { readonly term: string; readonly value: string }[];
  // An Entry's prompts and answers.
  readonly answers: readonly { readonly prompt: string; readonly answer: string }[];
  // A decline: its badge and its reason.
  readonly declined?: { readonly badge: string; readonly reason: string };
  // An Outstanding Debt: the item as the existing debt item draws it ("Reflection owed", the due text, "Reflect now", "Decline" and their form).
  readonly owed?: (control: OwedControl) => ReactNode;
}

export interface JournalCardProps {
  readonly id: string;
  readonly kind: 'Session' | 'Merged' | 'Plan' | 'Pending' | 'List';
  // "Wed Nov 11, final session", "Mon Nov 9".
  readonly when: string;
  // The Trade P&L.
  readonly title?: string;
  readonly titleTone?: 'gain' | 'loss';
  // "+$90.00 since Mon Nov 9" or "First Mark".
  readonly change?: string;
  readonly changeTone?: 'gain' | 'loss';
  // "XYZ Mark $52.30".
  // A gap reads "—" and is named "No Mark".
  readonly marks: readonly { readonly label: string; readonly value: string; readonly gap?: true }[];
  readonly note?: string;
  readonly items: readonly JournalCardItem[];
}

export interface JournalDrawerProps {
  // "Sessions, newest first": the cards are sessions, and ‹ and › page through them.
  readonly heading?: string;
  // Newest first.
  readonly cards: readonly JournalCardProps[];
}
