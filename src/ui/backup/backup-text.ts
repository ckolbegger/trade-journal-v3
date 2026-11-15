// Words and formats the Backup page and the Restore flow's inline safety backup share (D8 Q1, Q2).
import type { BackupProgress, ConfirmBackupResult } from '../../app/types.ts';

export const records = (progress: BackupProgress) => `${progress.done.toLocaleString('en-US')} of ${progress.total.toLocaleString('en-US')} records`;

export type NotVerifiedReason = Extract<ConfirmBackupResult, { kind: 'NotVerified' }>['reason'];

export const NOT_VERIFIED: Record<NotVerifiedReason, string> = {
  Unreadable: "This file couldn't be read. Choose the file you just downloaded.",
  IncompleteOrCorrupt: "This file is incomplete or damaged, so it isn't a usable backup.",
  DifferentArtifact: 'This is a different backup from the one you just downloaded.',
};

export type NotMadeReason = 'ReadFailed' | 'OfferFailed' | 'IntegrityBlocked' | 'Conflict';

export const NOT_MADE: Record<NotMadeReason, string> = {
  ReadFailed: "Your journal couldn't be read.",
  OfferFailed: "Your browser didn't accept the download.",
  IntegrityBlocked: 'Your journal has a problem that blocks a normal backup.',
  Conflict: 'Your journal changed while the backup was being made.',
};

// Shown when an apply fails unexpectedly: the app can't tell which journal is in use until it reloads (T8.13-B2).
export const RESTORE_UNFINISHED = "The Restore didn't finish. Reload the app to see which journal is in use.";

// Shown when preparing the backup fails unexpectedly (Q5 item 4).
export const COULD_NOT_CHECK = "The backup couldn't be checked. Your current journal is unchanged.";

// "Sat Nov 14, 16:05" in the Workspace zone (convention C4).
export function completionTime(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('month')} ${part('day')}, ${part('hour')}:${part('minute')}`;
}
