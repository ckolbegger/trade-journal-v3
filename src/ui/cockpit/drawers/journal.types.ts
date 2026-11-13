import type { ReactNode } from 'react';

// W10 to W13, A214. Finished display values only (A216).
export interface JournalCardItem {
  readonly id: string;
  // The item's existing label: "Plan Reflection", "Daily Action: Hold".
  readonly type: string;
  readonly text?: string;
  // An Outstanding Debt: "Reflect now" and "Decline" appear on its card, one form at a time.
  readonly owed?: { readonly dueText?: string; readonly onReflectNow: () => void; readonly onDecline: () => void };
}

export interface JournalCardProps {
  readonly id: string;
  readonly kind: 'Session' | 'Merged' | 'Plan' | 'Pending' | 'List';
  // "Today, Thu Nov 12", "Mon Nov 9", "Fri Nov 13, final session", "Planned Thu Nov 12, 1:40 pm", "Every entry, newest first".
  readonly when: string;
  // The Trade P&L, "Tue Nov 10 without Marks", "Plan", "Session not ended yet" or "Journal".
  readonly title?: string;
  readonly titleTone?: 'gain' | 'loss';
  // "+$90.00 since Mon Nov 9" or "First Mark".
  readonly change?: string;
  readonly changeTone?: 'gain' | 'loss';
  // "XYZ Mark $52.30".
  readonly marks: readonly { readonly label: string; readonly value: string }[];
  readonly note?: string;
  readonly items: readonly JournalCardItem[];
}

export interface JournalDrawerProps {
  // Newest first: the session not yet ended, the sessions, then the Plan card; or the one list on an incoherent Detail.
  readonly cards: readonly JournalCardProps[];
  // The form of the owed item whose form is open, if any, under its card (one form at a time).
  readonly renderForm?: (itemId: string) => ReactNode;
  readonly openFormItemId?: string;
}
